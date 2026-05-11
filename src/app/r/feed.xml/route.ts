/**
 * GET /r/feed.xml — RSS 2.0 feed of public agent receipts.
 *
 * Every receipt the platform's users mark "public" appears here.
 * The point: turn cryptographic audit trails into a discoverable
 * artifact stream. Search engines, RSS readers, and developer
 * curiosity all become channels — without the platform itself
 * having to broadcast anything.
 *
 * Emits RSS 2.0 with Atom self-link and an item per receipt:
 *   - <title>   — agent name + first 60 chars of input preview
 *   - <link>    — canonical /r/[id] URL
 *   - <guid>    — stable receipt id
 *   - <pubDate> — receipt creation timestamp
 *   - <description> — input/output preview + safety badges in HTML
 *
 * Cache-Control: public, max-age=300 (5 min) — keeps the feed fresh
 * without thundering Neon every request.
 */
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("rss/receipts");
const FEED_LIMIT = 50;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safePreview(json: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const v of Object.values(parsed)) {
      if (typeof v === "string" && v.trim()) return v.slice(0, 240);
    }
  } catch {
    /* fall through */
  }
  return json.slice(0, 240);
}

export async function GET(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = host ? `${proto}://${host}` : "https://sovereignmatrix.agency";

  let rows: Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    inputJson: string;
    outputJson: string;
    durationMs: number;
    createdAt: Date | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        durationMs: agentRuns.durationMs,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      // SECURITY: only `public` is enumerable in a discoverable RSS
      // feed. `unlisted` means share-by-link — exposing it here
      // violates the user's intent the moment any RSS reader subscribes.
      // Same fix applied to /api/agent-runs/latest-public and
      // /api/agent-runs/recent-public per the pre-merge security
      // review on PR #5.
      .where(eq(agentRuns.visibility, "public"))
      .orderBy(desc(agentRuns.createdAt))
      .limit(FEED_LIMIT);
  } catch (err) {
    // Don't 500 the feed if the DB blips — return an empty feed.
    log.warn("rss feed query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    rows = [];
  }

  const now = new Date().toUTCString();
  const items = rows
    .map((r) => {
      const link = `${origin}/r/${r.id}`;
      const created = (r.createdAt ?? new Date()).toUTCString();
      const inputPreview = escapeXml(safePreview(r.inputJson));
      const outputPreview = escapeXml(safePreview(r.outputJson));
      const titleSuffix =
        inputPreview.length > 0
          ? ` — ${inputPreview.slice(0, 60)}${inputPreview.length > 60 ? "…" : ""}`
          : "";
      const description = `<![CDATA[<p><strong>Input:</strong> ${inputPreview}</p><p><strong>Output:</strong> ${outputPreview}</p><p><em>Model:</em> ${escapeXml(
        r.modelUsed,
      )} · ${r.durationMs} ms</p>]]>`;
      return `    <item>
      <title>${escapeXml(r.agentName)}${escapeXml(titleSuffix)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${created}</pubDate>
      <description>${description}</description>
      <category>${escapeXml(r.agentName)}</category>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sovereign Matrix — Verifiable Agent Receipts</title>
    <link>${origin}</link>
    <atom:link href="${origin}/r/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Every public agent run on Sovereign Matrix produces a cryptographically signed, verifiable receipt. This feed is the live stream.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>5</ttl>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

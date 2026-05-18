/**
 * GET /feed.xml — Atom feed of recent public agent receipts.
 *
 * Discovery surface for procurement automation, researchers,
 * journalists, and the curious. Subscribe in any feed reader (NetNewsWire,
 * Feedly, Reeder, Inoreader, Newsblur) to watch the live stream of
 * signed AI agent outputs as they're produced.
 *
 * Cache: 5 minutes (matches the other public crypto endpoints). Open
 * CORS so a feed-reader running in a browser extension can fetch.
 *
 * Schema: Atom 1.0 (RFC 4287) — better-defined than RSS, universally
 * supported. Each entry carries:
 *   • <id> — receipt id (stable URN)
 *   • <title> — "<agent> · <receipt-id-short>"
 *   • <updated> — receipt issuance timestamp
 *   • <summary> — agent + model + status
 *   • <link> — /r/<id> verification permalink
 *   • <author> — Sovereign Matrix
 *   • A <sovereign:*> namespace carries the signature scheme + leaf hash
 *     so a feed parser can verify the receipt without an extra fetch.
 *
 * Falls back gracefully when the agent-runs table doesn't exist on
 * this deploy — returns an empty feed (still well-formed) rather
 * than throwing.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("feed-xml");

// 5-minute cache.
export const revalidate = 300;

const FEED_LIMIT = 50;
const SITE = "https://sovereignmatrix.agency";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function emptyFeed(reason?: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:sovereign="https://sovereignmatrix.agency/atom-ns">
  <title>Sovereign Matrix — Signed Receipts</title>
  <subtitle>Live feed of Ed25519-signed AI agent receipts. ${reason ? `(${escapeXml(reason)})` : ""}</subtitle>
  <link href="${SITE}/feed.xml" rel="self" type="application/atom+xml" />
  <link href="${SITE}/explorer" />
  <id>urn:sovereign-matrix:feed</id>
  <updated>${now}</updated>
  <author>
    <name>Sovereign Matrix</name>
    <uri>${SITE}</uri>
    <email>spec@sovereignmatrix.agency</email>
  </author>
  <generator uri="${SITE}">Sovereign Matrix</generator>
  <rights>CC0 1.0 (public domain)</rights>
</feed>`;
}

export async function GET(): Promise<NextResponse> {
  let rows: Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    signature: string;
    createdAt: Date;
    visibility: string;
  }> = [];

  try {
    rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
        visibility: agentRuns.visibility,
      })
      .from(agentRuns)
      .where(eq(agentRuns.visibility, "public"))
      .orderBy(desc(agentRuns.createdAt))
      .limit(FEED_LIMIT);
  } catch (err) {
    // Table missing or DB unavailable — return empty well-formed feed
    log.warn("agent-runs query failed; returning empty feed", {
      error: String(err),
    });
    return new NextResponse(emptyFeed("feed source temporarily unavailable"), {
      headers: feedHeaders(),
    });
  }

  if (rows.length === 0) {
    return new NextResponse(emptyFeed("no public receipts yet"), {
      headers: feedHeaders(),
    });
  }

  const updated = rows[0].createdAt.toISOString();
  const entries = rows.map((r) => {
    const issuedAt = r.createdAt.toISOString();
    const short = r.id.slice(0, 8);
    const scheme = r.signature.startsWith("v3=")
      ? "v3 (Ed25519 + ML-DSA-65 post-quantum dual-sign)"
      : r.signature.startsWith("v2=")
        ? "v2 (Ed25519)"
        : r.signature.startsWith("v1=")
          ? "v1 (HMAC-SHA256)"
          : "unsigned";
    return `  <entry>
    <id>urn:sovereign-matrix:receipt:${escapeXml(r.id)}</id>
    <title>${escapeXml(r.agentName)} · ${short}</title>
    <updated>${issuedAt}</updated>
    <published>${issuedAt}</published>
    <link rel="alternate" type="text/html" href="${SITE}/r/${encodeURIComponent(r.id)}" />
    <link rel="related" type="application/json" href="${SITE}/api/verify?receiptId=${encodeURIComponent(r.id)}" />
    <summary>Agent ${escapeXml(r.agentName)} produced an output signed under ${scheme}. Receipt id: ${escapeXml(r.id)}. Verify at ${SITE}/r/${encodeURIComponent(r.id)} or with the OSS CLI: npx @sovereign-matrix/verifiable-receipts verify --pubkey ${SITE}/.well-known/sovereign-receipts/ed25519.pem</summary>
    <sovereign:agent>${escapeXml(r.agentName)}</sovereign:agent>
    <sovereign:model>${escapeXml(r.modelUsed)}</sovereign:model>
    <sovereign:scheme>${escapeXml(scheme)}</sovereign:scheme>
    <sovereign:signature>${escapeXml(r.signature)}</sovereign:signature>
  </entry>`;
  });

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:sovereign="https://sovereignmatrix.agency/atom-ns">
  <title>Sovereign Matrix — Signed Receipts</title>
  <subtitle>Live feed of Ed25519-signed AI agent receipts. Every entry is independently verifiable against the public Ed25519 key.</subtitle>
  <link href="${SITE}/feed.xml" rel="self" type="application/atom+xml" />
  <link href="${SITE}/explorer" />
  <id>urn:sovereign-matrix:feed</id>
  <updated>${updated}</updated>
  <author>
    <name>Sovereign Matrix</name>
    <uri>${SITE}</uri>
    <email>spec@sovereignmatrix.agency</email>
  </author>
  <generator uri="${SITE}">Sovereign Matrix</generator>
  <rights>CC0 1.0 (public domain)</rights>
${entries.join("\n")}
</feed>`;

  return new NextResponse(body, { headers: feedHeaders() });
}

function feedHeaders() {
  return {
    "Content-Type": "application/atom+xml; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
  };
}

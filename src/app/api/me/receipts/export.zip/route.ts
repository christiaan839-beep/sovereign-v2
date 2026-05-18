/**
 * SOVEREIGN MATRIX — /api/me/receipts/export.zip (Wave 23)
 *
 * Stream every receipt the caller owns as a single signed ZIP. Each
 * receipt becomes three files in the archive (canonical, signature,
 * meta); a top-level MANIFEST.signed.json indexes them and carries
 * the bundle digest + platform signature.
 *
 * The verifier `/api/auditor/verify-bundle` re-checks the manifest
 * against the platform's public Ed25519 key. The caller doesn't
 * need to trust us at verification time — the math is the math.
 *
 * Scope: the caller's own runs only. Cross-tenant data is impossible
 * because we filter on `userId` from the Clerk session.
 *
 * Caps: 5000 receipts per export (Vercel function memory + the ZIP
 * format's 65k-entry limit). Larger archives should paginate via
 * `?before=<iso>` query param.
 */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, eq, lt, desc } from "drizzle-orm";
import { canonicalizeRun } from "@/lib/agent-runs";
import { buildSignedReceiptBundle } from "@/lib/receipt-bundle";
import { auditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/receipts/export.zip");
const limiter = rateLimit({ interval: 60, limit: 5 });

const MAX_RECEIPTS = 5_000;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const beforeRaw = url.searchParams.get("before");
  const before =
    beforeRaw && !Number.isNaN(Date.parse(beforeRaw))
      ? new Date(beforeRaw)
      : null;

  let rows: Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    inputJson: string;
    outputJson: string;
    safetyResult: string;
    durationMs: number;
    signature: string;
    createdAt: Date;
  }> = [];
  try {
    rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        safetyResult: agentRuns.safetyResult,
        durationMs: agentRuns.durationMs,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(
        before
          ? and(eq(agentRuns.userId, userId), lt(agentRuns.createdAt, before))
          : eq(agentRuns.userId, userId),
      )
      .orderBy(desc(agentRuns.createdAt))
      .limit(MAX_RECEIPTS);
  } catch (err) {
    log.warn("agent_runs read failed during bundle export", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: "Bundle service unavailable" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "No receipts to export" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Re-derive canonical for every row deterministically. Pure
  // computation — the same row always produces the same bytes.
  const bundleRows = rows.map((r) => {
    const canonical = canonicalizeRun({
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      input: safeParse(r.inputJson),
      output: safeParse(r.outputJson),
      safetyResult: safeParse(r.safetyResult) as never,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    });
    return {
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      signature: r.signature,
      canonical,
    };
  });

  const { zip, manifest } = buildSignedReceiptBundle(bundleRows);

  // Audit the export so the Wave-9 Bitcoin anchor sweeps the row.
  await auditLog({
    userId,
    action: "data.audit-bundle",
    resource: `receipt_bundle:${manifest.bundleDigest.slice(0, 16)}`,
    details: {
      receiptCount: manifest.receiptCount,
      bundleDigest: manifest.bundleDigest,
      manifestHash: manifest.manifestHash,
      sizeBytes: zip.byteLength,
    },
  }).catch(() => {
    /* non-blocking */
  });

  const filename = `sovereign-receipts-${userId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`;
  // Buffer → ArrayBuffer slice so the Response constructor accepts a
  // typed-array-backed Blob. Slicing forces a concrete ArrayBuffer
  // (vs ArrayBufferLike) which is what lib.dom's BodyInit expects.
  const ab = zip.buffer.slice(
    zip.byteOffset,
    zip.byteOffset + zip.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/zip" });
  return new Response(blob, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": zip.byteLength.toString(),
      "x-sovereign-bundle-digest": manifest.bundleDigest,
      "x-sovereign-manifest-hash": manifest.manifestHash,
      "x-sovereign-receipt-count": manifest.receiptCount.toString(),
      "cache-control": "no-store",
    },
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

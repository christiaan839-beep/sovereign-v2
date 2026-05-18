/**
 * GET /api/transparency/proof
 *
 * Two query shapes:
 *
 *   /api/transparency/proof?kind=inclusion&index=<n>&size=<n>
 *     → returns the inclusion proof for the leaf at `index` against
 *       the tree of size `size`. `size` defaults to the current tree
 *       size. The response includes the leaf hash so a verifier can
 *       run verifyInclusionProof() against the published STH.
 *
 *   /api/transparency/proof?kind=consistency&old=<n>&new=<n>
 *     → returns the consistency proof from `old` to `new`. `new`
 *       defaults to the current tree size. Use to confirm the log
 *       has not rewritten any of the first `old` leaves since the
 *       last witnessed STH.
 *
 * Open CORS. No authentication. Errors return 400 with a structured
 * `{ error: "..." }` body so a downstream automation can parse the
 * failure mode rather than scraping HTML.
 */
import { NextResponse } from "next/server";
import { getDemoTransparencyLog } from "@/lib/transparency-singleton";
import { createLogger } from "@/lib/logger";

const log = createLogger("transparency-proof");

export const revalidate = 60;

function bad(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    },
  );
}

function ok(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseInteger(raw: string | null, name: string): number {
  if (raw === null) throw new Error(`missing query parameter: ${name}`);
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    const tlog = await getDemoTransparencyLog();
    const currentSize = tlog.size();

    if (kind === "inclusion") {
      let index: number;
      let size: number;
      try {
        index = parseInteger(url.searchParams.get("index"), "index");
        const sizeRaw = url.searchParams.get("size");
        size = sizeRaw === null ? currentSize : parseInteger(sizeRaw, "size");
      } catch (err) {
        return bad((err as Error).message);
      }
      if (size === 0) return bad("size must be > 0 for inclusion proof");
      if (index >= size) {
        return bad(`index ${index} out of range for size ${size}`);
      }
      const proof = tlog.proveInclusion(index, size);
      return ok({
        kind: "inclusion",
        logId: tlog.logId,
        index,
        treeSize: size,
        leafHash: tlog.leafAt(index),
        proof,
      });
    }

    if (kind === "consistency") {
      let oldSize: number;
      let newSize: number;
      try {
        oldSize = parseInteger(url.searchParams.get("old"), "old");
        const newRaw = url.searchParams.get("new");
        newSize = newRaw === null ? currentSize : parseInteger(newRaw, "new");
      } catch (err) {
        return bad((err as Error).message);
      }
      if (oldSize > newSize) {
        return bad("old must be <= new");
      }
      const proof = tlog.proveConsistency(oldSize, newSize);
      return ok({
        kind: "consistency",
        logId: tlog.logId,
        oldSize,
        newSize,
        proof,
      });
    }

    return bad("kind must be 'inclusion' or 'consistency'");
  } catch (err) {
    log.error("proof endpoint failed", { error: String(err) });
    return NextResponse.json(
      { error: "Unable to compute proof" },
      { status: 500 },
    );
  }
}

/**
 * SOVEREIGN MATRIX — /api/auditor/replay/[id]
 *
 * Given a Sovereign receipt id, reconstruct the original agent run and
 * issue a fresh "replay attestation" — a signature an external auditor
 * can include in their workpaper system to prove they independently
 * re-derived byte-identical canonical bytes from the platform's storage.
 *
 * No auth required. Replays are scoped to runs marked `visibility =
 * "public"` OR `"unlisted"`. Private rows return 404 even on a valid
 * receipt id so we don't leak run existence. Auth-gated replays (for
 * the row's own owner / admins) flow through /api/auditor/replay/[id]?
 * scope=mine in a follow-up; the public surface is intentionally
 * narrow to start.
 *
 * Wire format (JSON):
 *   GET /api/auditor/replay/{id}
 *     → 200 ReplayResult
 *     → 404 { error: "Not found" }
 *
 *   Accept: text/plain → returns the workpaper-formatted multi-line
 *   text suitable for pasting into an audit document.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { replayReceipt, formatReplayWorkpaper } from "@/lib/auditor-replay";

const log = createLogger("auditor-replay");

// Generous limit — auditors batch-verify, but a single requester
// shouldn't be able to volumetrically scrape every public receipt.
const limiter = rateLimit({ interval: 60, limit: 60 });

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { id } = await params;
  // Cheap shape check — a receipt id is a UUID v4 in this codebase.
  // Refuse to even hit the DB on garbage input.
  if (!/^[0-9a-f-]{20,64}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid receipt id" }, { status: 400 });
  }

  const result = await replayReceipt(id);

  // Suppress private rows on the public path — emit 404 indistinguishable
  // from "no such id at all". The row.visibility check is structural; we
  // never reveal whether a private receipt id is real.
  if (
    result.run &&
    result.run.visibility !== "public" &&
    result.run.visibility !== "unlisted"
  ) {
    log.info("Private receipt requested on public auditor surface", {
      id,
      visibility: result.run.visibility,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.status === "not-found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Plain-text workpaper format — auditors paste this directly into PDFs.
  if (req.headers.get("accept")?.includes("text/plain")) {
    return new NextResponse(formatReplayWorkpaper(result), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        // Cache for a minute — replays of the same id are deterministic
        // for the lifetime of the row.
        "cache-control": "public, max-age=60",
      },
    });
  }

  return NextResponse.json(result, {
    status: 200,
    headers: { "cache-control": "public, max-age=60" },
  });
}

/**
 * POST /api/agent-runs/[id]/notarize
 *
 * Submit a receipt's signature to OpenTimestamps for third-party
 * trusted timestamping. Returns the resulting attestation immediately
 * (sub-second when calendars are healthy); the attestation is
 * "pending" until a Bitcoin block confirms it (~1 hour later).
 *
 * Auth: receipt owner only. Notarization is a write-side action that
 * commits the receipt to a public blockchain anchor — only the owner
 * should trigger it.
 *
 * Cost: free. OpenTimestamps calendars are operated as public
 * infrastructure by the OTS community. The platform doesn't pay
 * per-attestation fees and neither does the user.
 *
 * Idempotency: notarizing the same receipt twice produces two valid
 * attestations (because each is timestamped at a different moment).
 * Callers MAY notarize repeatedly if they want stronger proofs.
 *
 * Storage: the attestation is returned to the caller in the response
 * body. The caller is responsible for archiving it alongside the
 * receipt — we don't write it to our DB by default (would require a
 * schema change, and many callers want to maintain their own
 * notarization archive separate from the platform).
 *
 * To turn the pending attestation into a full Bitcoin proof later,
 * call GET /timestamp/{digest} on the same calendar server (encoded
 * in the response's `attestation.calendar` field) — this lib's
 * `refreshAttestation` does exactly that.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun } from "@/lib/agent-runs";
import { notarizeReceipt } from "@/lib/opentimestamps";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-runs/notarize");

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.userId !== userId) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  if (!run.signature || run.signature === "unsigned") {
    return NextResponse.json(
      {
        error:
          "Receipt is unsigned (AGENT_RUN_SIGNING_SECRET not configured at issue time). Notarization requires a signed receipt.",
        code: "UNSIGNED_RECEIPT",
      },
      { status: 422 },
    );
  }

  const result = await notarizeReceipt(run.signature);
  if (!result.ok) {
    log.warn("opentimestamps submission failed", {
      id,
      error: result.error,
    });
    return NextResponse.json(
      {
        error:
          "Notarization failed — calendar servers unreachable. Receipt remains valid; this is a best-effort enhancement.",
        detail: result.error,
        code: "OTS_UNAVAILABLE",
      },
      { status: 502 },
    );
  }

  log.info("opentimestamps attestation issued", {
    id,
    calendar: result.attestation?.calendar,
    digest: result.attestation?.digest.slice(0, 16),
  });

  return NextResponse.json({
    ok: true,
    receiptId: id,
    attestation: result.attestation,
    spec: {
      protocol: "OpenTimestamps",
      protocolUrl: "https://opentimestamps.org",
      anchor: "Bitcoin",
      verifyInstructions:
        "The attestation is base64-encoded raw .ots bytes. Use the ots CLI (`pip install opentimestamps-client && ots verify <file>.ots`) or the OpenTimestamps JS lib to confirm. Status starts 'pending'; after ~1 hour, refetch from the calendar to upgrade to a Bitcoin proof.",
    },
  });
}

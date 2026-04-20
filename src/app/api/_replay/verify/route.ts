import { NextResponse } from "next/server";
import { verifySnapshot, type AgentSnapshotV1 } from "@/lib/agent-snapshot";

/**
 * POST /api/_replay/verify
 *
 * Public endpoint that takes a snapshot JSON and verifies its
 * checksum + format version. No authentication required —
 * this is meant to be an auditor's toolkit, not an API for
 * managing snapshots.
 *
 * What it does:
 *   - Decodes the body as a snapshot-v1 document
 *   - Recomputes the SHA-256 of the canonical JSON (excluding
 *     `checksum`) and compares to the stored `checksum` field
 *   - Returns { valid: true } on match, { valid: false, reason }
 *     on mismatch / wrong version / missing checksum
 *
 * What it does NOT do:
 *   - Does not re-run the snapshot through agents (that's a
 *     separate endpoint, /api/_replay/reproduce)
 *   - Does not store the uploaded snapshot
 *   - Does not reveal whether the snapshot originated from our
 *     system (any v1 document verifies independently)
 *
 * Threat model:
 *   - Checksum is SHA-256 — preimage resistance prevents forging
 *     a snapshot that matches a given checksum
 *   - But NOTE: checksum verifies integrity, not provenance. A
 *     regenerated-from-scratch snapshot with a valid checksum is
 *     still "valid" in this sense. Provenance requires a signature,
 *     which is on the roadmap (v2 — adds HMAC with our public key).
 */

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Shape-check — fastest rejection path before we run the hash.
  if (
    !body ||
    typeof body !== "object" ||
    !("version" in body) ||
    !("checksum" in body) ||
    !("request" in body) ||
    !("trace" in body)
  ) {
    return NextResponse.json(
      { valid: false, reason: "not_a_snapshot" },
      { status: 400 },
    );
  }

  const snap = body as AgentSnapshotV1;

  // Hard cap on body size — an auditor legitimately sends a ~100KB
  // snapshot; a malicious client sending a 50MB "snapshot" shouldn't
  // waste our canonicalJSON time. Next.js already caps request bodies
  // but this is a defensive check.
  const rough = JSON.stringify(snap);
  if (rough.length > 1_000_000) {
    return NextResponse.json(
      { valid: false, reason: "too_large" },
      { status: 413 },
    );
  }

  const result = verifySnapshot(snap);

  return NextResponse.json({
    ...result,
    meta: {
      version: snap.version,
      agentName: snap.request?.agentName,
      runStartedAt: snap.runStartedAt,
      runDurationMs: snap.runDurationMs,
      providersConsulted: snap.providersConsulted,
    },
  });
}

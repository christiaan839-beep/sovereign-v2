/**
 * SOVEREIGN MATRIX — /api/dsar/verify/[id] (Wave 13).
 *
 * Public DSAR verifier. The user (or their regulator) submits:
 *
 *   POST /api/dsar/verify/{receiptId}
 *   {
 *     payload: { ... the export JSON, minus the attestation block ... }
 *   }
 *
 * The server:
 *   1. Looks up the DSAR audit-log row by receiptId.
 *   2. Recomputes the payload hash from the submitted bytes.
 *   3. Verifies the original signature is intact AND that the
 *      submitted payload matches the hash bound into the signature.
 *
 * Returns { ok: boolean, reason?: string, attestation?: ... }
 *
 * Threat model: an export holder can swap the export bytes after the
 * fact; verifying with this endpoint catches that. The endpoint never
 * stores the export contents — it just confirms the math.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, like } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  verifyDsarEnvelope,
  stableStringify,
  type DsarAttestation,
} from "@/lib/dsar-envelope";
import { createHash } from "crypto";

const log = createLogger("api/dsar/verify");

// Auditors might verify in bulk; generous but not unbounded.
const limiter = rateLimit({ interval: 60, limit: 30 });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { id } = await params;
  if (!/^[0-9a-f-]{20,64}$/i.test(id)) {
    return NextResponse.json(
      { error: "Invalid receipt id format" },
      { status: 400 },
    );
  }

  // Look up the DSAR audit-log row. Resource pattern is `dsar:<id>`.
  let auditRow: { details: string | null } | undefined;
  try {
    [auditRow] = await db
      .select({ details: auditLogs.details })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "data.export"),
          like(auditLogs.resource, `dsar:${id}`),
        ),
      )
      .limit(1);
  } catch (err) {
    log.warn("audit_logs read failed during DSAR verify", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Verifier unavailable" },
      { status: 503 },
    );
  }

  if (!auditRow || !auditRow.details) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let storedAttestation: DsarAttestation & { payloadHash: string };
  try {
    storedAttestation = JSON.parse(auditRow.details) as DsarAttestation & {
      payloadHash: string;
    };
  } catch {
    return NextResponse.json(
      { error: "Stored attestation is malformed" },
      { status: 500 },
    );
  }

  // Parse the submitted payload — caller MUST include it; we don't
  // store the export contents server-side.
  let body: { payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON with a `payload` field" },
      { status: 400 },
    );
  }
  if (!body.payload) {
    return NextResponse.json(
      {
        error:
          "POST body must include the original export under `payload` (minus the attestation block)",
      },
      { status: 400 },
    );
  }

  // Strip the embedded attestation from the submission before hashing —
  // the signed payload hash was computed BEFORE attestation injection.
  const cloned = JSON.parse(JSON.stringify(body.payload)) as Record<
    string,
    unknown
  >;
  delete cloned.attestation;
  const recomputedPayloadHash = createHash("sha256")
    .update(stableStringify(cloned), "utf8")
    .digest("hex");

  const result = verifyDsarEnvelope(storedAttestation, recomputedPayloadHash);

  if (!result.ok) {
    log.warn("DSAR verify failed", {
      receiptId: id,
      reason: result.reason,
    });
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        verifiedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      receiptId: storedAttestation.receiptId,
      issuedAt: storedAttestation.issuedAt,
      verifiedAt: new Date().toISOString(),
      scheme: storedAttestation.signature.startsWith("v2=")
        ? "ed25519"
        : storedAttestation.signature.startsWith("v1=")
          ? "hmac-sha256"
          : "unsigned",
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

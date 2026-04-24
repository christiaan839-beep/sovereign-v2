/**
 * POST /api/platform/verify-attestation
 *
 * Public endpoint — paste a signed attestation, get a structured
 * verdict on whether the signature is valid. No auth required.
 * Third parties (auditors, compliance tools, customer SecOps teams)
 * can use this OR run the verification fully offline using
 * /api/platform/public-key — both paths produce identical results.
 *
 * Request body:
 *   { "attestation": { ...signed attestation JSON... } }
 *
 * OR as a convenience:
 *   { "attestationJson": "<stringified attestation>" }
 *
 * Response:
 *   {
 *     "ok": true,
 *     "signed": boolean,
 *     "valid": boolean,
 *     "reason": string (only when valid:false),
 *     "publicKey": string (only when valid:true),
 *     "claims": {
 *       "agentId", "invocationId", "inputHash", "outputHash",
 *       "modelUsed", "timestamp", "slaVerdict", "platform"
 *     } | null
 *   }
 *
 * What third parties can do with this:
 *   - Confirm a specific invocation produced a specific output, given
 *     the specific input hash. If they have the plaintext input +
 *     output, recomputing the hashes matches → full end-to-end proof.
 *   - Detect tampering: any post-hoc modification to the attestation
 *     (changing the SLA verdict, swapping agentId, etc.) breaks
 *     the signature.
 *   - Build their own audit trails: every verified attestation can
 *     be stored by the verifier with full confidence in its integrity.
 *
 * Rate-limited aggressively (60/min/IP) — the endpoint does ed25519
 * verification which is cheap but we don't want it to be a DoS vector.
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import {
  verifyAttestation,
  type Attestation,
} from "@/lib/invocation-attestation";

interface RequestShape {
  attestation?: unknown;
  attestationJson?: unknown;
}

function extractAttestation(body: RequestShape): Attestation | null {
  if (body.attestation && typeof body.attestation === "object" && !Array.isArray(body.attestation)) {
    return body.attestation as Attestation;
  }
  if (typeof body.attestationJson === "string") {
    try {
      const parsed = JSON.parse(body.attestationJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Attestation;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "platform-verify",
    windowMs: 60_000,
    max: 60,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Try again in a minute" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let body: RequestShape;
  try {
    body = (await request.json()) as RequestShape;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_input", message: "Body must be valid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const attestation = extractAttestation(body);
  if (!attestation) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_input",
        message:
          "Expected body.attestation to be an object or body.attestationJson to be a stringified JSON object.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const verdict = await verifyAttestation(attestation);

  // Surface the claims (minus the signature block) so the caller
  // can see WHAT was attested regardless of whether the signature
  // verified. Third parties often want to cross-check the hashes
  // against their own plaintext records.
  const { _sig: _ignored, ...claims } = attestation;
  void _ignored;

  return NextResponse.json(
    {
      ok: true,
      signed: verdict.signed,
      valid: verdict.valid,
      reason: verdict.reason,
      publicKey: verdict.publicKey,
      claims,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

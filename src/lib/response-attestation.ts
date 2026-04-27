/**
 * RESPONSE ATTESTATION — sign every agent response so clients can
 * verify it was produced BY Sovereign Matrix and that the claimed
 * model is the model that served.
 *
 * Closes the deeper LLM05 (Supply Chain) gap: per-agent SBOM is great,
 * but a customer running an audit against a specific response wants
 * cryptographic proof, not just a manifest claim.
 *
 * SIGNING SCHEME
 *   - HMAC-SHA256 over the canonical tuple:
 *       agent | request_id | sha256(input_json) | sha256(output_json) |
 *       provider_list | model_list | timestamp_iso
 *   - Header: `X-Sovereign-Attestation: t=<ts>,v1=<hex>`
 *   - Same shape as Stripe webhook signing — clients with HMAC libs
 *     can verify without new dependencies.
 *
 * The signature key is `SOVEREIGN_ATTESTATION_SECRET`. Rotating it
 * invalidates every outstanding attestation; we publish the rotation
 * window in /api/_meta/keys.json (next sprint adds Ed25519 + key
 * rotation history; for v1 a single HMAC secret is enough).
 *
 * VERIFY FROM CLIENT
 *   1. Read `X-Sovereign-Attestation` header → parse {t, v1}
 *   2. Re-canonicalize the tuple from the response body + agent name
 *   3. Recompute HMAC-SHA256 with the same secret (shared with the
 *      customer at provisioning time, or fetched via mTLS)
 *   4. timing-safe-equal vs v1
 *   5. Reject if t > 5 min stale
 *
 * NEVER throws. If the secret isn't configured, attestation is omitted
 * (logged as a warning). The response still works — attestation is
 * defense-in-depth, not the primary auth path.
 */

import { createHmac, createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("response-attestation");

export interface AttestationInputs {
  agent: string;
  requestId: string;
  inputJson: string;
  outputJson: string;
  providers: string[];
  models: string[];
  timestampIso: string;
}

/**
 * Build the canonical signing payload. Pure function; deterministic
 * given the same inputs. Sorted arrays, JSON-stringified inputs hashed
 * (so signatures don't leak the prompt or output).
 */
export function canonicalizeAttestation(inputs: AttestationInputs): string {
  const inputHash = createHash("sha256").update(inputs.inputJson).digest("hex");
  const outputHash = createHash("sha256").update(inputs.outputJson).digest("hex");
  const providers = [...inputs.providers].sort().join(",");
  const models = [...inputs.models].sort().join(",");
  return [
    "v1",
    inputs.agent,
    inputs.requestId,
    inputHash,
    outputHash,
    providers,
    models,
    inputs.timestampIso,
  ].join("|");
}

/**
 * Produce the `X-Sovereign-Attestation` header value, or null if the
 * secret isn't configured.
 */
export function signAttestation(inputs: AttestationInputs): string | null {
  const secret = process.env.SOVEREIGN_ATTESTATION_SECRET;
  if (!secret || secret.length < 16) {
    log.debug("Attestation skipped — SOVEREIGN_ATTESTATION_SECRET unset or too short");
    return null;
  }
  const payload = canonicalizeAttestation(inputs);
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const tSeconds = Math.floor(Date.parse(inputs.timestampIso) / 1000);
  return `t=${tSeconds},v1=${sig}`;
}

/**
 * Client-side verifier. Returns true iff the header matches the
 * expected canonical payload. Public so customers can copy-paste it
 * into their own services + so our E2E tests can verify the contract.
 */
export function verifyAttestation(
  header: string,
  inputs: AttestationInputs,
  secret: string,
  options: { maxAgeSeconds?: number } = {},
): { valid: boolean; reason?: string } {
  if (!secret || secret.length < 16) return { valid: false, reason: "secret_too_short" };
  const m = header.match(/^t=(\d+),v1=([0-9a-f]+)$/);
  if (!m) return { valid: false, reason: "header_malformed" };
  const t = Number(m[1]);
  const v1 = m[2];
  const maxAge = options.maxAgeSeconds ?? 300;
  const ageSeconds = Math.floor(Date.now() / 1000) - t;
  if (ageSeconds > maxAge) return { valid: false, reason: "stale" };

  const payload = canonicalizeAttestation(inputs);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== v1.length) return { valid: false, reason: "length_mismatch" };

  // Timing-safe compare via running XOR — avoids the early-exit
  // side-channel of `===`.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0 ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}

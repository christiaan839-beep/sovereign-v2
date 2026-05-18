/**
 * C2PA bridge — VAOS receipts ⇄ Content Authenticity Initiative manifests.
 *
 * The Coalition for Content Provenance and Authenticity (Adobe, Microsoft,
 * Intel, BBC, Truepic, etc.) published C2PA v2.1 in 2024 — a JSON-LD
 * manifest format that travels with media files (JPEG XMP, MP4 boxes,
 * PDF metadata) and records who produced/modified the content and how.
 *
 * VAOS receipts answer a structurally identical question for AI agent
 * outputs: "what was the verdict, signed by whom, against what rules?"
 *
 * This module converts VAOS Guardian verdicts into C2PA-compatible
 * assertions in the namespace `org.sovereignmatrix.vaos.v1`. A C2PA
 * consumer (Adobe Firefly, Microsoft Copilot, Truepic Lens, content
 * verification websites) can then surface our cryptographic verdict
 * inline with the manifest it already trusts.
 *
 * Conversely, fromC2PAManifest() extracts a VAOS attestation out of a
 * received C2PA manifest so a publisher who only speaks C2PA can still
 * feed our verifier.
 *
 * Spec references:
 *   - C2PA Technical Specification v2.1 §17 (custom assertions)
 *   - C2PA assertion label naming guidance §17.2 (reverse-domain)
 *   - VAOS 2.0/3.0 wire format (./SPEC.md in this package)
 *
 * @packageDocumentation
 */

import type { GuardianAttestation } from "./guardian.js";

/**
 * Reserved C2PA assertion label for VAOS attestations.
 *
 * Following C2PA §17.2 reverse-domain naming convention + `.vaos` +
 * major-version suffix. Consumers MUST tolerate additive fields under
 * this label; breaking changes require a new label (`.vaos.v2`, etc.).
 */
export const C2PA_VAOS_LABEL = "org.sovereignmatrix.vaos.v1";

/**
 * Minimal C2PA assertion envelope (subset of C2PA v2.1 §15.2).
 *
 * Real-world C2PA manifests carry many more fields (claim_generator,
 * thumbnail, ingredients, signature_info, etc.); we only model the
 * shape needed for round-tripping a VAOS attestation through a C2PA
 * consumer. The output is JSON-serializable and can be embedded
 * verbatim inside a larger manifest's `assertions` array.
 */
export interface C2PAAssertion {
  label: string;
  data: Record<string, unknown>;
  /** Kind discriminator from C2PA §15.2 — we always use "Json". */
  kind?: "Json" | "Cbor" | "Binary";
}

/**
 * Standalone C2PA manifest containing one VAOS assertion. Suitable
 * for embedding in a JUMBF box (JPEG/MP4) or a PDF XMP packet.
 */
export interface C2PAManifestWithVaos {
  /** C2PA spec version we target. */
  manifest_spec: "c2pa/2.1";
  /** Unique URN per C2PA §11 — derived from verdict id. */
  instance_id: string;
  /** Tool/agent that produced this manifest. */
  claim_generator: string;
  /** Assertions array — always contains exactly one VAOS assertion here. */
  assertions: C2PAAssertion[];
  /** ISO-8601 mint timestamp. */
  generated_at: string;
}

/**
 * Convert a signed Guardian attestation into a single C2PA assertion.
 *
 * The full `attestation` is embedded under `data.vaos` so a downstream
 * VAOS verifier can call `verifyGuardianAttestation()` directly on it.
 * Convenience surface fields (`verdict`, `verdict_id`, `issued_at`)
 * live at the top of `data` so a C2PA-only consumer can render them
 * without understanding VAOS internals.
 */
export function toC2PAAssertion(
  attestation: GuardianAttestation,
): C2PAAssertion {
  return {
    label: C2PA_VAOS_LABEL,
    kind: "Json",
    data: {
      // Surface fields (renderable without VAOS knowledge).
      verdict: attestation.overall,
      verdict_id: attestation.verdictId,
      content_hash: attestation.contentHash,
      issued_at: attestation.issuedAt,
      // Full envelope — re-feed into verifyGuardianAttestation().
      vaos: attestation,
    },
  };
}

/**
 * Wrap a VAOS attestation as a complete one-assertion C2PA manifest
 * suitable for direct file embedding.
 *
 * `claimGenerator` defaults to "Sovereign Matrix VAOS/3.0"; pass your
 * own value if you're a different VAOS issuer per the issuer registry.
 */
export function toC2PAManifest(
  attestation: GuardianAttestation,
  claimGenerator: string = "Sovereign Matrix VAOS/3.0",
): C2PAManifestWithVaos {
  return {
    manifest_spec: "c2pa/2.1",
    instance_id: `urn:vaos:verdict:${attestation.verdictId}`,
    claim_generator: claimGenerator,
    assertions: [toC2PAAssertion(attestation)],
    generated_at: new Date().toISOString(),
  };
}

/**
 * Extract a VAOS attestation from a C2PA manifest if present.
 *
 * Returns the embedded attestation when the manifest contains a
 * `C2PA_VAOS_LABEL` assertion with a well-formed `data.vaos` payload;
 * otherwise returns null. Callers should then pass the returned value
 * to `verifyGuardianAttestation()` from ./guardian to verify the
 * signature.
 *
 * This is intentionally tolerant of unknown fields per C2PA §17.5 —
 * we only require the shape we wrote and ignore anything else.
 */
export function fromC2PAManifest(
  manifest: unknown,
): GuardianAttestation | null {
  if (!manifest || typeof manifest !== "object") return null;
  const m = manifest as { assertions?: unknown };
  if (!Array.isArray(m.assertions)) return null;

  for (const a of m.assertions) {
    if (!a || typeof a !== "object") continue;
    const asn = a as { label?: unknown; data?: unknown };
    if (asn.label !== C2PA_VAOS_LABEL) continue;
    if (!asn.data || typeof asn.data !== "object") continue;
    const data = asn.data as { vaos?: unknown };
    if (!data.vaos || typeof data.vaos !== "object") continue;
    const v = data.vaos as Partial<GuardianAttestation>;
    if (
      typeof v.verdictId === "string" &&
      typeof v.overall === "string" &&
      Array.isArray(v.rules) &&
      typeof v.canonical === "string" &&
      typeof v.contentHash === "string" &&
      typeof v.signature === "string" &&
      typeof v.issuedAt === "string"
    ) {
      return v as GuardianAttestation;
    }
  }
  return null;
}

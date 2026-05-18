/**
 * GET /.well-known/vaos
 *
 * VAOS Issuer Discovery Document — RFC 8615 well-known URI.
 *
 * The structural analogue of OpenID Connect's
 * `/.well-known/openid-configuration`. A single JSON response that
 * tells an auditor, regulator, or third-party verifier _everything_
 * they need to verify any receipt signed by this issuer:
 *
 *   - Supported VAOS wire-format versions (v1 HMAC, v2 Ed25519,
 *     v3 Ed25519 + ML-DSA-65)
 *   - Public-key URLs (so verifiers can pin trust)
 *   - Transparency log URLs (STH, inclusion proof, witness gossip)
 *   - Frozen specification URLs
 *   - Trust-store + bug-bounty contacts
 *
 * This is the federation primitive that lets the VAOS ecosystem
 * grow without requiring any central directory: each issuer hosts
 * the same shape of document at the same path. Crawlers and
 * compliance bots discover everything in one HTTP round-trip.
 *
 * Open CORS — discovery is public by design.
 *
 * Cache: 5 min CDN + 5 min browser. Discovery rarely changes; the
 * short TTL is a safety valve for emergency key rotation.
 */
import { NextResponse } from "next/server";
import { getEd25519PublicKeyPem } from "@/lib/agent-runs";
import { getPublicUrl } from "@/lib/base-url";

export const revalidate = 300;

export const VAOS_DISCOVERY_VERSION = 1;

interface VaosDiscoveryDocument {
  /** Stable schema version. Verifiers MUST tolerate additive fields. */
  discovery_version: number;
  /** Issuer canonical URL (the origin of this document). */
  issuer: string;
  /** Human display name. */
  issuer_name: string;
  /** Wire-format versions this issuer can produce + verify. */
  supported_wire_versions: Array<"v1" | "v2" | "v3">;
  /** Algorithms exposed under each wire version. */
  algorithms: {
    v1: "HMAC-SHA256";
    v2: "Ed25519";
    v3: "Ed25519+ML-DSA-65";
  };
  /** Public-key URLs by algorithm. PEM or base64 as documented. */
  public_keys: {
    ed25519_pem_url: string;
    /** ML-DSA-65 public key URL — present only when an issuer dual-signs. */
    mldsa65_b64_url: string | null;
  };
  /** Transparency log endpoints (RFC 9162-flavored). */
  transparency: {
    sth_url: string;
    inclusion_proof_url: string;
    witness_url: string;
  };
  /** Issuer registry (the "CA root store" for VAOS). */
  issuer_registry_url: string;
  /** Frozen specification documents — versioned, immutable. */
  specifications: {
    vaos_v1: string;
    vaos_v2: string;
    vaos_v3: string;
    transparency_log: string;
  };
  /** Bundle download root (signed ZIP receipts). */
  bundle_download_root: string;
  /** Operational contacts. */
  contacts: {
    security: string;
    spec: string;
  };
  /** Public security policy + bounty scope. */
  security_policy_url: string;
  /** Mint timestamp of THIS document (ISO 8601). */
  generated_at: string;
}

function buildDiscovery(origin: string): VaosDiscoveryDocument {
  const hasV2Key = getEd25519PublicKeyPem() !== null;
  // ML-DSA pubkey URL is advertised conditionally too: the URL exists
  // structurally, but the spec only obligates issuers to publish a key
  // when they're actually dual-signing. We advertise it whenever the v2
  // key is present, since v3 layers on top of v2.
  const wire: Array<"v1" | "v2" | "v3"> = hasV2Key
    ? ["v1", "v2", "v3"]
    : ["v1"];

  return {
    discovery_version: VAOS_DISCOVERY_VERSION,
    issuer: origin,
    issuer_name: "Sovereign Matrix",
    supported_wire_versions: wire,
    algorithms: {
      v1: "HMAC-SHA256",
      v2: "Ed25519",
      v3: "Ed25519+ML-DSA-65",
    },
    public_keys: {
      ed25519_pem_url: `${origin}/.well-known/sovereign-receipts/ed25519.pem`,
      mldsa65_b64_url: hasV2Key
        ? `${origin}/.well-known/sovereign-receipts/mldsa65.b64`
        : null,
    },
    transparency: {
      sth_url: `${origin}/api/transparency/sth`,
      inclusion_proof_url: `${origin}/api/transparency/proof`,
      witness_url: `${origin}/api/transparency/witness`,
    },
    issuer_registry_url: `${origin}/.well-known/sovereign-receipts/issuers.json`,
    specifications: {
      vaos_v1: `${origin}/docs/specs/vaos-1.0.md`,
      vaos_v2: `${origin}/docs/specs/vaos-2.0.md`,
      vaos_v3: `${origin}/docs/specs/vaos-3.0.md`,
      transparency_log: `${origin}/docs/specs/transparency-log.md`,
    },
    bundle_download_root: `${origin}/api/bundles`,
    contacts: {
      security: "security@sovereignmatrix.agency",
      spec: "spec@sovereignmatrix.agency",
    },
    security_policy_url: `${origin}/security`,
    generated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const origin = getPublicUrl();
  const doc = buildDiscovery(origin);
  return NextResponse.json(doc, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

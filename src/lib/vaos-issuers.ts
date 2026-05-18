/**
 * VAOS issuer registry — the "CA root store for AI agent receipts".
 *
 * Verifiers consult this list to discover trusted issuers + their
 * public-key URLs. Lives in source so that an external auditor
 * inspecting `git log` on this repo can reproduce who was a known
 * issuer at any historical point.
 *
 * Adding an issuer is a PR — see PR template in
 * docs/specs/transparency-log.md §5 (witness protocol applies the
 * same governance idea to log operators). For now the only issuer
 * is Sovereign Matrix itself; this is the seed for the network
 * effect.
 *
 * Schema is stable: `version` bumps on breaking change. Verifiers
 * that consume the JSON at /.well-known/sovereign-receipts/issuers.json
 * MUST tolerate additive fields.
 */

export interface VaosIssuer {
  /** Stable identifier, typically the canonical domain. */
  id: string;
  /** Display name. */
  name: string;
  /** Primary public website. */
  homepage: string;
  /** Country code (ISO 3166-1 alpha-2). Where the issuer operates from. */
  country: string;
  /** Ed25519 public-key URL (PEM). REQUIRED for v2/v3 verification. */
  ed25519PublicKeyUrl: string;
  /** ML-DSA-65 public-key URL (base64). OPTIONAL — set when issuer dual-signs. */
  mldsa65PublicKeyUrl?: string;
  /** Transparency-log base URL (for inclusion / consistency proofs). */
  transparencyLogUrl?: string;
  /** VAOS versions this issuer supports. */
  schemes: Array<"v1" | "v2" | "v3">;
  /** First date this issuer started signing VAOS receipts (ISO 8601). */
  activeSince: string;
  /** Operational contact for security disclosure. */
  securityContact: string;
  /** Free-form note (~120 chars max). */
  note?: string;
}

export interface IssuerRegistry {
  version: 1;
  generatedAt: string;
  issuers: VaosIssuer[];
}

const ISSUERS: VaosIssuer[] = [
  {
    id: "sovereignmatrix.agency",
    name: "Sovereign Matrix",
    homepage: "https://sovereignmatrix.agency",
    country: "ZA",
    ed25519PublicKeyUrl:
      "https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem",
    mldsa65PublicKeyUrl:
      "https://sovereignmatrix.agency/.well-known/sovereign-receipts/mldsa65.b64",
    transparencyLogUrl: "https://sovereignmatrix.agency/api/transparency",
    schemes: ["v1", "v2", "v3"],
    activeSince: "2026-05-01",
    securityContact: "security@sovereignmatrix.agency",
    note: "Reference implementation of VAOS 1.0/2.0/3.0 + ART-Log.",
  },
];

export function getIssuerRegistry(): IssuerRegistry {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    issuers: ISSUERS.slice(),
  };
}

export function listIssuers(): readonly VaosIssuer[] {
  return ISSUERS;
}

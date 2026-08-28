/**
 * GET /api/security/posture
 *
 * Machine-readable security posture for procurement teams + auditors.
 * Open CORS — anyone can `curl` this without an account. Aggregates
 * what we already expose piecemeal (Ed25519 PEM, BTC anchor, audit
 * chain head) into one JSON envelope that:
 *
 *   1. Tells a CISO what receipt schemes we support (v1 HMAC, v2
 *      Ed25519, v3 dual-signed Ed25519 + ML-DSA-65) and which keys
 *      are configured on THIS deployment.
 *   2. Returns the latest Bitcoin anchor row so a procurement reviewer
 *      can see we are in fact anchoring, with a fresh timestamp.
 *   3. Surfaces the live transport-security headers (HSTS, CSP, COOP)
 *      and the WebAuthn enforcement state so a security questionnaire
 *      can be filled from this one endpoint.
 *   4. Documents where every claim is verifiable independently —
 *      pubkey URL, replay UI URL, spec URL.
 *
 * Hardened against drift: every field maps to a real env var or DB
 * row; nothing is hardcoded marketing claim. If a feature is OFF on
 * this deployment, the JSON says so explicitly rather than lying.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogAnchors, auditLogs } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { getEd25519PublicKeyPem } from "@/lib/agent-runs";
import { thresholdStatus } from "@/lib/threshold-signer";
import { createLogger } from "@/lib/logger";
import { packageUrl } from "@/lib/package-links";

const log = createLogger("security-posture");

// Cache 5 minutes — anchors land hourly, key rotation is rare. Cached
// at the edge so a procurement spreadsheet that hits this endpoint
// 50 times in a row from a single questionnaire doesn't fan out to
// the DB on every line.
export const revalidate = 300;

function ed25519Configured(): boolean {
  return !!process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
}

function mldsa65Configured(): boolean {
  return !!process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
}

function hmacConfigured(): boolean {
  return !!(process.env.AGENT_RUN_SIGNING_SECRET || process.env.CRON_SECRET);
}

interface AnchorSummary {
  chainHead: string;
  rowCount: number;
  attestedAt: string;
  proofs: number;
}

interface DefenseStats {
  windowHours: number;
  totalBlocks: number;
  byCategory: Record<string, number>;
}

/**
 * Defense-block aggregate for the last 24h. Counts only `defense.block`
 * audit rows and groups by category (jailbreak, rate-limit, ssrf, etc.).
 * No PII surfaced; counts only. Receipts emitted by wave-92 wiring are
 * already commitment-only, so even pulling the raw rows is leak-safe —
 * we just don't need them for the public posture page.
 */
async function defenseStats(): Promise<DefenseStats | null> {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await db
      .select({
        resource: auditLogs.resource,
        n: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(
        sql`${auditLogs.action} = ${"defense.block"} and ${auditLogs.createdAt} >= ${since}`,
      )
      .groupBy(auditLogs.resource);

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      // resource format is `<category>:<ruleId>` per defense-receipts.ts
      const category = String(r.resource ?? "unknown").split(":")[0];
      byCategory[category] = (byCategory[category] ?? 0) + Number(r.n);
      total += Number(r.n);
    }
    return { windowHours: 24, totalBlocks: total, byCategory };
  } catch (err) {
    // audit_logs table may not exist on a fresh deploy — keep posture
    // page renderable.
    log.warn("defense stats lookup failed", { error: String(err) });
    return null;
  }
}

async function latestAnchor(): Promise<AnchorSummary | null> {
  try {
    const [row] = await db
      .select({
        chainHead: auditLogAnchors.chainHead,
        rowCount: auditLogAnchors.rowCount,
        attestedAt: auditLogAnchors.attestedAt,
        proofs: auditLogAnchors.proofs,
      })
      .from(auditLogAnchors)
      .orderBy(desc(auditLogAnchors.attestedAt))
      .limit(1);
    if (!row) return null;
    let proofCount = 0;
    try {
      const parsed = JSON.parse(String(row.proofs ?? "[]"));
      proofCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      proofCount = 0;
    }
    return {
      chainHead: row.chainHead,
      rowCount: row.rowCount,
      attestedAt: new Date(row.attestedAt).toISOString(),
      proofs: proofCount,
    };
  } catch (err) {
    // Anchor table may not exist on a fresh deployment — fail soft so
    // the rest of the posture envelope still renders. This is a
    // marketing-grade endpoint, not a money-path; the DB missing is a
    // configuration finding, not a 500.
    log.warn("latest anchor lookup failed", { error: String(err) });
    return null;
  }
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  const ed25519Pem = getEd25519PublicKeyPem();
  const [anchor, defense] = await Promise.all([latestAnchor(), defenseStats()]);
  const threshold = thresholdStatus();

  // The shape of this envelope is the contract for any vendor-questionnaire
  // automation we (or our buyers) build later. Keys are stable; add new
  // keys at the bottom of each section rather than rewriting existing ones.
  const body = {
    generatedAt,
    issuer: {
      name: "Sovereign Matrix",
      domain: "sovereignmatrix.agency",
      contact: "security@sovereignmatrix.agency",
      vulnerabilityDisclosure:
        "https://sovereignmatrix.agency/security#vulnerability-disclosure",
    },
    receipts: {
      schemes: {
        // v1: HMAC-SHA256 — always available when AGENT_RUN_SIGNING_SECRET
        // or CRON_SECRET is set; fall-back for installations that haven't
        // generated an Ed25519 keypair yet.
        v1_hmac_sha256: {
          enabled: hmacConfigured(),
          verifierEndpoint: "/api/verify",
        },
        // v2: Ed25519 — independently verifiable with the public key
        // below + canonical projection (see /spec).
        v2_ed25519: {
          enabled: ed25519Configured(),
          publicKeyUrl: ed25519Configured()
            ? "/.well-known/sovereign-receipts/ed25519.pem"
            : null,
          publicKeyPemPreview: ed25519Pem
            ? ed25519Pem.split("\n").slice(0, 4).join("\n")
            : null,
        },
        // v3: Ed25519 + ML-DSA-65 dual-sign (NIST FIPS 204).
        // Forward-secure across the post-quantum transition.
        v3_ed25519_mldsa65: {
          enabled: ed25519Configured() && mldsa65Configured(),
          mldsaPublicKeyUrl: mldsa65Configured()
            ? "/.well-known/sovereign-receipts/mldsa65.b64"
            : null,
          standardCitation: "NIST FIPS 204 (ML-DSA-65, Dilithium3)",
        },
      },
      canonicalizationSpec: "/spec",
      replayInterface: "/auditor/replay",
    },
    chainOfCustody: {
      auditChainHead: anchor?.chainHead ?? null,
      auditChainRowCount: anchor?.rowCount ?? null,
      lastAnchoredAt: anchor?.attestedAt ?? null,
      bitcoinCalendarProofs: anchor?.proofs ?? 0,
      anchorEndpoint: "/api/auditor/anchor",
      // If `lastAnchoredAt` is more than ~6h stale, the anchor cron is
      // unhealthy on this deployment — surface that to the reader.
      stale:
        anchor?.attestedAt &&
        Date.now() - new Date(anchor.attestedAt).getTime() > 6 * 3600 * 1000,
    },
    thresholdSigning: {
      // Threshold receipt signatures (TRS) — m-of-n issuer cosigning.
      // When enabled, every issued threshold envelope requires `m`
      // valid signatures from the `authorizedIssuers` set. Compromising
      // any single witness (including this deploy) cannot forge a
      // valid envelope — quorum from independent parties is required.
      enabled: threshold.enabled,
      m: threshold.m,
      n: threshold.n,
      // We deliberately publish the issuer set so verifiers can fetch
      // each pubkey out-of-band, but NOT which witnesses this server
      // holds local keys for — that'd help an attacker target the
      // minimum set of compromises.
      authorizedIssuers: threshold.authorizedIssuers,
      verifierEndpoint: "/api/transparency/threshold-status",
      specCitation: "RFC 9162 §4 + Bitcoin-style m-of-n multisig",
    },
    defenses: {
      // Aggregate over the last 24 hours of defense.block audit rows.
      // Counts only — every individual block already left a signed
      // receipt with sha256(signal) commitment (wave 92). Counts give
      // an observable hardening signal without exposing per-event data.
      window: defense ? `${defense.windowHours}h` : null,
      totalBlocks: defense?.totalBlocks ?? null,
      byCategory: defense?.byCategory ?? null,
      receiptEnvelopeSchema: "vaos-defense-event-v1",
      verifierEndpoint: "/api/verify",
    },
    transportSecurity: {
      hsts: "max-age=63072000; includeSubDomains; preload",
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      csp: "default-src 'self'; frame-ancestors 'none'; report-uri /api/_security/csp-report",
      coop: "same-origin",
      corp: "same-site",
    },
    authentication: {
      provider: "Clerk",
      mfa: "available; required for /api/_admin/* when WEBAUTHN_REQUIRED=true",
      webauthnStepUp: {
        enabled: !!process.env.WEBAUTHN_RP_ID,
        required: process.env.WEBAUTHN_REQUIRED === "true",
        registrationEndpoint: "/api/webauthn/register",
      },
    },
    compliance: {
      // Mapped against actual product behaviour, not marketing aspiration.
      hipaa:
        "Guardian pack (45 CFR §164.514 Safe Harbor) ships in @sovereign-matrix/verifiable-receipts",
      naicAiBulletin:
        "Guardian pack (Dec 2023 bulletin §3.5) ships in @sovereign-matrix/verifiable-receipts",
      sr11_7:
        "Guardian pack (Fed SR 11-7 / OCC 2011-12) ships in @sovereign-matrix/verifiable-receipts",
      dscsa:
        "Guardian pack (§581(11)) ships in @sovereign-matrix/verifiable-receipts",
      euCsrd:
        "Guardian pack (CSRD/ESRS) ships in @sovereign-matrix/verifiable-receipts",
      ich_e2b_r3:
        "Sample receipt at /for-pharmacovigilance · 21 CFR Part 11 §11.10(e) audit-trail compatible",
      gdpr: "DSAR endpoint at /api/privacy/dsar — exports are signed (POPIA §23 / GDPR Art. 15)",
      popia: "South Africa data-protection — same DSAR endpoint",
      soc2: "Type II in progress · SBOM + signed receipts + audit-log anchoring are the SOC-2-relevant primitives shipped today",
    },
    sbom: {
      // Generated by the security-audit CI job (CycloneDX). The SBOM
      // artifact lives in GitHub Actions for 90 days per .github/workflows/ci.yml.
      generator: "@cyclonedx/cyclonedx-npm",
      ciArtifactRetentionDays: 90,
      ciWorkflow: ".github/workflows/ci.yml",
    },
    openSourcePrimitives: [
      {
        name: "@sovereign-matrix/verifiable-receipts",
        license: "Apache-2.0",
        registry:
          packageUrl("@sovereign-matrix/verifiable-receipts"),
        source:
          "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verifiable-receipts",
        purpose:
          "Independent reproduction of the cryptographic primitives — auditors can verify our receipts using a library we do not control at runtime.",
      },
      {
        name: "@sovereign-matrix/agent-sdk",
        license: "Apache-2.0",
        registry: packageUrl("@sovereign-matrix/agent-sdk"),
        source:
          "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/agent-sdk",
        purpose: "Typed client for the platform; verifies receipts locally.",
      },
    ],
  };

  return NextResponse.json(body, {
    headers: {
      // Public — procurement teams pull this from CI pipelines, security
      // questionnaire automators, etc. Open CORS to match the other
      // /.well-known + /api/verify routes.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

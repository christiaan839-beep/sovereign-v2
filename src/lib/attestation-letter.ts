/**
 * SOVEREIGN MATRIX — Quarterly attestation letter (Cook 53 / Tier 7 #33)
 *
 * Compliance-officer-friendly auto-generated attestation. Reads:
 *
 *   - `compliance-mappings.ts` for the framework coverage scorecard
 *   - run statistics for the period (passed inline by the caller —
 *     this module does NO I/O)
 *
 * …and renders a structured `AttestationLetter` with:
 *
 *   1. cover page header (tenant + period)
 *   2. executive summary (per-framework coverage %, runs, drift events)
 *   3. control-by-control evidence table
 *   4. signature block (HMAC over the canonical body — so a regulator
 *      can verify the letter wasn't edited after issuance)
 *
 * The renderer is pure markdown — pluggable PDF renderer in
 * server/pdf-generator/ consumes it.
 */

import { createHmac, createHash } from "crypto";
import {
  buildScorecard,
  renderControlLine,
  type Framework,
  type FrameworkScorecard,
} from "@/lib/compliance-mappings";

// ── Public types ──────────────────────────────────────────────────────────

export interface PeriodStats {
  totalRuns: number;
  passedRuns: number;
  redTeamCampaigns: number;
  redTeamFailuresByseverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  driftEvents: number;
  replays: number;
}

export interface LetterRequest {
  tenantId: string;
  tenantDisplayName: string;
  periodStart: string; // ISO-8601 date
  periodEnd: string; // ISO-8601 date
  frameworks: Framework[];
  stats: PeriodStats;
  /** Letter signing key. Caller supplies — kept out of the env entirely. */
  signingKey: string;
  /** Optional override of the issuer org name. */
  issuer?: string;
}

export interface AttestationLetter {
  /** Canonical markdown body. Sign + render. */
  body: string;
  /** Hex SHA-256 of the body (stable artifact id). */
  bodyDigest: string;
  /** Hex HMAC-SHA256 of `bodyDigest` under the signing key. */
  signature: string;
  /** Per-framework scorecards used in the body. */
  scorecards: FrameworkScorecard[];
  /** ISO-8601 timestamp the letter was issued at. */
  issuedAt: string;
}

// ── Rendering ─────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function renderHeader(req: LetterRequest, issuedAt: string): string {
  const issuer = req.issuer ?? "Sovereign Matrix";
  return [
    "# Quarterly AI System Attestation",
    "",
    `**Issued by:** ${issuer}`,
    `**Tenant:** ${req.tenantDisplayName} (${req.tenantId})`,
    `**Period:** ${req.periodStart} → ${req.periodEnd}`,
    `**Issued at:** ${issuedAt}`,
    "",
  ].join("\n");
}

function renderSummary(
  scorecards: FrameworkScorecard[],
  stats: PeriodStats,
): string {
  const lines: string[] = [
    "## Executive Summary",
    "",
    `- **Total agent runs:** ${stats.totalRuns}`,
    `- **Passed safety pipeline:** ${stats.passedRuns} (${pct(
      stats.totalRuns === 0 ? 0 : stats.passedRuns / stats.totalRuns,
    )})`,
    `- **Red-team campaigns executed:** ${stats.redTeamCampaigns}`,
    `- **Red-team failures (critical / high / medium / low):** ${[
      stats.redTeamFailuresByseverity.critical,
      stats.redTeamFailuresByseverity.high,
      stats.redTeamFailuresByseverity.medium,
      stats.redTeamFailuresByseverity.low,
    ].join(" / ")}`,
    `- **Drift events detected:** ${stats.driftEvents}`,
    `- **Receipt replays performed:** ${stats.replays}`,
    "",
    "### Framework coverage",
    "",
  ];
  for (const sc of scorecards) {
    lines.push(
      `- **${sc.framework}** — ${pct(sc.coverageFraction)} (${sc.implemented} implemented, ${sc.partial} partial, ${sc.planned} planned)`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function renderControlTable(scorecards: FrameworkScorecard[]): string {
  const lines: string[] = ["## Control-by-Control Evidence", ""];
  for (const sc of scorecards) {
    lines.push(`### ${sc.framework}`);
    lines.push("");
    for (const c of sc.controls) {
      lines.push(renderControlLine(c));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderSignatureBlock(
  bodyDigest: string,
  signature: string,
  issuedAt: string,
): string {
  return [
    "## Signature",
    "",
    `**Body digest (SHA-256):** \`${bodyDigest}\``,
    `**Signature (HMAC-SHA256):** \`${signature}\``,
    `**Issued at:** ${issuedAt}`,
    "",
    "Verify with:",
    "```",
    "expected = HMAC-SHA256(signingKey, SHA-256(body)) ",
    "compare to signature, constant-time",
    "```",
    "",
  ].join("\n");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build a signed attestation letter. Pure (modulo the caller-supplied
 * `now` and `signingKey`).
 */
export function generateAttestationLetter(
  req: LetterRequest,
  now: Date = new Date(),
): AttestationLetter {
  if (!req.signingKey) {
    throw new Error("generateAttestationLetter: signingKey is required");
  }
  if (req.frameworks.length === 0) {
    throw new Error(
      "generateAttestationLetter: at least one framework required",
    );
  }
  const issuedAt = now.toISOString();
  const scorecards = req.frameworks.map((f) => buildScorecard(f));

  // Compose body in three passes so we can hash + sign without the
  // signature appearing in the digest input.
  const headerSection = renderHeader(req, issuedAt);
  const summarySection = renderSummary(scorecards, req.stats);
  const controlsSection = renderControlTable(scorecards);

  const bodyForSigning = [headerSection, summarySection, controlsSection].join(
    "\n",
  );
  const bodyDigest = createHash("sha256").update(bodyForSigning).digest("hex");
  const signature = createHmac("sha256", req.signingKey)
    .update(bodyDigest)
    .digest("hex");

  const fullBody =
    bodyForSigning +
    "\n" +
    renderSignatureBlock(bodyDigest, signature, issuedAt);

  return {
    body: fullBody,
    bodyDigest,
    signature,
    scorecards,
    issuedAt,
  };
}

/**
 * Verify an attestation letter: re-compute the body digest from
 * everything except the signature block, then constant-time compare
 * the HMAC. Returns `{ ok, reason }` so callers can render the
 * verification result.
 */
export function verifyAttestationLetter(
  letter: AttestationLetter,
  signingKey: string,
): { ok: boolean; reason?: string } {
  if (!signingKey) return { ok: false, reason: "missing-key" };
  // Strip everything from "## Signature" onward; that's the body-for-signing.
  const sigHeader = "\n## Signature\n";
  const idx = letter.body.indexOf(sigHeader);
  const bodyForSigning = idx >= 0 ? letter.body.slice(0, idx) : letter.body;
  const bodyDigest = createHash("sha256").update(bodyForSigning).digest("hex");
  if (bodyDigest !== letter.bodyDigest) {
    return { ok: false, reason: "digest-mismatch" };
  }
  const expected = createHmac("sha256", signingKey)
    .update(bodyDigest)
    .digest("hex");
  if (expected.length !== letter.signature.length) {
    return { ok: false, reason: "invalid-signature" };
  }
  // Constant-time compare via Buffer.
  const a = Buffer.from(expected);
  const b = Buffer.from(letter.signature);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0
    ? { ok: true }
    : { ok: false, reason: "invalid-signature" };
}

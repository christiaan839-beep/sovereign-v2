/**
 * @sovereign/inspector — Trust-as-Collateral (R42) port.
 *
 * Pure-function port of src/lib/agent-credit-line.ts. Customers can
 * recompute credit lines LOCALLY from a published reputation grade
 * and a known base daily limit. Sovereign is not a required trust
 * anchor — the math is the truth.
 *
 * The trustless loop closure for credit:
 *   1. Inspector fetches /api/identity/credit/<agentId>
 *   2. Inspector fetches /api/identity/reputation/<agentId>/signals
 *   3. Inspector recomputes the reputation locally
 *   4. Inspector applies the multiplier table to the published base
 *   5. Inspector compares the recomputed effective limit to the
 *      published one. Any mismatch = fabricated credit line.
 *
 * Usage:
 *   import { computeCreditLine, multiplierForGrade } from "@sovereign/inspector/credit";
 *   const line = computeCreditLine({ letterGrade: "A+", numericScore: 95, baseDailyLimitCents: 5000 });
 */

// ── Multiplier table (canonical, mirrors src/lib/agent-credit-line.ts) ──

export function multiplierForGrade(grade) {
  switch (grade) {
    case "A+":
      return 5.0;
    case "A":
      return 3.0;
    case "A-":
      return 2.0;
    case "B+":
      return 1.5;
    case "B":
      return 1.0;
    case "B-":
      return 1.0;
    case "C+":
      return 0.85;
    case "C":
      return 0.75;
    case "C-":
      return 0.65;
    case "D":
      return 0.5;
    case "F":
      return 0.25;
    case "no_score_yet":
      return 1.0;
    default:
      return 1.0;
  }
}

export function framingForGrade(grade) {
  switch (grade) {
    case "A+":
      return "Trusted veteran — high autonomy";
    case "A":
      return "Trusted — elevated autonomy";
    case "A-":
      return "Trusted — modestly elevated autonomy";
    case "B+":
      return "Above-default autonomy";
    case "B":
    case "B-":
      return "Default — base autonomy";
    case "C+":
      return "Below-default — lightly restricted";
    case "C":
      return "Restricted autonomy";
    case "C-":
      return "More restricted autonomy";
    case "D":
      return "Heavily restricted autonomy";
    case "F":
      return "Probation — minimal autonomy";
    case "no_score_yet":
      return "Default — unproven, not penalized";
    default:
      return "Default — base autonomy";
  }
}

// ── The pure-function calculator ───────────────────────────────────

export function computeCreditLine({
  letterGrade,
  numericScore,
  baseDailyLimitCents,
}) {
  if (typeof baseDailyLimitCents !== "number" || baseDailyLimitCents < 0) {
    throw new Error(
      `computeCreditLine: baseDailyLimitCents must be a number >= 0, got ${baseDailyLimitCents}`,
    );
  }
  if (typeof numericScore !== "number" || numericScore < 0 || numericScore > 100) {
    throw new Error(
      `computeCreditLine: numericScore must be in [0,100], got ${numericScore}`,
    );
  }
  const multiplier = multiplierForGrade(letterGrade);
  const effectiveDailyLimitCents = Math.round(baseDailyLimitCents * multiplier);
  return {
    letterGrade,
    numericScore,
    multiplier,
    baseDailyLimitCents,
    effectiveDailyLimitCents,
    framing: framingForGrade(letterGrade),
  };
}

// ── Network primitives ─────────────────────────────────────────────

export async function fetchCreditLine(deploymentUrl, agentId) {
  const url = `${deploymentUrl}/api/identity/credit/${encodeURIComponent(agentId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

/**
 * THE TRUSTLESS LOOP CLOSURE for credit lines.
 *
 * Fetch a published credit line, recompute the effective limit
 * locally from (grade, base, multiplier), compare to the published
 * value. Returns `{match: true}` if the platform's claim is
 * mathematically correct; `{match: false}` if they differ.
 *
 * After R42, the platform CANNOT lie about credit lines while this
 * verifier is running. Same trustless primitive as R34/R37/R38/R41.
 */
export async function verifyCreditLineLocally(deploymentUrl, agentId) {
  const data = await fetchCreditLine(deploymentUrl, agentId);
  if (!data || !data.creditLine) {
    return {
      match: null,
      agentId,
      deploymentUrl,
      note:
        data && data.note
          ? data.note
          : "No credit line published yet for this agent.",
      verificationRanLocally: true,
    };
  }
  const published = data.creditLine;
  const recomputed = computeCreditLine({
    letterGrade: published.letterGrade,
    numericScore: published.numericScore,
    baseDailyLimitCents: published.baseDailyLimitCents,
  });
  const match =
    recomputed.effectiveDailyLimitCents === published.effectiveDailyLimitCents &&
    recomputed.multiplier === published.multiplier;
  return {
    match,
    agentId,
    deploymentUrl,
    published: {
      letterGrade: published.letterGrade,
      numericScore: published.numericScore,
      multiplier: published.multiplier,
      baseDailyLimitCents: published.baseDailyLimitCents,
      effectiveDailyLimitCents: published.effectiveDailyLimitCents,
    },
    recomputed: {
      multiplier: recomputed.multiplier,
      effectiveDailyLimitCents: recomputed.effectiveDailyLimitCents,
      framing: recomputed.framing,
    },
    verificationRanLocally: true,
    note: match
      ? "Published credit line matches local recompute. The platform's claim is mathematically correct."
      : "MISMATCH — published credit line differs from local recompute. Credit line is fabricated.",
  };
}

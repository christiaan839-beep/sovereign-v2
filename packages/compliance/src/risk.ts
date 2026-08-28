/**
 * Risk-register scoring, shared by the standards that ask the operator
 * to declare risks rather than work a fixed catalogue — ISO/IEC 23894
 * and the GDPR Article 35 DPIA.
 *
 * The arithmetic is ISO 31000's 5×5 likelihood × impact matrix, banded
 * to five levels, then attenuated by how much receipt evidence backs
 * the declared treatment. Attenuation is coarse on purpose: evidence
 * shows a control is *operating*, which is worth a band or two, and
 * pretending to more precision than that would be false comfort.
 *
 * @packageDocumentation
 */

import type { ReceiptLike } from "./types.js";
import { tallyEvidence } from "./engine.js";

/** ISO 31000 likelihood scale. */
export type Likelihood =
  | "rare"
  | "unlikely"
  | "possible"
  | "likely"
  | "almost-certain";

/** ISO 31000 impact scale. */
export type Impact =
  | "negligible"
  | "minor"
  | "moderate"
  | "major"
  | "catastrophic";

/** Banded risk level. */
export type RiskLevel = "very-low" | "low" | "medium" | "high" | "extreme";

/** Risk treatment options per ISO 31000 § 6.5. */
export type Treatment = "avoid" | "reduce" | "share" | "accept";

/** Bands, worst last. Exported so callers can sort or compare. */
export const RISK_LEVELS: readonly RiskLevel[] = [
  "very-low",
  "low",
  "medium",
  "high",
  "extreme",
] as const;

/** One operator-declared risk. */
export interface RiskScenario {
  /** Stable id, unique within the register. */
  id: string;
  /** Plain-language description. */
  description: string;
  /** Risk source (e.g. "prompt injection", "model drift"). */
  source: string;
  likelihood: Likelihood;
  impact: Impact;
  treatment: Treatment;
  /** What the treatment actually is. */
  treatmentDescription: string;
  /** Guardian pack prefixes whose receipts evidence the treatment working. */
  evidencePackPrefixes: string[];
  /**
   * Free-form classification the standard needs but the engine does
   * not interpret — a trustworthy-AI characteristic, a GDPR right
   * affected, a data category.
   */
  meta?: Record<string, string>;
}

/** A scenario with its computed levels. */
export interface ScoredScenario extends RiskScenario {
  /** Level before any evidence of treatment. */
  inherentRisk: RiskLevel;
  /** Receipts evidencing the treatment. */
  evidenceCount: number;
  /** Distinct UTC days that evidence spans. */
  daysOfCoverage: number;
  /** Level after evidence attenuation. */
  residualRisk: RiskLevel;
}

const LIKELIHOOD_INDEX: Record<Likelihood, number> = {
  rare: 0,
  unlikely: 1,
  possible: 2,
  likely: 3,
  "almost-certain": 4,
};

const IMPACT_INDEX: Record<Impact, number> = {
  negligible: 0,
  minor: 1,
  moderate: 2,
  major: 3,
  catastrophic: 4,
};

/**
 * Band a likelihood × impact pair.
 *
 *   ┌──────────────┬──────────────────────────────────────────────┐
 *   │              │ Negligible  Minor   Moderate  Major  Catastr.│
 *   ├──────────────┼──────────────────────────────────────────────┤
 *   │ Almost cert. │ low         medium  high      extreme extreme│
 *   │ Likely       │ low         medium  high      high    extreme│
 *   │ Possible     │ very-low    low     medium    high    extreme│
 *   │ Unlikely     │ very-low    low     low       medium  high   │
 *   │ Rare         │ very-low    very-low low      medium  high   │
 *   └──────────────┴──────────────────────────────────────────────┘
 */
export function scoreRisk(likelihood: Likelihood, impact: Impact): RiskLevel {
  const s = LIKELIHOOD_INDEX[likelihood] + IMPACT_INDEX[impact];
  if (s >= 7) return "extreme";
  if (s >= 5) return "high";
  if (s >= 3) return "medium";
  if (s >= 1) return "low";
  return "very-low";
}

/**
 * Shift a level down by how much evidence backs the treatment.
 *
 * Under 10 receipts moves nothing, 10 or more moves one band, 100 or
 * more moves two. Deliberately blunt, and deliberately capped: no
 * volume of receipts turns an extreme risk into a low one.
 */
export function attenuate(inherent: RiskLevel, evidenceCount: number): RiskLevel {
  const idx = RISK_LEVELS.indexOf(inherent);
  const shift = evidenceCount >= 100 ? 2 : evidenceCount >= 10 ? 1 : 0;
  return RISK_LEVELS[Math.max(0, idx - shift)]!;
}

/**
 * Score a whole register against a receipt set.
 *
 * Throws on a duplicate scenario id — two rows sharing an id in a risk
 * register means one of them is invisible in every downstream table.
 */
export function scoreRiskRegister(
  scenarios: readonly RiskScenario[],
  receipts: readonly ReceiptLike[],
): ScoredScenario[] {
  const seen = new Set<string>();
  for (const s of scenarios) {
    if (seen.has(s.id)) {
      throw new Error(
        `scoreRiskRegister: duplicate scenario id "${s.id}". Scenario ids must be unique.`,
      );
    }
    seen.add(s.id);
  }

  return scenarios.map((s) => {
    const tally = tallyEvidence(receipts, s.evidencePackPrefixes);
    const inherentRisk = scoreRisk(s.likelihood, s.impact);
    return {
      ...s,
      inherentRisk,
      evidenceCount: tally.count,
      daysOfCoverage: tally.daysOfCoverage,
      residualRisk: attenuate(inherentRisk, tally.count),
    };
  });
}

/** Count scenarios per residual band. */
export function summariseRegister(scored: readonly ScoredScenario[]): {
  byResidualLevel: Record<RiskLevel, number>;
  scenariosTotal: number;
  highOrWorseInherent: number;
  highOrWorseResidual: number;
  untreated: number;
} {
  const byResidualLevel: Record<RiskLevel, number> = {
    "very-low": 0,
    low: 0,
    medium: 0,
    high: 0,
    extreme: 0,
  };
  let highOrWorseInherent = 0;
  let highOrWorseResidual = 0;
  let untreated = 0;

  for (const s of scored) {
    byResidualLevel[s.residualRisk]++;
    if (s.inherentRisk === "high" || s.inherentRisk === "extreme") {
      highOrWorseInherent++;
    }
    if (s.residualRisk === "high" || s.residualRisk === "extreme") {
      highOrWorseResidual++;
    }
    if (s.evidenceCount === 0) untreated++;
  }

  return {
    byResidualLevel,
    scenariosTotal: scored.length,
    highOrWorseInherent,
    highOrWorseResidual,
    untreated,
  };
}

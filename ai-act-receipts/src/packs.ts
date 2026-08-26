/**
 * EU AI Act Guardian rule pack.
 *
 * Three rules, each citing the article it enforces, so an auditor can
 * map verdict → regulation 1:1 without asking you what a rule meant.
 *
 * Scope, stated plainly: these are heuristics over the model's text
 * output. They catch the three failure modes that are mechanically
 * detectable — a high-risk output that never says it came from an AI,
 * one with no route to a human, one with no accuracy claim. They do
 * not and cannot determine whether your system is high-risk under
 * Annex III, whether your risk-management system satisfies Article 9,
 * or whether you are compliant. A `pass` here means "these three
 * checks found nothing", not "this is lawful".
 *
 * Rules run in parallel and never throw — a rule that raises becomes a
 * `warn` carrying the error message. See `runGuardian`.
 *
 * Extracted from the Sovereign Matrix Guardian pack library. Apache 2.0.
 *
 * @packageDocumentation
 */

import type { GuardianRule } from "./guardian.js";

/** A named, citable set of rules. */
export interface GuardianPack {
  /** Stable slug. Lands in the Annex IV evidence table. */
  id: string;
  /** Human-readable name for report headers. */
  name: string;
  /** The specific regulatory clauses this pack enforces. */
  citation: string;
  rules: GuardianRule[];
}

function asText(o: unknown): string {
  if (o === null || o === undefined) return "";
  return typeof o === "string" ? o : JSON.stringify(o);
}

/**
 * Annex III high-risk use-case surface, approximated by subject matter.
 *
 * A deliberate over-match: it is better to warn on an output that
 * merely discusses hiring than to stay silent on one that decides it.
 * Narrow it for your own domain by composing your own pack.
 */
const HIGH_RISK_DOMAINS =
  /\b(credit scor|hir|employ(?:ment|er|ee)|admission|recruit|grading|exam|asylum|visa|deport|criminal|sentenc|paro|recidivism|biometric identif)/i;

export const euAiActRules: GuardianRule[] = [
  {
    id: "eu-ai-act-art13-ai-disclosure",
    description:
      "BLOCK outputs in high-risk domains that don't disclose they are AI-generated — EU AI Act Art. 13(1) + Art. 50",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (HIGH_RISK_DOMAINS.test(text)) {
        const hasDisclosure =
          /\bAI[-\s]?generated\b|\bproduced by (?:an? )?(?:AI|automated|algorithm)|\bautomated decision\b/i.test(
            text,
          );
        if (!hasDisclosure) {
          return {
            verdict: "block",
            reason:
              "EU AI Act Art. 13/50: high-risk AI output must disclose its AI-generated nature",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "eu-ai-act-art14-human-oversight-handoff",
    description:
      "WARN on high-risk outputs without a documented human-review pathway — EU AI Act Art. 14",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (HIGH_RISK_DOMAINS.test(text)) {
        const hasReview =
          /\b(review|appeal|contest|human (?:oversight|review|decision)|escalat|override)/i.test(
            text,
          );
        if (!hasReview) {
          return {
            verdict: "warn",
            reason:
              "EU AI Act Art. 14: high-risk AI output lacks human-oversight / appeal pathway",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "eu-ai-act-art15-accuracy-attestation",
    description:
      "WARN on high-risk outputs missing accuracy / confidence attestation — EU AI Act Art. 15",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (HIGH_RISK_DOMAINS.test(text)) {
        const hasMetric =
          /\bconfidence[-\s:]|accuracy[-\s:]|score[-\s:]\d|\bp[-\s]?value|threshold|tested against|benchmark/i.test(
            text,
          );
        if (!hasMetric) {
          return {
            verdict: "warn",
            reason:
              "EU AI Act Art. 15: high-risk AI output missing accuracy / confidence metric",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const euAiActPack: GuardianPack = {
  id: "eu-ai-act-2026",
  name: "EU AI Act — High-Risk System Obligations",
  citation:
    "Regulation (EU) 2024/1689 Art. 13 (transparency) + Art. 14 (human oversight) + Art. 15 (accuracy) + Art. 50 (disclosure)",
  rules: euAiActRules,
};

/**
 * Flatten packs into one rule list, first definition of an id winning.
 *
 * Deduplication is by rule id, so composing a pack with itself is a
 * no-op and overlapping packs don't double-charge the same finding.
 */
export function composePacks(...packs: GuardianPack[]): GuardianRule[] {
  const seen = new Set<string>();
  const out: GuardianRule[] = [];
  for (const p of packs) {
    for (const r of p.rules) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
}

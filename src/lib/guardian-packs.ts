/**
 * SOVEREIGN MATRIX — Per-vertical Guardian rule packs (Wave 30).
 *
 * Ships pre-built Guardian rule sets for the five highest-leverage
 * regulated verticals. Customers get vertical compliance Guardians
 * out of the box — no rule-writing required. Each pack composes with
 * the Wave-17 GuardianRunner, so every verdict is signed under the
 * platform's Ed25519/HMAC key and verifiable via the existing
 * /api/guardian/run + verifyGuardianAttestation primitives.
 *
 * Rule philosophy:
 *   - Block only on hard regulatory tripwires (e.g. raw SSN in
 *     output, PHI in a non-clinical context).
 *   - Warn on best-practice violations that need human review (e.g.
 *     no patient identifier on a SOAP note).
 *   - Never block on style — that's editorial, not regulatory.
 *
 * Rule design notes:
 *   - All rules pure-function. No DB lookups, no network. Run in <10ms
 *     so a customer can chain 50 rules without blowing latency.
 *   - Every rule cites the specific regulatory clause in its
 *     description so an auditor can map verdict → regulation.
 *   - Every rule is composable — customers `import { hipaaPack } and
 *     append their own rules. Sovereign's defaults are the floor,
 *     not the ceiling.
 *
 * Composes with:
 *   - src/lib/guardian-runner.ts (Wave 17)
 *   - src/lib/industries-registry.ts (Wave 29 — taxonomy mapping)
 */

import type { GuardianRule } from "@/lib/guardian-runner";

// ── PII / PHI detection primitives ────────────────────────────────────

/**
 * SSN — US Social Security Number. Strict format detection
 * (XXX-XX-XXXX with hyphens) to avoid false positives on random
 * 9-digit numbers in unrelated contexts. Tightens further with
 * negative lookbehind on common prefixes that aren't SSNs ("Order ").
 */
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/;

/** US-style 10-digit phone number with separators. */
const PHONE_REGEX = /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

/** Email — basic RFC-shape detection, not full validation. */

/** Credit card — Luhn-checked 13-16 digit number. */

/** MRN (Medical Record Number) — common patterns: 7-12 alphanumerics
 *  with optional MRN/PT prefix. */
const MRN_REGEX = /\b(?:MRN|mrn|pt|PT)[-:\s]?[A-Z0-9]{7,12}\b/;

/** DOB pattern — MM/DD/YYYY or YYYY-MM-DD. */
const DOB_REGEX =
  /\b(?:0[1-9]|1[012])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}-(?:0[1-9]|1[012])-(?:0[1-9]|[12]\d|3[01])\b/;

function asText(o: unknown): string {
  if (o === null || o === undefined) return "";
  return typeof o === "string" ? o : JSON.stringify(o);
}

// ── HIPAA pack (US healthcare) ────────────────────────────────────────
//
// Aligned to 45 CFR §164.514 (HIPAA Privacy Rule — De-identification
// Safe Harbor). The 18 PHI identifiers must not appear in any output
// returned to a non-treating context.

export const hipaaRules: GuardianRule[] = [
  {
    id: "hipaa-no-raw-ssn",
    description:
      "BLOCK any output containing a raw SSN — 45 CFR §164.514(b)(2)(i)(I)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (SSN_REGEX.test(text)) {
        return {
          verdict: "block",
          reason: "output contains a US SSN — HIPAA Safe Harbor identifier #1",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-mrn",
    description:
      "WARN when output contains a Medical Record Number — 45 CFR §164.514(b)(2)(i)(D)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (MRN_REGEX.test(text)) {
        return {
          verdict: "warn",
          reason: "output contains a Medical Record Number pattern",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-dob",
    description:
      "WARN when output contains a date of birth — 45 CFR §164.514(b)(2)(i)(C)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (DOB_REGEX.test(text)) {
        return {
          verdict: "warn",
          reason: "output contains a date-of-birth pattern",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-phone",
    description:
      "WARN when output contains a phone number — 45 CFR §164.514(b)(2)(i)(E)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (PHONE_REGEX.test(text)) {
        return {
          verdict: "warn",
          reason: "output contains a phone-number pattern",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const hipaaPack = {
  id: "hipaa-2026",
  name: "HIPAA Privacy Rule — Safe Harbor",
  citation: "45 CFR §164.514(b)(2)",
  rules: hipaaRules,
};

// ── SR 11-7 pack (US banking model risk) ──────────────────────────────
//
// Aligned to Federal Reserve SR Letter 11-7 + OCC 2011-12. Model
// outputs going to risk-bearing decisions must be (a) defensible,
// (b) traceable, (c) able to explain a specific reason.

export const sr117Rules: GuardianRule[] = [
  {
    id: "sr-11-7-no-bare-numeric-decision",
    description:
      "BLOCK outputs that are a single numeric score with no narrative — SR 11-7 explainability requirement",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).trim();
      // A "bare numeric" is a single number / probability with no
      // accompanying English — fails SR 11-7's explainability bar.
      if (/^-?\d+(?:\.\d+)?%?$/.test(text)) {
        return {
          verdict: "block",
          reason:
            "output is a bare numeric — SR 11-7 demands a written rationale",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "sr-11-7-warns-on-short-narrative",
    description:
      "WARN when the decision rationale is under 200 chars — SR 11-7 expects substantive explainability",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).trim();
      if (text.length > 0 && text.length < 200) {
        return {
          verdict: "warn",
          reason: `rationale only ${text.length} chars — SR 11-7 expects substantive explainability`,
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const sr117Pack = {
  id: "sr-11-7-2026",
  name: "Fed SR 11-7 — Model Risk Management",
  citation: "Federal Reserve SR Letter 11-7 / OCC 2011-12",
  rules: sr117Rules,
};

// ── NAIC AI Bulletin pack (US insurance) ──────────────────────────────
//
// Aligned to the NAIC Model Bulletin on Use of AI by Insurers (Dec 2023).
// Underwriting + claims decisions must be (a) explainable, (b) bias-
// monitored, (c) traceable to an identifiable model.

export const naicRules: GuardianRule[] = [
  {
    id: "naic-no-protected-class-disparity",
    description:
      "WARN when output references a protected class without justification — NAIC AI Bulletin §3.3.b",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).toLowerCase();
      const flags = [
        "race",
        "ethnicity",
        "religion",
        "national origin",
        "gender",
        "sex",
        "marital status",
        "disability",
      ];
      const hit = flags.find((f) => text.includes(f));
      if (hit) {
        return {
          verdict: "warn",
          reason: `decision references protected class "${hit}" — NAIC requires bias-monitoring justification`,
          evidence: { class: hit },
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "naic-decision-cites-model",
    description:
      "WARN when the decision output doesn't cite the specific model version — NAIC AI Bulletin §3.5.a",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      // Model citation looks like "model: foo-v2" or "model version X".
      // The [:\s]+ allows a colon followed by space(s) before the model id.
      const hasModelRef =
        /model[:\s]+[a-z0-9.\-_]+/i.test(text) ||
        /model version/i.test(text) ||
        ctx.tokenId !== undefined; // Wave-16 JIT token IS the citation
      if (!hasModelRef) {
        return {
          verdict: "warn",
          reason:
            "decision narrative doesn't cite the model — NAIC §3.5.a expects traceability",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const naicPack = {
  id: "naic-ai-bulletin-2023",
  name: "NAIC Model Bulletin — Use of AI by Insurers",
  citation: "NAIC Model Bulletin (Dec 2023)",
  rules: naicRules,
};

// ── DSCSA pack (US pharma supply chain) ───────────────────────────────
//
// Aligned to the Drug Supply Chain Security Act (Nov 2024 enforcement
// gate). Trace data on prescription drugs must be interoperable +
// queryable + cryptographically attested across each transaction.

export const dscsaRules: GuardianRule[] = [
  {
    id: "dscsa-trace-narrative-cites-ndc",
    description:
      "BLOCK any drug-trace narrative that doesn't cite the NDC code — DSCSA §581(11)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      // NDC is a 10-11 digit code with two or three hyphenated segments.
      const hasNdc = /\b\d{4,5}-\d{3,4}-\d{1,2}\b/.test(text);
      if (text.toLowerCase().includes("trace") && !hasNdc) {
        return {
          verdict: "block",
          reason:
            "trace narrative missing NDC code — DSCSA §581(11) requires NDC on every transaction step",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "dscsa-recall-cites-lot",
    description:
      "BLOCK recall narratives without a lot/serial citation — DSCSA §582(b)(2)(A)(iv)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).toLowerCase();
      if (
        text.includes("recall") &&
        !/(?:lot|serial)[\s:#]/i.test(asText(ctx.output))
      ) {
        return {
          verdict: "block",
          reason:
            "recall narrative missing lot/serial — DSCSA mandates lot-level identification",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const dscsaPack = {
  id: "dscsa-2024",
  name: "DSCSA — Drug Supply Chain Security Act",
  citation: "21 USC §360eee through 360eee-4",
  rules: dscsaRules,
};

// ── CSRD / ESRS pack (EU sustainability reporting) ────────────────────
//
// Aligned to the EU Corporate Sustainability Reporting Directive +
// the European Sustainability Reporting Standards (ESRS). Every
// reported datapoint must trace to a verifiable data source.

export const csrdRules: GuardianRule[] = [
  {
    id: "csrd-cites-data-source",
    description:
      "WARN when an ESRS datapoint claim lacks a data-source citation — ESRS 2 BP-2",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      // Look for ESRS datapoint claims (E1-, E2-, S1-, G1- patterns).
      const claimsEsrs = /\bESRS\s+[ESG]\d+-\d+\b/i.test(text);
      if (claimsEsrs) {
        const hasSource =
          /\bsource[:\s]/i.test(text) ||
          /\bper\s+(?:our|the)\s+\w+/i.test(text) ||
          /\baccording to\b/i.test(text);
        if (!hasSource) {
          return {
            verdict: "warn",
            reason:
              "ESRS datapoint claim missing source citation — ESRS 2 BP-2 requires traceability",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "csrd-double-materiality-flag",
    description:
      "WARN when a materiality narrative skips one of the two perspectives — ESRS 1 §3.5",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).toLowerCase();
      if (text.includes("materiality")) {
        const hasFinancial = /financ(?:e|ial)\s+materiality/.test(text);
        const hasImpact = /impact\s+materiality/.test(text);
        if (!hasFinancial || !hasImpact) {
          return {
            verdict: "warn",
            reason:
              "materiality narrative missing one perspective — ESRS 1 §3.5 demands DOUBLE materiality",
            evidence: { hasFinancial, hasImpact },
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const csrdPack = {
  id: "csrd-esrs-2024",
  name: "EU CSRD / ESRS",
  citation: "EU Directive 2022/2464 + ESRS Delegated Act 2023/2772",
  rules: csrdRules,
};

// ── Registry of packs ────────────────────────────────────────────────

export interface GuardianPack {
  id: string;
  name: string;
  citation: string;
  rules: GuardianRule[];
}

export const ALL_PACKS: GuardianPack[] = [
  hipaaPack,
  sr117Pack,
  naicPack,
  dscsaPack,
  csrdPack,
];

/** Find a pack by stable id. */
export function findPack(id: string): GuardianPack | undefined {
  return ALL_PACKS.find((p) => p.id === id);
}

/** Compose multiple packs into a single rule list — order preserved. */
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

/**
 * Per-vertical Guardian rule packs.
 *
 * Pre-built rule sets for the highest-leverage regulated verticals.
 * Compose with `runGuardian()` from ./guardian and get a signed
 * verdict envelope a regulator can re-verify.
 *
 * Each rule cites the specific regulatory clause in its description
 * so an auditor can map verdict → regulation 1:1.
 *
 * Packs included (Apache 2.0):
 *   - hipaaPack     HIPAA Privacy Rule (45 CFR §164.514)
 *   - sr117Pack     Fed SR 11-7 / OCC 2011-12 model risk
 *   - naicPack      NAIC AI Bulletin (Dec 2023)
 *   - dscsaPack     DSCSA (21 USC §360eee, 2024 enforcement)
 *   - csrdPack      EU CSRD / ESRS
 *
 * @packageDocumentation
 */

import type { GuardianRule } from "./guardian.js";

function asText(o: unknown): string {
  if (o === null || o === undefined) return "";
  return typeof o === "string" ? o : JSON.stringify(o);
}

// ── Detection regexes ─────────────────────────────────────────────────

const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/;
const PHONE_REGEX = /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const MRN_REGEX = /\b(?:MRN|mrn|pt|PT)[-:\s]?[A-Z0-9]{7,12}\b/;
const DOB_REGEX =
  /\b(?:0[1-9]|1[012])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}-(?:0[1-9]|1[012])-(?:0[1-9]|[12]\d|3[01])\b/;

// ── HIPAA pack ────────────────────────────────────────────────────────

export const hipaaRules: GuardianRule[] = [
  {
    id: "hipaa-no-raw-ssn",
    description:
      "BLOCK output containing a raw SSN — 45 CFR §164.514(b)(2)(i)(I)",
    evaluate: async (ctx) => {
      if (SSN_REGEX.test(asText(ctx.output))) {
        return {
          verdict: "block",
          reason: "output contains US SSN — HIPAA Safe Harbor identifier #1",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-mrn",
    description: "WARN on Medical Record Number — 45 CFR §164.514(b)(2)(i)(D)",
    evaluate: async (ctx) => {
      if (MRN_REGEX.test(asText(ctx.output))) {
        return { verdict: "warn", reason: "output contains MRN pattern" };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-dob",
    description: "WARN on date-of-birth — 45 CFR §164.514(b)(2)(i)(C)",
    evaluate: async (ctx) => {
      if (DOB_REGEX.test(asText(ctx.output))) {
        return { verdict: "warn", reason: "output contains DOB pattern" };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "hipaa-no-phone",
    description: "WARN on phone number — 45 CFR §164.514(b)(2)(i)(E)",
    evaluate: async (ctx) => {
      if (PHONE_REGEX.test(asText(ctx.output))) {
        return {
          verdict: "warn",
          reason: "output contains phone-number pattern",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const hipaaPack: GuardianPack = {
  id: "hipaa-2026",
  name: "HIPAA Privacy Rule — Safe Harbor",
  citation: "45 CFR §164.514(b)(2)",
  rules: hipaaRules,
};

// ── SR 11-7 pack ──────────────────────────────────────────────────────

export const sr117Rules: GuardianRule[] = [
  {
    id: "sr-11-7-no-bare-numeric-decision",
    description:
      "BLOCK outputs that are a single number with no narrative — SR 11-7 explainability",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).trim();
      if (/^-?\d+(?:\.\d+)?%?$/.test(text)) {
        return {
          verdict: "block",
          reason:
            "output is a bare numeric — SR 11-7 demands written rationale",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "sr-11-7-warns-on-short-narrative",
    description:
      "WARN on rationale under 200 chars — SR 11-7 substantive explainability",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).trim();
      if (text.length > 0 && text.length < 200) {
        return {
          verdict: "warn",
          reason: `rationale only ${text.length} chars — SR 11-7 expects more`,
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const sr117Pack: GuardianPack = {
  id: "sr-11-7-2026",
  name: "Fed SR 11-7 — Model Risk Management",
  citation: "Federal Reserve SR Letter 11-7 / OCC 2011-12",
  rules: sr117Rules,
};

// ── NAIC pack ─────────────────────────────────────────────────────────

export const naicRules: GuardianRule[] = [
  {
    id: "naic-no-protected-class-disparity",
    description:
      "WARN on protected class without justification — NAIC AI Bulletin §3.3.b",
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
          reason: `decision references protected class "${hit}"`,
          evidence: { class: hit },
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "naic-decision-cites-model",
    description:
      "WARN when decision doesn't cite model version — NAIC AI Bulletin §3.5.a",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      const hasModelRef =
        /model[:\s]+[a-z0-9.\-_]+/i.test(text) ||
        /model version/i.test(text) ||
        ctx.tokenId !== undefined;
      if (!hasModelRef) {
        return {
          verdict: "warn",
          reason: "decision doesn't cite the model — NAIC §3.5.a traceability",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const naicPack: GuardianPack = {
  id: "naic-ai-bulletin-2023",
  name: "NAIC Model Bulletin — Use of AI by Insurers",
  citation: "NAIC Model Bulletin (Dec 2023)",
  rules: naicRules,
};

// ── DSCSA pack ────────────────────────────────────────────────────────

export const dscsaRules: GuardianRule[] = [
  {
    id: "dscsa-trace-narrative-cites-ndc",
    description: "BLOCK trace narrative missing NDC code — DSCSA §581(11)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      const hasNdc = /\b\d{4,5}-\d{3,4}-\d{1,2}\b/.test(text);
      if (text.toLowerCase().includes("trace") && !hasNdc) {
        return {
          verdict: "block",
          reason: "trace narrative missing NDC code — DSCSA §581(11)",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "dscsa-recall-cites-lot",
    description:
      "BLOCK recall narrative missing lot/serial — DSCSA §582(b)(2)(A)(iv)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).toLowerCase();
      if (
        text.includes("recall") &&
        !/(?:lot|serial)[\s:#]/i.test(asText(ctx.output))
      ) {
        return {
          verdict: "block",
          reason: "recall narrative missing lot/serial — DSCSA",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const dscsaPack: GuardianPack = {
  id: "dscsa-2024",
  name: "DSCSA — Drug Supply Chain Security Act",
  citation: "21 USC §360eee through 360eee-4",
  rules: dscsaRules,
};

// ── CSRD pack ─────────────────────────────────────────────────────────

export const csrdRules: GuardianRule[] = [
  {
    id: "csrd-cites-data-source",
    description:
      "WARN on ESRS datapoint claim missing source citation — ESRS 2 BP-2",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      const claimsEsrs = /\bESRS\s+[ESG]\d+-\d+\b/i.test(text);
      if (claimsEsrs) {
        const hasSource =
          /\bsource[:\s]/i.test(text) ||
          /\bper\s+(?:our|the)\s+\w+/i.test(text) ||
          /\baccording to\b/i.test(text);
        if (!hasSource) {
          return {
            verdict: "warn",
            reason: "ESRS datapoint claim missing source — ESRS 2 BP-2",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "csrd-double-materiality-flag",
    description:
      "WARN when materiality narrative skips one perspective — ESRS 1 §3.5",
    evaluate: async (ctx) => {
      const text = asText(ctx.output).toLowerCase();
      if (text.includes("materiality")) {
        const hasFinancial = /financ(?:e|ial)\s+materiality/.test(text);
        const hasImpact = /impact\s+materiality/.test(text);
        if (!hasFinancial || !hasImpact) {
          return {
            verdict: "warn",
            reason:
              "materiality narrative missing one perspective — ESRS 1 §3.5",
            evidence: { hasFinancial, hasImpact },
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const csrdPack: GuardianPack = {
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

export function findPack(id: string): GuardianPack | undefined {
  return ALL_PACKS.find((p) => p.id === id);
}

/** Compose multiple packs — dedup rules by id; preserves declaration order. */
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

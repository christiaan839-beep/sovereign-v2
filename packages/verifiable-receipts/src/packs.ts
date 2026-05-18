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

// ── CFPB pack — Consumer Financial Protection Bureau ──────────────────

// Adverse-action notice triggers per ECOA + 12 CFR §1002.9. When an
// AI agent denies / counter-offers credit, the receipt MUST carry an
// adverse-action explanation. This pack flags missing rationale.
const ADVERSE_ACTION_VERBS =
  /\b(deny|denied|reject|decline|counter[-\s]?offer)\b/i;
const PROTECTED_CLASS_TERMS =
  /\b(race|color|religion|national origin|sex|gender|marital|familial|age(?:\s+\d+)?|disability|disabled)\b/i;

export const cfpbRules: GuardianRule[] = [
  {
    id: "cfpb-adverse-action-rationale",
    description:
      "BLOCK adverse credit decisions without a specific reason — 12 CFR §1002.9(a)(2)(i) (ECOA)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (ADVERSE_ACTION_VERBS.test(text)) {
        // Must carry at least one principal reason for the decision.
        // Heuristic: presence of an "because"/"due to"/"reason" anchor +
        // some non-trivial follow-up. Real implementations should
        // require a structured `reasons: string[]` field.
        const hasRationale =
          /\b(because|due to|reason\(s?\)?\s*:|principal\s+reason)\b/i.test(
            text,
          );
        if (!hasRationale) {
          return {
            verdict: "block",
            reason:
              "ECOA §1002.9: adverse credit action requires specific reason(s)",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "cfpb-no-protected-class-as-factor",
    description:
      "BLOCK credit decisions that cite a protected class as a factor — 12 CFR §1002.4 + ECOA §701",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (ADVERSE_ACTION_VERBS.test(text) && PROTECTED_CLASS_TERMS.test(text)) {
        return {
          verdict: "block",
          reason:
            "ECOA §701: credit decision references a protected class (race/sex/religion/etc.)",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "cfpb-ufmip-disclosure",
    description:
      "WARN on mortgage outputs missing APR / UDAAP boilerplate — 12 CFR §1024 + §1026",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (/\b(mortgage|home loan|HELOC|refinance)\b/i.test(text)) {
        const hasApr = /\bAPR\b|\bannual percentage rate\b/i.test(text);
        if (!hasApr) {
          return {
            verdict: "warn",
            reason: "Mortgage output missing APR disclosure (Reg Z §1026.24)",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const cfpbPack: GuardianPack = {
  id: "cfpb-2026",
  name: "CFPB — ECOA + Reg Z",
  citation: "12 CFR §1002 (ECOA) + 12 CFR §1024 / §1026 (RESPA / Reg Z)",
  rules: cfpbRules,
};

// ── MAS pack — Singapore Monetary Authority FEAT principles ───────────

// MAS 2018 "Principles to Promote Fairness, Ethics, Accountability and
// Transparency (FEAT) in the Use of AI and Data Analytics in Singapore's
// Financial Sector." Plus PDPA disclosure rules for personal data.
const SINGAPORE_NRIC_REGEX = /\b[STFG]\d{7}[A-Z]\b/;

export const masRules: GuardianRule[] = [
  {
    id: "mas-feat-traceability",
    description:
      "WARN when financial decisions lack model + data-source traceability — MAS FEAT §F.4",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(approve|deny|decline|recommend|advise|invest|loan|insurance|premium)\b/i.test(
          text,
        )
      ) {
        // FEAT requires the audit trail to show WHICH model + WHICH data
        // produced the decision. Receipts that carry only the verdict
        // without `modelUsed` lineage fail traceability.
        if (!ctx.modelUsed || ctx.modelUsed === "unknown") {
          return {
            verdict: "warn",
            reason:
              "MAS FEAT §F.4: financial decision lacks model lineage in receipt",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "mas-pdpa-no-raw-nric",
    description:
      "BLOCK output containing a Singapore NRIC — PDPA §13 / Advisory Guidelines on NRIC",
    evaluate: async (ctx) => {
      if (SINGAPORE_NRIC_REGEX.test(asText(ctx.output))) {
        return {
          verdict: "block",
          reason:
            "PDPA: output contains a Singapore NRIC pattern — collect or redact only under §17",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "mas-feat-bias-attestation",
    description:
      "WARN when financial decisions omit a bias / protected-class attestation — MAS FEAT §F.3",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(approve|deny|decline|insurance|premium|loan)\b/i.test(text) &&
        !/\bbias[-\s]?(check|attestation|review)|\bprotected[-\s]?class\b|\bfair(?:ness)?\s+(?:check|review)\b/i.test(
          text,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "MAS FEAT §F.3: financial decision missing bias/fairness attestation",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const masPack: GuardianPack = {
  id: "mas-feat-2026",
  name: "MAS FEAT Principles + PDPA",
  citation:
    "MAS FEAT 2018 + Singapore PDPA (Personal Data Protection Act 2012)",
  rules: masRules,
};

// ── FCA pack — UK Financial Conduct Authority ─────────────────────────

// FCA Consumer Duty (PRIN 2A) + FG24/2 AI guidance + SYSC 8.1 outsourcing.
// Most-relevant for retail banking / insurance / investment-advice AI.

export const fcaRules: GuardianRule[] = [
  {
    id: "fca-consumer-duty-good-outcomes",
    description:
      "WARN when output suggests poor consumer outcome without rationale — FCA PRIN 2A.1 (Consumer Duty)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      // Heuristic: detection of pushy / opaque language that the
      // Consumer Duty's "good outcomes" test would flag.
      const pushy =
        /\b(must|need to|urgent|limited time|act now|today only|exclusive offer)\b/i.test(
          text,
        );
      const hasJustification =
        /\b(because|the reason|benefit to you|in your interest|consumer outcome)\b/i.test(
          text,
        );
      if (pushy && !hasJustification) {
        return {
          verdict: "warn",
          reason:
            "FCA PRIN 2A: high-pressure language without consumer-outcome justification",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fca-vulnerable-customer-flag",
    description:
      "WARN on outputs handling potentially vulnerable customers without an adjustment note — FCA FG21/1",
    evaluate: async (ctx) => {
      const inputText = asText(ctx.input).toLowerCase();
      const outputText = asText(ctx.output).toLowerCase();
      const vulnSignals =
        /\b(bereav|dement|carer|mental health|disabled|disability|pensioner|terminally ill|cancer)/;
      if (
        vulnSignals.test(inputText) &&
        !/\bvulnerable|\badjustment|\benhanced (?:support|disclosure)\b/.test(
          outputText,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "FCA FG21/1: input flags potential vulnerability but output has no adjustment note",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fca-sysc-ai-explainability",
    description:
      "WARN on financial AI outputs without an explainability anchor — FCA FG24/2 §3.2",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(approv|den[iy]|reject|recommend|trade|invest|premium|claim)/i.test(
          text,
        )
      ) {
        if (
          !/\bbecause|due to|rationale|reason\(s?\)?:|factors? considered\b/i.test(
            text,
          )
        ) {
          return {
            verdict: "warn",
            reason:
              "FCA FG24/2: financial AI decision lacks per-decision explanation",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const fcaPack: GuardianPack = {
  id: "fca-consumer-duty-2026",
  name: "FCA Consumer Duty + AI Guidance",
  citation:
    "FCA PRIN 2A (Consumer Duty) + FG24/2 (AI in Financial Services) + FG21/1 (Vulnerable Customers)",
  rules: fcaRules,
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
  cfpbPack,
  masPack,
  fcaPack,
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

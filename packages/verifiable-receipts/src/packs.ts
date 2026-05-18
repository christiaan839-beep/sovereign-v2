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

// ── PCI DSS pack — Payment Card Industry Data Security Standard ───────

// PCI DSS v4.0 §3.5.1 — Primary Account Number (PAN) must be rendered
// unreadable anywhere it is stored. AI agents that handle payment
// data MUST NOT emit a full PAN in outputs. Standard masks: keep first
// 6 + last 4, mask the middle.
const PAN_REGEX_VISA = /\b4\d{12}(?:\d{3})?\b/; // Visa: 13 or 16 digits starting with 4
const PAN_REGEX_MASTERCARD = /\b5[1-5]\d{14}\b/; // Mastercard: 16 digits starting with 51-55
const PAN_REGEX_AMEX = /\b3[47]\d{13}\b/; // Amex: 15 digits starting with 34 or 37
const PAN_REGEX_DISCOVER = /\b6(?:011|5\d{2})\d{12}\b/; // Discover
const CVV_REGEX = /\b(?:CVV|CVC|CV2|CID)[-:\s]*\d{3,4}\b/i;

function hasFullPan(text: string): boolean {
  return (
    PAN_REGEX_VISA.test(text) ||
    PAN_REGEX_MASTERCARD.test(text) ||
    PAN_REGEX_AMEX.test(text) ||
    PAN_REGEX_DISCOVER.test(text)
  );
}

export const pciDssRules: GuardianRule[] = [
  {
    id: "pci-dss-no-full-pan",
    description:
      "BLOCK output containing a full Primary Account Number — PCI DSS v4.0 §3.5.1",
    evaluate: async (ctx) => {
      if (hasFullPan(asText(ctx.output))) {
        return {
          verdict: "block",
          reason:
            "PCI DSS §3.5.1: output contains a full PAN — must be masked (first6 + last4)",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "pci-dss-no-cvv",
    description:
      "BLOCK output containing a CVV / CVC / CID — PCI DSS v4.0 §3.3.1 (CAV2/CVC2/CVV2/CID never stored after authorization)",
    evaluate: async (ctx) => {
      if (CVV_REGEX.test(asText(ctx.output))) {
        return {
          verdict: "block",
          reason:
            "PCI DSS §3.3.1: output contains card verification value — MUST NOT be retained or emitted",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "pci-dss-no-track-data",
    description:
      "BLOCK output containing full magnetic stripe / track data — PCI DSS v4.0 §3.3.1.1",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      // Track 1: ^B<pan>^<name>^<exp><svc><discretionary>?
      // Track 2: ;<pan>=<exp><svc><discretionary>?
      const track1 = /\^B\d{13,19}\^/;
      const track2 = /;\d{13,19}=\d{4}/;
      if (track1.test(text) || track2.test(text)) {
        return {
          verdict: "block",
          reason:
            "PCI DSS §3.3.1.1: output contains card track data — never retained after authorization",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const pciDssPack: GuardianPack = {
  id: "pci-dss-v4-2026",
  name: "PCI DSS v4.0",
  citation: "Payment Card Industry Data Security Standard v4.0 §3.3 / §3.5",
  rules: pciDssRules,
};

// ── EU AI Act pack — high-risk AI system obligations ──────────────────

// Regulation (EU) 2024/1689. Articles 13 (transparency), 14 (human
// oversight), 15 (accuracy + robustness), and Annex III (high-risk
// use cases). The rules below trip on outputs from high-risk AI
// systems (credit scoring, employment, education, law enforcement,
// migration, justice administration) that violate disclosure or
// oversight obligations.
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

// ── NYDFS Part 500 pack — NY State financial cybersecurity ────────────

// 23 NYCRR Part 500 — Cybersecurity Requirements for Financial Services
// Companies. Plus AI-specific guidance from the NYDFS Industry Letter
// (Oct 2024) on AI-related cybersecurity risks. Per-decision applicable
// to AI outputs in NY-regulated financial workflows.

export const nydfsRules: GuardianRule[] = [
  {
    id: "nydfs-500-multi-factor-recommendation",
    description:
      "WARN on authentication-related outputs that don't reference MFA — 23 NYCRR §500.12",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(login|authentic|access (?:control|grant)|password|credential)/i.test(
          text,
        ) &&
        !/\bmulti[-\s]?factor|MFA|two[-\s]?factor|2FA|step[-\s]?up\b/i.test(
          text,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "NYDFS Part 500 §500.12: authentication output lacks MFA reference",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "nydfs-ai-letter-third-party-attestation",
    description:
      "WARN when AI output relies on third-party data without attestation — NYDFS Industry Letter (Oct 2024) §IV",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(third[-\s]?party|vendor|external (?:data|source|api)|integration)/i.test(
          text,
        ) &&
        !/\battest|certif|verif|due[-\s]?dilig|source[-\s]?validation/i.test(
          text,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "NYDFS AI Letter §IV: third-party data dependency lacks attestation / verification note",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "nydfs-500-incident-trigger-language",
    description:
      "WARN on outputs describing potential incidents without filing-window reminder — 23 NYCRR §500.17",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\b(breach|compromise|unauthorized access|data exfiltr|incident|intrusion)/i.test(
          text,
        ) &&
        !/\b72[-\s]?hour|reportab(?:le|ility)|file (?:with|to) (?:NYDFS|the superintendent)\b/i.test(
          text,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "NYDFS Part 500 §500.17: incident-related output missing 72h filing reminder",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const nydfsPack: GuardianPack = {
  id: "nydfs-500-2026",
  name: "NYDFS Part 500 + AI Industry Letter",
  citation:
    "23 NYCRR Part 500 (Cybersecurity Requirements for Financial Services Companies) + NYDFS Industry Letter on AI (Oct 2024)",
  rules: nydfsRules,
};

// ── NYC AEDT pack — NYC Local Law 144 (Automated Employment Decision Tools) ──

// Effective July 5, 2023. Every "automated employment decision tool"
// (AEDT) used to substantially assist a hiring or promotion decision
// for a NYC-based candidate or employee MUST: (1) have an annual
// independent bias audit, (2) give candidates 10 business days
// notice + an alternative process, (3) post a bias-audit summary
// publicly. Receipts from such tools should record the compliance
// signals so a Department of Consumer and Worker Protection (DCWP)
// inspector can audit per-decision.

const HIRING_DECISION_TERMS =
  /\b(hir|interview|shortlist|reject|advance|reject candidate|move forward|disqualif|recommend for promotion|promote)/i;

export const nycAedtRules: GuardianRule[] = [
  {
    id: "nyc-aedt-bias-audit-attestation",
    description:
      "WARN on hiring decisions issued without a bias-audit attestation in the receipt — NYC Local Law 144 §20-871",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (HIRING_DECISION_TERMS.test(text)) {
        const hasAttestation =
          /\bbias[-\s]?audit(?:ed)?\b|\baudit (?:date|completed|reference)|\bDCWP[-\s]?audit/i.test(
            text,
          );
        if (!hasAttestation) {
          return {
            verdict: "warn",
            reason:
              "NYC Local Law 144 §20-871: AEDT output lacks bias-audit attestation reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "nyc-aedt-candidate-notice",
    description:
      "WARN on hiring decisions issued without candidate-notice attestation — NYC Local Law 144 §20-870",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (HIRING_DECISION_TERMS.test(text)) {
        const hasNotice =
          /\bnotice[-\s]?(?:given|provided|sent)|\b10[-\s]?(?:business[-\s]?)?day|\bcandidate (?:notice|notification)|\balternative process/i.test(
            text,
          );
        if (!hasNotice) {
          return {
            verdict: "warn",
            reason:
              "NYC Local Law 144 §20-870: AEDT output lacks candidate-notice / 10-business-day acknowledgement",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "nyc-aedt-protected-class-in-output",
    description:
      "BLOCK AEDT output that surfaces a candidate's protected class as a decision factor — NYC Local Law 144 §20-871(b) + EEOC Title VII",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        HIRING_DECISION_TERMS.test(text) &&
        PROTECTED_CLASS_TERMS.test(text)
      ) {
        return {
          verdict: "block",
          reason:
            "NYC Local Law 144 / EEOC Title VII: AEDT decision references a protected class (race/sex/religion/age/etc.)",
        };
      }
      return { verdict: "pass" };
    },
  },
];

export const nycAedtPack: GuardianPack = {
  id: "nyc-aedt-2026",
  name: "NYC AEDT — Local Law 144",
  citation:
    "NYC Local Law 144 (2021) §§20-870 to 20-874 (Automated Employment Decision Tools) + EEOC Title VII",
  rules: nycAedtRules,
};

// ── FERPA pack — US student records ───────────────────────────────────

// Family Educational Rights and Privacy Act (20 USC §1232g + 34 CFR
// Part 99). Applies to any institution receiving Department of
// Education funds. AI agents that touch student records MUST NOT
// disclose education records or PII without consent (or via documented
// exceptions like school-official, directory-info-with-opt-out).

const STUDENT_TERMS =
  /\b(student|pupil|minor child|class[-\s]?of[-\s]?\d{4}|enroll|transcript|grade|GPA|matricul)/i;
const EDUCATIONAL_PII =
  /\b(SSN|social security|date of birth|home address|disciplin(?:ary|e)|guardian phone|parent email)/i;

export const ferpaRules: GuardianRule[] = [
  {
    id: "ferpa-no-student-pii-without-consent",
    description:
      "BLOCK output combining student identifier + sensitive PII without consent attestation — FERPA 34 CFR §99.30",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (STUDENT_TERMS.test(text) && EDUCATIONAL_PII.test(text)) {
        const hasConsent =
          /\bparental[-\s]?consent|\beligible[-\s]?student[-\s]?consent|\b(?:written|signed)[-\s]?consent|\bFERPA[-\s]?(?:exception|consent)/i.test(
            text,
          );
        if (!hasConsent) {
          return {
            verdict: "block",
            reason:
              "FERPA §99.30: educational record + PII disclosed without consent attestation",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "ferpa-directory-info-opt-out-check",
    description:
      "WARN when output discloses directory information without opt-out check — FERPA 34 CFR §99.37",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      const directoryInfo =
        /\b(name|email|telephone|honors|awards|enrollment status|dates of attendance|photograph)/i;
      if (
        STUDENT_TERMS.test(text) &&
        directoryInfo.test(text) &&
        !/\bopt[-\s]?out[-\s]?(?:check|verified|status)|\bdirectory[-\s]?disclosure[-\s]?allowed/i.test(
          text,
        )
      ) {
        return {
          verdict: "warn",
          reason:
            "FERPA §99.37: directory information disclosed without opt-out verification",
        };
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "ferpa-school-official-exception-rationale",
    description:
      "WARN when AI agent acts as a 'school official' without legitimate-educational-interest rationale — FERPA 34 CFR §99.31(a)(1)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (STUDENT_TERMS.test(text)) {
        const isInternal =
          /\bschool[-\s]?official|\binternal use|\beducational[-\s]?purpose/i.test(
            text,
          );
        const hasRationale =
          /\blegitimate[-\s]?educational[-\s]?interest|\binstructional[-\s]?need|\bsupport[-\s]?(?:learning|student)/i.test(
            text,
          );
        if (isInternal && !hasRationale) {
          return {
            verdict: "warn",
            reason:
              "FERPA §99.31(a)(1): school-official exception requires legitimate-educational-interest rationale",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const ferpaPack: GuardianPack = {
  id: "ferpa-2026",
  name: "FERPA — US Student Records",
  citation:
    "Family Educational Rights and Privacy Act (20 USC §1232g) + 34 CFR Part 99",
  rules: ferpaRules,
};

// ── FDA SaMD pack — Software as Medical Device ────────────────────────

// FDA's Software as Medical Device (SaMD) framework + the AI/ML
// Software as Medical Device Action Plan (Jan 2021). EU equivalent:
// MDR 2017/745 + IVDR 2017/746. AI agents that influence clinical
// decisions face higher diligence: intended-use statements, confidence
// disclosure, and human-in-the-loop language for prescriptive output.

const CLINICAL_TERMS =
  /\b(diagnos|prognos|treatment|prescri|dosing|dosage|clinical|patient[-\s]?care|medical[-\s]?advice|interpret[-\s]?(?:scan|image|x-ray|MRI|CT))/i;
const PRESCRIPTIVE_TERMS =
  /\b(prescribe|administer|inject|dispense|start[-\s]?therapy|begin[-\s]?treatment|initiate[-\s]?(?:dose|treatment))/i;

export const fdaSaMDRules: GuardianRule[] = [
  {
    id: "fda-samd-intended-use-statement",
    description:
      "WARN on clinical-decision output missing intended-use statement — FDA SaMD framework + 21 CFR §807.87",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (CLINICAL_TERMS.test(text)) {
        const hasIntendedUse =
          /\bintended[-\s]?use|\bindicat(?:ed|ion)[-\s]?for|\bfor[-\s]?clinician[-\s]?(?:review|use)|\bdecision[-\s]?support[-\s]?only/i.test(
            text,
          );
        if (!hasIntendedUse) {
          return {
            verdict: "warn",
            reason:
              "FDA SaMD: clinical output lacks intended-use / decision-support qualifier",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fda-samd-confidence-disclosure",
    description:
      "WARN on AI/ML clinical output without confidence / uncertainty disclosure — FDA AI/ML SaMD Action Plan §4",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (CLINICAL_TERMS.test(text)) {
        const hasConfidence =
          /\bconfidence[-\s]?(?:interval|score|level)|\baccuracy[-\s]?(?:rate|metric)|\bsensitivity[-\s]?\d|\bspecificity[-\s]?\d|\buncertainty[-\s]?(?:range|bounds)/i.test(
            text,
          );
        if (!hasConfidence) {
          return {
            verdict: "warn",
            reason:
              "FDA AI/ML SaMD Action Plan §4: clinical AI output missing confidence / uncertainty disclosure",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fda-samd-no-direct-prescription",
    description:
      "BLOCK output that issues a prescription / dosing decision without human-in-the-loop qualifier — FDA SaMD §III.B + 21 CFR §1300",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (PRESCRIPTIVE_TERMS.test(text)) {
        const hasHumanLoop =
          /\bfor[-\s]?(?:clinician|physician|prescriber)[-\s]?(?:review|approval|sign[-\s]?off)|\bhuman[-\s]?in[-\s]?the[-\s]?loop|\bsubject[-\s]?to[-\s]?(?:physician|medical)[-\s]?review/i.test(
            text,
          );
        if (!hasHumanLoop) {
          return {
            verdict: "block",
            reason:
              "FDA SaMD: AI output issues a prescriptive medical action without human-in-the-loop qualifier",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const fdaSaMDPack: GuardianPack = {
  id: "fda-samd-2026",
  name: "FDA SaMD + AI/ML Action Plan",
  citation:
    "FDA Software as Medical Device (SaMD) framework + AI/ML SaMD Action Plan (Jan 2021) + 21 CFR §807.87 + 21 CFR §1300",
  rules: fdaSaMDRules,
};

// ── EU DORA pack — Digital Operational Resilience Act ─────────────────

// Regulation (EU) 2022/2554. Enforceable since Jan 17, 2025. Covers
// ~22,000 EU financial entities (banks, insurers, CCPs, crypto-asset
// service providers). AI agents handling ICT third-party risk
// classification, fraud-model outputs, or incident reporting must
// emit receipts compatible with the 4-hour major-incident clock + the
// RTS Art. 18 severity tiers. Per Celent 2025, ICT-risk compliance
// spend in scope is €1.5-2B annually.

const DORA_INCIDENT_TERMS =
  /\b(ICT[-\s]?incident|operational[-\s]?incident|outage|breach|service[-\s]?disruption|major[-\s]?incident)/i;
const DORA_THIRD_PARTY_TERMS =
  /\b(third[-\s]?party[-\s]?provider|CTPP|critical[-\s]?ICT[-\s]?service|vendor[-\s]?risk|sub[-\s]?contractor)/i;

export const doraRules: GuardianRule[] = [
  {
    id: "dora-rts-art18-severity-tier",
    description:
      "WARN on ICT-incident outputs without RTS Art. 18 severity tier — EU DORA Reg 2022/2554 + ESA RTS",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (DORA_INCIDENT_TERMS.test(text)) {
        const hasTier =
          /\bseverity[-\s]?(?:tier|level|class)|\bmajor|\bsignificant|\bnotifiable|\bRTS[-\s]?Art\.?\s?18|\btier[-\s]?[1-4]\b/i.test(
            text,
          );
        if (!hasTier) {
          return {
            verdict: "warn",
            reason:
              "DORA Reg 2022/2554 + ESA RTS Art. 18: ICT-incident output missing severity tier classification",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "dora-4h-major-incident-clock",
    description:
      "WARN on major-incident classification without 4-hour reporting clock start timestamp — EU DORA Art. 19",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        DORA_INCIDENT_TERMS.test(text) &&
        /\bmajor[-\s]?incident|\bnotifiable|\bsignificant[-\s]?incident/i.test(
          text,
        )
      ) {
        const hasClock =
          /\b4[-\s]?hour|\bclock[-\s]?(?:start|started|begins)|\binitial[-\s]?notification[-\s]?(?:by|at|due)|\bdetected[-\s]?at[-\s]?\d{4}/i.test(
            text,
          );
        if (!hasClock) {
          return {
            verdict: "warn",
            reason:
              "DORA Art. 19: major-incident output lacks 4-hour reporting-clock start timestamp",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "dora-third-party-id-attestation",
    description:
      "WARN on third-party-risk decisions without CTPP / vendor identifier — EU DORA Art. 28-30 + Register of Information",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (DORA_THIRD_PARTY_TERMS.test(text)) {
        const hasId =
          /\bCTPP[-\s]?(?:id|reference)|\bvendor[-\s]?id|\bLEI[-\s]?\d|\bregister[-\s]?of[-\s]?information|\bRoI[-\s]?reference/i.test(
            text,
          );
        if (!hasId) {
          return {
            verdict: "warn",
            reason:
              "DORA Art. 28-30: third-party decision lacks CTPP / vendor / LEI / Register-of-Information identifier",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const doraPack: GuardianPack = {
  id: "eu-dora-2026",
  name: "EU DORA — Digital Operational Resilience",
  citation:
    "Regulation (EU) 2022/2554 (DORA) + ESA RTS Art. 18 (severity) + Art. 19 (incident reporting) + Art. 28-30 (third-party risk)",
  rules: doraRules,
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
  pciDssPack,
  euAiActPack,
  nydfsPack,
  nycAedtPack,
  ferpaPack,
  fdaSaMDPack,
  doraPack,
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

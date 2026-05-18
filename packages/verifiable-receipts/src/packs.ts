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

// ── Wave 62: Colorado AI Consumer Protection Act ─────────────────────
//
// SB 24-205 takes effect Feb 1, 2026 with a private right of action.
// "Consequential decisions" cover employment, education, financial,
// healthcare, housing, insurance, legal, and essential services. Every
// developer + deployer of a high-risk AI system used on a Colorado
// resident must (a) maintain an impact assessment, (b) disclose
// algorithmic discrimination risk to consumers, (c) post a public
// statement on the agency website.
//
// Citation: Colo. Rev. Stat. §§ 6-1-1701 to 6-1-1707 (added by SB 24-205).

const COLO_CONSEQUENTIAL_TERMS =
  /\b(consequential[-\s]?decision|hiring[-\s]?decision|loan[-\s]?(?:approved|denied|decision)|housing[-\s]?(?:application|decision)|insurance[-\s]?(?:underwriting|denial)|essential[-\s]?service|legal[-\s]?service|education[-\s]?(?:placement|admission)|credit[-\s]?(?:application|decision)|adverse[-\s]?action)/i;
const COLO_RESIDENT_TERMS =
  /\b(Colorado[-\s]?resident|CO[-\s]?resident|consumer[-\s]?in[-\s]?Colorado|state[-\s]?of[-\s]?Colorado)/i;

export const coloradoAiRules: GuardianRule[] = [
  {
    id: "colorado-sb24-205-impact-assessment",
    description:
      "WARN on consequential-decision output without impact-assessment reference — CRS § 6-1-1703(3)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (COLO_CONSEQUENTIAL_TERMS.test(text)) {
        const hasAssessment =
          /\bimpact[-\s]?assessment|\bIA[-\s]?(?:reference|id|version)|\balgorithmic[-\s]?impact|\bAIA[-\s]?ref/i.test(
            text,
          );
        if (!hasAssessment) {
          return {
            verdict: "warn",
            reason:
              "CRS § 6-1-1703(3): consequential-decision output missing impact-assessment reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "colorado-sb24-205-discrimination-disclosure",
    description:
      "BLOCK consequential-decision output to CO resident without algorithmic-discrimination disclosure — CRS § 6-1-1703(4)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        COLO_CONSEQUENTIAL_TERMS.test(text) &&
        COLO_RESIDENT_TERMS.test(text + " " + asText(ctx.input))
      ) {
        const hasDisclosure =
          /\balgorithmic[-\s]?discrimination|\bbias[-\s]?(?:disclosure|notice)|\bSB[-\s]?24[-\s]?205|\bright[-\s]?to[-\s]?appeal|\bhuman[-\s]?review[-\s]?available/i.test(
            text,
          );
        if (!hasDisclosure) {
          return {
            verdict: "block",
            reason:
              "CRS § 6-1-1703(4): consequential decision affecting Colorado resident lacks algorithmic-discrimination disclosure + appeal right",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "colorado-sb24-205-public-statement-link",
    description:
      "WARN on high-risk AI deployment notice without link to public statement on agency website — CRS § 6-1-1705(2)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\bhigh[-\s]?risk[-\s]?AI|\bAI[-\s]?system[-\s]?deployment|\bAI[-\s]?notice/i.test(
          text,
        )
      ) {
        const hasLink =
          /\bpublic[-\s]?statement|\bsovereignmatrix\.agency\/[a-z0-9\-\/]+|\bagency[-\s]?website|https?:\/\/\S+/i.test(
            text,
          );
        if (!hasLink) {
          return {
            verdict: "warn",
            reason:
              "CRS § 6-1-1705(2): high-risk AI notice missing link to public statement",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const coloradoAiPack: GuardianPack = {
  id: "us-colorado-ai-2026",
  name: "Colorado AI Consumer Protection Act (SB 24-205)",
  citation:
    "Colo. Rev. Stat. §§ 6-1-1701 to 6-1-1707 (Colorado AI Consumer Protection Act, eff. Feb 1, 2026)",
  rules: coloradoAiRules,
};

// ── Wave 62: California AB 2013 — GenAI training-data transparency ──
//
// Effective Jan 1, 2026. Any developer that makes a generative AI
// model available to Californians (foundation API, RAG, fine-tuned
// vertical LLM) must post a public summary of training data:
// sources, copyright clearance, synthetic-vs-real %, IP/PII handling,
// purchased datasets, web-crawl scope. Cal Bus & Prof § 22757.1.

const CA_AB2013_GENAI_TERMS =
  /\b(generated|generation|inference|completion|model[-\s]?output|LLM[-\s]?(?:response|output)|GenAI|foundation[-\s]?model)/i;

export const californiaAb2013Rules: GuardianRule[] = [
  {
    id: "ca-ab2013-training-data-manifest",
    description:
      "WARN on GenAI receipt without training-data manifest hash — Cal Bus & Prof § 22757.1(b)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (CA_AB2013_GENAI_TERMS.test(text)) {
        const hasManifest =
          /\btraining[-\s]?data[-\s]?manifest|\bmanifest[-\s]?hash|\bdataset[-\s]?fingerprint|\btraining[-\s]?summary|\bdata[-\s]?provenance/i.test(
            text,
          );
        if (!hasManifest) {
          return {
            verdict: "warn",
            reason:
              "Cal Bus & Prof § 22757.1(b): GenAI output missing training-data manifest reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "ca-ab2013-synthetic-data-percentage",
    description:
      "WARN on GenAI output without synthetic-vs-real data percentage — Cal Bus & Prof § 22757.1(c)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (CA_AB2013_GENAI_TERMS.test(text)) {
        const hasPct =
          /\bsynthetic[-\s]?(?:data|percentage|ratio)|\bsynth[-\s]?\d+%|\breal[-\s]?data[-\s]?\d+%|\bdata[-\s]?composition/i.test(
            text,
          );
        if (!hasPct) {
          return {
            verdict: "warn",
            reason:
              "Cal Bus & Prof § 22757.1(c): GenAI output missing synthetic-vs-real data composition disclosure",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "ca-ab2013-copyright-clearance-flag",
    description:
      "WARN on GenAI output without copyright-clearance flag for source data — Cal Bus & Prof § 22757.1(d)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (CA_AB2013_GENAI_TERMS.test(text)) {
        const hasClearance =
          /\bcopyright[-\s]?(?:cleared|clearance|status)|\blicensed[-\s]?data|\bpublic[-\s]?domain|\bfair[-\s]?use[-\s]?(?:analysis|determination)|\bIP[-\s]?cleared/i.test(
            text,
          );
        if (!hasClearance) {
          return {
            verdict: "warn",
            reason:
              "Cal Bus & Prof § 22757.1(d): GenAI output missing copyright-clearance flag for source data",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const californiaAb2013Pack: GuardianPack = {
  id: "us-ca-ab2013-2026",
  name: "California AB 2013 — Generative AI Training Data Transparency",
  citation: "Cal. Bus. & Prof. Code § 22757.1 (AB 2013, eff. Jan 1, 2026)",
  rules: californiaAb2013Rules,
};

// ── Wave 62: Australia APRA CPS 230 — operational resilience ─────────
//
// Active July 1, 2025. APRA-regulated entities (banks, insurers,
// super funds) must (a) maintain tolerance levels for material
// services, (b) map fourth-party dependencies, (c) provide consumer
// explanations for automated decisions under Privacy Act ADM right.
// Citation: APRA Prudential Standard CPS 230 (eff. 1 Jul 2025) +
// Privacy Act 1988 (Cth) automated-decision provisions (2026 tranche).

const APRA_MATERIAL_SERVICE_TERMS =
  /\b(material[-\s]?service|critical[-\s]?operation|payment[-\s]?(?:rail|service)|core[-\s]?banking|claims[-\s]?processing|fund[-\s]?(?:transfer|allocation)|insurance[-\s]?underwriting)/i;
const APRA_AUTOMATED_DECISION_TERMS =
  /\b(automated[-\s]?decision|ADM|algorithmic[-\s]?(?:decision|outcome)|AI[-\s]?(?:approval|denial)|model[-\s]?based[-\s]?decision)/i;

export const apraCps230Rules: GuardianRule[] = [
  {
    id: "apra-cps230-tolerance-level",
    description:
      "WARN on material-service call without tolerance-level metric — APRA CPS 230 § 35",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (APRA_MATERIAL_SERVICE_TERMS.test(text)) {
        const hasTolerance =
          /\btolerance[-\s]?(?:level|threshold|metric)|\bRTO[-\s]?\d|\bRPO[-\s]?\d|\bavailability[-\s]?\d+%|\bSLA[-\s]?(?:target|ref)/i.test(
            text,
          );
        if (!hasTolerance) {
          return {
            verdict: "warn",
            reason:
              "APRA CPS 230 § 35: material-service output missing tolerance-level metric (RTO/RPO/availability)",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "apra-cps230-fourth-party-chain",
    description:
      "WARN on third-party-decision output without fourth-party dependency chain — APRA CPS 230 § 44",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\bthird[-\s]?party[-\s]?(?:risk|provider|dependency)|\bvendor[-\s]?assessment|\boutsourced[-\s]?service/i.test(
          text,
        )
      ) {
        const hasFourth =
          /\bfourth[-\s]?party|\bsub[-\s]?(?:contractor|provider|tier)|\bdependency[-\s]?chain|\bnth[-\s]?party|\bupstream[-\s]?dependency/i.test(
            text,
          );
        if (!hasFourth) {
          return {
            verdict: "warn",
            reason:
              "APRA CPS 230 § 44: third-party-risk decision missing fourth-party dependency chain disclosure",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "apra-cps230-consumer-explanation",
    description:
      "WARN on automated decision without consumer-explanation token — Privacy Act 1988 ADM right (2026 tranche)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (APRA_AUTOMATED_DECISION_TERMS.test(text)) {
        const hasExplanation =
          /\bconsumer[-\s]?explanation|\bplain[-\s]?language[-\s]?reason|\breason[-\s]?code|\bexplanation[-\s]?token|\bright[-\s]?to[-\s]?explanation|\bmeaningful[-\s]?information/i.test(
            text,
          );
        if (!hasExplanation) {
          return {
            verdict: "warn",
            reason:
              "Privacy Act 1988 ADM right: automated decision missing consumer-explanation token",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const apraCps230Pack: GuardianPack = {
  id: "au-apra-cps230-2025",
  name: "Australia APRA CPS 230 + Privacy Act ADM",
  citation:
    "APRA Prudential Standard CPS 230 (eff. 1 Jul 2025) + Privacy Act 1988 (Cth) automated-decision-making provisions (2026 tranche)",
  rules: apraCps230Rules,
};

// ── Wave 62: FDA Predetermined Change Control Plans (PCCP) ───────────
//
// Dec 2024 final guidance. Continuous-learning AI medical devices
// (radiology triage, sepsis predictors, continuous glucose) need a
// PCCP that pre-specifies how the model may change post-clearance.
// Every inference must reference (a) PCCP version, (b) current model
// weights hash, (c) drift metrics within Modification Protocol bounds.
// Citation: FDA "Marketing Submission Recommendations for a PCCP for
// Artificial Intelligence/Machine Learning (AI/ML)-Enabled Device
// Software Functions" (Dec 4, 2024).

const FDA_PCCP_CLINICAL_TERMS =
  /\b(continuous[-\s]?learning|adaptive[-\s]?model|model[-\s]?update|retrain(?:ed|ing)?|model[-\s]?(?:weights|version)|inference[-\s]?(?:output|result)|AI[-\s]?(?:diagnosis|triage|prediction))/i;

export const fdaPccpRules: GuardianRule[] = [
  {
    id: "fda-pccp-version-reference",
    description:
      "WARN on continuous-learning AI medical inference without PCCP version reference — FDA PCCP Guidance Dec 2024",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (FDA_PCCP_CLINICAL_TERMS.test(text)) {
        const hasPccp =
          /\bPCCP[-\s]?(?:v|version|ref)|\bpredetermined[-\s]?change[-\s]?control|\bMP[-\s]?(?:v|version|ref)|\bmodification[-\s]?protocol/i.test(
            text,
          );
        if (!hasPccp) {
          return {
            verdict: "warn",
            reason:
              "FDA PCCP Dec 2024 § V: continuous-learning AI inference missing PCCP version reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fda-pccp-weights-hash",
    description:
      "WARN on continuous-learning AI inference without current-model-weights hash — FDA PCCP Guidance Dec 2024 § VI",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (FDA_PCCP_CLINICAL_TERMS.test(text)) {
        const hasHash =
          /\bweights[-\s]?hash|\bmodel[-\s]?(?:sha|fingerprint|digest)|\bsha256:[0-9a-f]{16}|\bcheckpoint[-\s]?id/i.test(
            text,
          );
        if (!hasHash) {
          return {
            verdict: "warn",
            reason:
              "FDA PCCP Dec 2024 § VI: continuous-learning AI inference missing current-model-weights hash",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "fda-pccp-drift-bounds",
    description:
      "BLOCK adaptive-model output reporting drift beyond Modification Protocol bounds — FDA PCCP Guidance Dec 2024 § VII",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (FDA_PCCP_CLINICAL_TERMS.test(text)) {
        const driftOutOfBounds =
          /\bdrift[-\s]?(?:exceeded|out[-\s]?of[-\s]?bounds|above[-\s]?threshold)|\bMP[-\s]?bounds[-\s]?breached|\bAUC[-\s]?drop[-\s]?>\s?0\.\d/i.test(
            text,
          );
        if (driftOutOfBounds) {
          return {
            verdict: "block",
            reason:
              "FDA PCCP Dec 2024 § VII: drift exceeds Modification Protocol bounds — model must be re-cleared before further inference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const fdaPccpPack: GuardianPack = {
  id: "us-fda-pccp-2024",
  name: "FDA Predetermined Change Control Plans (PCCP)",
  citation:
    "FDA Final Guidance: Marketing Submission Recommendations for a PCCP for AI/ML-Enabled Device Software Functions (Dec 4, 2024)",
  rules: fdaPccpRules,
};

// ── Wave 62: Illinois AI Video Interview Act + HB 3773 ───────────────
//
// IL AI Video Interview Act (820 ILCS 42/) enforced since 2020 for
// video-based hiring assessments. HB 3773 (Illinois Human Rights Act
// amendment) extends bias-audit obligations to all employment AI
// effective Jan 1, 2026. Together they require (a) candidate consent
// for AI video analysis, (b) destruction of recordings within 30 days
// of request, (c) annual bias-audit disclosure for any AI used in
// hiring decisions.

const IL_VIDEO_HIRING_TERMS =
  /\b(video[-\s]?interview|recorded[-\s]?interview|AI[-\s]?(?:screen|interview|assessment)|facial[-\s]?analysis|voice[-\s]?analysis|emotion[-\s]?recognition)/i;
const IL_EMPLOYMENT_AI_TERMS =
  /\b(hiring[-\s]?decision|candidate[-\s]?(?:ranked|scored|advanced|rejected)|employment[-\s]?(?:decision|screen)|applicant[-\s]?(?:tracked|filtered))/i;

export const illinoisAiRules: GuardianRule[] = [
  {
    id: "illinois-ai-video-consent",
    description:
      "BLOCK AI video-interview analysis without explicit candidate consent — IL AI Video Interview Act (820 ILCS 42/5)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (IL_VIDEO_HIRING_TERMS.test(text)) {
        const hasConsent =
          /\bcandidate[-\s]?consent|\bexplicit[-\s]?consent|\bopt[-\s]?in[-\s]?confirmed|\bconsent[-\s]?(?:obtained|on[-\s]?file|verified)|\bsigned[-\s]?release/i.test(
            text,
          );
        if (!hasConsent) {
          return {
            verdict: "block",
            reason:
              "820 ILCS 42/5: AI video-interview analysis without explicit candidate consent is prohibited in Illinois",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "illinois-ai-retention-policy",
    description:
      "WARN on AI video-interview output without 30-day destruction policy reference — IL AI Video Interview Act (820 ILCS 42/15)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (IL_VIDEO_HIRING_TERMS.test(text)) {
        const hasRetention =
          /\b30[-\s]?day[-\s]?(?:destruction|retention|deletion)|\bretention[-\s]?policy|\bdestroy(?:ed)?[-\s]?within|\bdata[-\s]?retention[-\s]?(?:schedule|policy)/i.test(
            text,
          );
        if (!hasRetention) {
          return {
            verdict: "warn",
            reason:
              "820 ILCS 42/15: AI video-interview output missing reference to 30-day destruction policy",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "illinois-hb3773-bias-audit",
    description:
      "WARN on Illinois employment-AI decision without annual bias-audit reference — IL HB 3773 + IHRA amendment (eff. Jan 1, 2026)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (IL_EMPLOYMENT_AI_TERMS.test(text)) {
        const hasAudit =
          /\bbias[-\s]?audit|\bannual[-\s]?audit|\bHB[-\s]?3773|\bIHRA[-\s]?compliance|\bdisparate[-\s]?impact[-\s]?(?:audit|analysis)|\bfourth[-\s]?fifths[-\s]?rule/i.test(
            text,
          );
        if (!hasAudit) {
          return {
            verdict: "warn",
            reason:
              "IL HB 3773 (IHRA amendment, eff. Jan 1 2026): employment-AI decision missing annual bias-audit reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const illinoisAiPack: GuardianPack = {
  id: "us-illinois-ai-2026",
  name: "Illinois AI Video Interview Act + HB 3773",
  citation:
    "820 ILCS 42/ (Illinois AI Video Interview Act, eff. 2020) + HB 3773 / IHRA amendment (eff. Jan 1, 2026)",
  rules: illinoisAiRules,
};

// ── Wave 63: Canada AIDA (Artificial Intelligence and Data Act, C-27) ─
//
// Bill C-27 (Digital Charter Implementation Act, 2022) bundles AIDA
// with PIPEDA reform. AIDA defines "high-impact AI systems" and
// requires (a) bias-mitigation measures, (b) human-oversight
// attestation, (c) accessibility considerations, plus a material-harm
// notification path to the Minister. The companion Statutory Instrument
// is pre-published 2025; Royal Assent expected late 2026, with class-
// definition rulemaking through 2027.
//
// Citation: AIDA in Bill C-27 (parl.ca/DocumentViewer/en/44-1/bill/C-27)
// + PIPEDA (Personal Information Protection and Electronic Documents
// Act, R.S.C. 1985, c. 5) automated-decision provisions.

const AIDA_HIGH_IMPACT_TERMS =
  /\b(high[-\s]?impact|biometric[-\s]?identification|content[-\s]?moderation|employment[-\s]?(?:decision|filter)|essential[-\s]?service|automated[-\s]?decision)/i;
const AIDA_CANADIAN_NEXUS =
  /\b(Canadian[-\s]?resident|Canada[-\s]?user|served[-\s]?in[-\s]?Canada|federally[-\s]?regulated[-\s]?entity)/i;

export const canadaAidaRules: GuardianRule[] = [
  {
    id: "canada-aida-bias-mitigation",
    description:
      "WARN on high-impact AI output without bias-mitigation reference — AIDA s. 8 (high-impact systems)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (AIDA_HIGH_IMPACT_TERMS.test(text)) {
        const hasMitigation =
          /\bbias[-\s]?mitigation|\bfairness[-\s]?(?:audit|test|measure)|\bdisparate[-\s]?impact[-\s]?analysis|\bequity[-\s]?(?:test|review)/i.test(
            text,
          );
        if (!hasMitigation) {
          return {
            verdict: "warn",
            reason:
              "AIDA s. 8: high-impact AI output missing bias-mitigation reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "canada-aida-human-oversight",
    description:
      "WARN on high-impact AI decision without human-oversight attestation — AIDA s. 9",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (AIDA_HIGH_IMPACT_TERMS.test(text)) {
        const hasOversight =
          /\bhuman[-\s]?(?:oversight|review|in[-\s]?the[-\s]?loop)|\bHITL|\boperator[-\s]?supervised|\bhuman[-\s]?approved/i.test(
            text,
          );
        if (!hasOversight) {
          return {
            verdict: "warn",
            reason:
              "AIDA s. 9: high-impact AI decision missing human-oversight attestation",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "canada-aida-material-harm-notification",
    description:
      "BLOCK high-impact AI output reporting material harm without ministerial-notification reference — AIDA s. 12",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\bmaterial[-\s]?harm|\bserious[-\s]?injury|\bproperty[-\s]?damage|\bsystemic[-\s]?bias[-\s]?detected/i.test(
          text,
        ) &&
        AIDA_HIGH_IMPACT_TERMS.test(text)
      ) {
        const hasNotice =
          /\bministerial[-\s]?notification|\bMinister[-\s]?of[-\s]?Innovation|\bAIDA[-\s]?(?:incident|report)|\bnotification[-\s]?filed/i.test(
            text,
          );
        if (!hasNotice) {
          return {
            verdict: "block",
            reason:
              "AIDA s. 12: material-harm event from high-impact AI lacks ministerial-notification reference",
          };
        }
      }
      // Silence unused-warning for the nexus regex — retained for future
      // jurisdiction-scoped enforcement extension.
      void AIDA_CANADIAN_NEXUS;
      return { verdict: "pass" };
    },
  },
];

export const canadaAidaPack: GuardianPack = {
  id: "ca-aida-2026",
  name: "Canada AIDA (Artificial Intelligence and Data Act, C-27)",
  citation:
    "Bill C-27 Part 3 (AIDA) ss. 8-12 + PIPEDA automated-decision-making provisions",
  rules: canadaAidaRules,
};

// ── Wave 63: UK ICO AI Auditing Framework ────────────────────────────
//
// ICO's "Guidance on AI and data protection" (updated Q1 2026) sets
// five cross-sector principles plus a procurement-grade Auditing
// Framework. Article 22 GDPR (carried into UK GDPR) requires
// meaningful information about the logic of solely automated decisions
// + safeguards. Public-sector AI also faces the Algorithmic
// Transparency Recording Standard (ATRS) from CDDO.
//
// Citation: ICO Guidance on AI + UK GDPR Art. 22 + ATRS v2 (Q4 2024)
// + AI White Paper (Mar 2023) regulatory principles.

const UK_AI_HIGH_STAKES_TERMS =
  /\b(solely[-\s]?automated|automated[-\s]?decision|high[-\s]?stakes[-\s]?AI|public[-\s]?sector[-\s]?AI|healthcare[-\s]?AI|education[-\s]?AI)/i;

export const ukIcoRules: GuardianRule[] = [
  {
    id: "uk-ico-dpia-reference",
    description:
      "WARN on high-stakes UK AI output without DPIA reference — UK GDPR Art. 35 + ICO Guidance §3",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (UK_AI_HIGH_STAKES_TERMS.test(text)) {
        const hasDpia =
          /\bDPIA|\bdata[-\s]?protection[-\s]?impact[-\s]?assessment|\bArt\.?\s?35|\bICO[-\s]?(?:registered|notified)/i.test(
            text,
          );
        if (!hasDpia) {
          return {
            verdict: "warn",
            reason:
              "UK GDPR Art. 35 + ICO Guidance §3: high-stakes AI output missing DPIA reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "uk-ico-explainability-artefact",
    description:
      "WARN on solely-automated UK AI decision without explainability artefact — UK GDPR Art. 22(3)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (UK_AI_HIGH_STAKES_TERMS.test(text)) {
        const hasExplain =
          /\bexplainability[-\s]?(?:artefact|artifact|report)|\bmeaningful[-\s]?information|\bdecision[-\s]?rationale|\bSHAP|\bLIME|\bcounterfactual[-\s]?explanation/i.test(
            text,
          );
        if (!hasExplain) {
          return {
            verdict: "warn",
            reason:
              "UK GDPR Art. 22(3): solely-automated UK AI decision missing explainability artefact",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "uk-ico-human-review-pathway",
    description:
      "WARN on UK automated decision without human-review pathway — ICO Guidance §6 + Art. 22(3)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (UK_AI_HIGH_STAKES_TERMS.test(text)) {
        const hasReview =
          /\bhuman[-\s]?review[-\s]?(?:available|pathway|process)|\bright[-\s]?to[-\s]?contest|\bcontestability|\bappeal[-\s]?(?:right|process)/i.test(
            text,
          );
        if (!hasReview) {
          return {
            verdict: "warn",
            reason:
              "ICO Guidance §6 + UK GDPR Art. 22(3): UK automated decision missing human-review pathway",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const ukIcoPack: GuardianPack = {
  id: "uk-ico-ai-2026",
  name: "UK ICO AI Auditing Framework + Art. 22 UK GDPR",
  citation:
    "ICO Guidance on AI and data protection (Q1 2026) + UK GDPR Art. 22 (automated decisions) + ATRS v2 (CDDO, Q4 2024)",
  rules: ukIcoRules,
};

// ── Wave 63: ISO/IEC 42001 AIMS runtime hooks ────────────────────────
//
// Published Dec 2023. The "AI management system" certification gate
// procurement teams now treat as the replacement for "do you have a
// responsible AI policy?". Annex A control set spans 9 categories
// (policies, internal organisation, AI system lifecycle, etc.).
// Runtime hook: every AI inference should reference its AIMS document
// + applicable Annex A controls + the corresponding risk-treatment
// record so the audit trail composes back to the certificate.

const ISO42001_AI_INFERENCE_TERMS =
  /\b(AI[-\s]?(?:inference|decision|output)|model[-\s]?(?:output|prediction)|automated[-\s]?(?:recommendation|score)|AIMS[-\s]?scope)/i;

export const iso42001Rules: GuardianRule[] = [
  {
    id: "iso42001-aims-doc-reference",
    description:
      "WARN on AI inference output without AIMS document reference — ISO/IEC 42001:2023 § 7.5",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (ISO42001_AI_INFERENCE_TERMS.test(text)) {
        const hasAims =
          /\bAIMS[-\s]?(?:doc|document|policy|ref|v\d)|\bISO[-\s]?42001|\bAI[-\s]?management[-\s]?system[-\s]?(?:policy|document)/i.test(
            text,
          );
        if (!hasAims) {
          return {
            verdict: "warn",
            reason:
              "ISO/IEC 42001:2023 § 7.5: AI inference output missing AIMS document reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "iso42001-risk-treatment-record",
    description:
      "WARN on AI inference output without risk-treatment record id — ISO/IEC 42001:2023 § 6.1.4",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (ISO42001_AI_INFERENCE_TERMS.test(text)) {
        const hasRtr =
          /\brisk[-\s]?treatment[-\s]?(?:record|id|plan)|\bRTR[-\s]?\d|\bAIMS[-\s]?risk[-\s]?id|\brisk[-\s]?register[-\s]?ref/i.test(
            text,
          );
        if (!hasRtr) {
          return {
            verdict: "warn",
            reason:
              "ISO/IEC 42001:2023 § 6.1.4: AI inference output missing risk-treatment record id",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "iso42001-annex-a-applicability",
    description:
      "WARN on AI inference output without Annex A control set applicability tag — ISO/IEC 42001:2023 Annex A",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (ISO42001_AI_INFERENCE_TERMS.test(text)) {
        const hasAnnex =
          /\bAnnex[-\s]?A(?:[-\s]?\d)?|\bA\.\d+(?:\.\d+)*[-\s]?control|\bcontrol[-\s]?(?:set|tag)|\bSoA[-\s]?(?:ref|reference)/i.test(
            text,
          );
        if (!hasAnnex) {
          return {
            verdict: "warn",
            reason:
              "ISO/IEC 42001:2023 Annex A: AI inference output missing applicable control set tag",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const iso42001Pack: GuardianPack = {
  id: "iso-42001-2023",
  name: "ISO/IEC 42001 AI Management System",
  citation:
    "ISO/IEC 42001:2023 §§ 6.1.4 / 7.5 + Annex A (AI Management System requirements)",
  rules: iso42001Rules,
};

// ── Wave 63: Texas TX-RAMP + biometric AI ────────────────────────────
//
// TX-RAMP (Texas Risk and Authorization Management Program) is the
// state-procurement security-authorization regime — any cloud or AI
// product sold to a Texas state agency needs TX-RAMP cert at the
// appropriate impact level. HB 4 (passed June 2025) extends biometric-
// AI consent + retention obligations beyond the original Capture/Use
// of Biometric Identifier Act (Bus. & Com. Code § 503.001). Texas
// state IT spend is $3.4B/yr; biometric-AI market $32B by 2027.

const TX_BIOMETRIC_TERMS =
  /\b(biometric[-\s]?(?:identifier|template|scan|matching|verification)|face[-\s]?(?:print|recognition)|iris[-\s]?(?:scan|template)|voice[-\s]?print|fingerprint[-\s]?match)/i;
const TX_RAMP_SCOPE_TERMS =
  /\b(TX[-\s]?RAMP|Texas[-\s]?state[-\s]?agency|state[-\s]?procurement|DIR[-\s]?contract|DIR[-\s]?vendor)/i;

export const texasAiRules: GuardianRule[] = [
  {
    id: "tx-biometric-consent",
    description:
      "BLOCK biometric-AI output on Texas data without prior written consent — Tex. Bus. & Com. Code § 503.001(b)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (TX_BIOMETRIC_TERMS.test(text)) {
        const hasConsent =
          /\bprior[-\s]?written[-\s]?consent|\bsigned[-\s]?consent|\bconsent[-\s]?on[-\s]?file|\bopt[-\s]?in[-\s]?verified|\bsigned[-\s]?release/i.test(
            text,
          );
        if (!hasConsent) {
          return {
            verdict: "block",
            reason:
              "Tex. Bus. & Com. Code § 503.001(b): biometric AI requires prior written consent before capture/use",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "tx-biometric-retention-schedule",
    description:
      "WARN on biometric-AI output without retention/destruction schedule — Tex. Bus. & Com. Code § 503.001(c) + HB 4",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (TX_BIOMETRIC_TERMS.test(text)) {
        const hasRetention =
          /\bretention[-\s]?(?:schedule|policy|window)|\bdestruction[-\s]?schedule|\bdelete(?:d)?[-\s]?within|\bauto[-\s]?purge[-\s]?after/i.test(
            text,
          );
        if (!hasRetention) {
          return {
            verdict: "warn",
            reason:
              "Tex. Bus. & Com. Code § 503.001(c) + HB 4 (2025): biometric AI output missing retention/destruction schedule",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "tx-ramp-certification-ref",
    description:
      "WARN on TX-RAMP-scope output without certification reference — TX-RAMP Statewide Standard",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (TX_RAMP_SCOPE_TERMS.test(text)) {
        const hasCert =
          /\bTX[-\s]?RAMP[-\s]?(?:level|certified|certification|cert[-\s]?id)|\bauthorization[-\s]?to[-\s]?operate|\bATO[-\s]?(?:date|reference)|\bdata[-\s]?residency[-\s]?attested/i.test(
            text,
          );
        if (!hasCert) {
          return {
            verdict: "warn",
            reason:
              "TX-RAMP Statewide Standard: state-agency AI output missing TX-RAMP certification reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const texasAiPack: GuardianPack = {
  id: "us-texas-ai-2025",
  name: "Texas TX-RAMP + Biometric Identifier Act + HB 4",
  citation:
    "Tex. Bus. & Com. Code § 503.001 (CUBI) + HB 4 (eff. June 2025) + TX-RAMP Statewide Standard (Dept. of Information Resources)",
  rules: texasAiRules,
};

// ── Wave 63: Brazil LGPD AI Regulation (PL 2338/2023) ────────────────
//
// ANPD (Brazil's data-protection authority) released the AI-regulation
// draft in April 2025. LGPD Art. 20 already grants a right to human
// review of automated decisions; PL 2338/2023 layers (a) DPIA
// requirements for AI (RIA — Relatório de Impacto Algorítmico),
// (b) Portuguese-language right-to-review notices, (c) algorithmic
// impact categorisation (excessivo / alto / médio / baixo risco /
// risco inaceitável).
//
// Enforcement expected Q3 2026. Brazil enterprise AI spend $4.8B (2025).

const BRAZIL_AI_TERMS =
  /\b(LGPD|Brazilian[-\s]?(?:resident|data[-\s]?subject)|automated[-\s]?decision|decisão[-\s]?automatizada|titular[-\s]?de[-\s]?dados)/i;

export const brazilLgpdAiRules: GuardianRule[] = [
  {
    id: "br-lgpd-ai-ria-reference",
    description:
      "WARN on Brazilian AI decision without RIA (Algorithmic Impact Report) reference — PL 2338/2023 art. 13",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (BRAZIL_AI_TERMS.test(text)) {
        const hasRia =
          /\bRIA[-\s]?(?:ref|reference|id|v\d)|\bRelat[oó]rio[-\s]?de[-\s]?Impacto|\balgorithmic[-\s]?impact[-\s]?report|\bDPIA[-\s]?(?:ref|for[-\s]?AI)/i.test(
            text,
          );
        if (!hasRia) {
          return {
            verdict: "warn",
            reason:
              "PL 2338/2023 art. 13: Brazilian AI decision missing RIA (Relatório de Impacto Algorítmico) reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "br-lgpd-ai-portuguese-review-notice",
    description:
      "WARN on Brazilian automated decision without Portuguese-language right-to-review notice — LGPD Art. 20 §1",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (BRAZIL_AI_TERMS.test(text)) {
        const hasNotice =
          /\bdireito[-\s]?(?:a|à)[-\s]?revis[aã]o|\brevis[aã]o[-\s]?humana|\bnotice[-\s]?(?:in|em)[-\s]?Portuguese|\bplain[-\s]?language[-\s]?review[-\s]?notice/i.test(
            text,
          );
        if (!hasNotice) {
          return {
            verdict: "warn",
            reason:
              "LGPD Art. 20 §1: Brazilian automated decision missing Portuguese-language right-to-review notice",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "br-lgpd-ai-impact-category",
    description:
      "WARN on Brazilian AI output without algorithmic-impact category — PL 2338/2023 art. 13 §III",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (BRAZIL_AI_TERMS.test(text)) {
        const hasCategory =
          /\b(?:risco[-\s]?)?(?:inaceit[aá]vel|excessivo|alto[-\s]?risco|médio[-\s]?risco|baixo[-\s]?risco)|\bAI[-\s]?risk[-\s]?(?:tier|category|class)|\bimpact[-\s]?category[-\s]?(?:low|medium|high|unacceptable)/i.test(
            text,
          );
        if (!hasCategory) {
          return {
            verdict: "warn",
            reason:
              "PL 2338/2023 art. 13 §III: Brazilian AI output missing algorithmic-impact category (baixo/médio/alto/inaceitável)",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const brazilLgpdAiPack: GuardianPack = {
  id: "br-lgpd-ai-2026",
  name: "Brazil LGPD AI Regulation (PL 2338/2023)",
  citation:
    "Lei Geral de Proteção de Dados Art. 20 + PL 2338/2023 art. 13 (ANPD AI Regulation, Apr 2025 draft, eff. Q3 2026)",
  rules: brazilLgpdAiRules,
};

// ── Wave 63: India DPDP Act + MeitY AI Advisory ──────────────────────
//
// DPDP (Digital Personal Data Protection) Act in force since Aug 2023.
// MeitY AI Advisory (March 2024) requires Government of India
// notification before deploying "unreliable / under-tested" LLMs +
// significant-data-fiduciary tagging for high-impact processors.
// IndiaAI Safety Institute guidance (Q4 2025) layers further runtime
// hooks for high-risk AI.

const INDIA_AI_TERMS =
  /\b(Indian[-\s]?(?:resident|data[-\s]?principal)|DPDP|MeitY|significant[-\s]?data[-\s]?fiduciary|SDF[-\s]?obligation)/i;
const INDIA_HIGH_RISK_LLM_TERMS =
  /\b(LLM[-\s]?(?:output|response|deployment)|generative[-\s]?AI|content[-\s]?generation|unreliable[-\s]?AI|under[-\s]?tested[-\s]?model)/i;

export const indiaDpdpAiRules: GuardianRule[] = [
  {
    id: "in-dpdp-consent-artefact",
    description:
      "WARN on Indian data-principal AI processing without consent artefact reference — DPDP Act § 6",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (INDIA_AI_TERMS.test(text)) {
        const hasConsent =
          /\bconsent[-\s]?(?:artefact|artifact|id|reference|ref|notice)|\bconsent[-\s]?manager|\bDPDP[-\s]?consent|\bdata[-\s]?principal[-\s]?consent/i.test(
            text,
          );
        if (!hasConsent) {
          return {
            verdict: "warn",
            reason:
              "DPDP Act § 6: Indian data-principal AI processing missing consent-artefact reference",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "in-meity-unreliable-disclaimer",
    description:
      "WARN on high-risk LLM output without 'may be unreliable' disclaimer — MeitY AI Advisory (Mar 2024)",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (INDIA_HIGH_RISK_LLM_TERMS.test(text)) {
        const hasDisclaimer =
          /\bmay[-\s]?be[-\s]?unreliable|\boutput[-\s]?reliability[-\s]?(?:disclosure|disclaimer)|\bsubject[-\s]?to[-\s]?errors|\bnot[-\s]?guaranteed[-\s]?accurate|\bMeitY[-\s]?advisory/i.test(
            text,
          );
        if (!hasDisclaimer) {
          return {
            verdict: "warn",
            reason:
              "MeitY AI Advisory (Mar 2024): high-risk LLM output missing reliability disclaimer",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
  {
    id: "in-sdf-significant-fiduciary-tag",
    description:
      "WARN on Significant-Data-Fiduciary AI output without SDF obligations tag — DPDP Act § 10",
    evaluate: async (ctx) => {
      const text = asText(ctx.output);
      if (
        /\bsignificant[-\s]?data[-\s]?fiduciary|\bSDF|\blarge[-\s]?scale[-\s]?processing|\bhigh[-\s]?volume[-\s]?AI/i.test(
          text,
        )
      ) {
        const hasTag =
          /\bSDF[-\s]?obligation|\bDPO[-\s]?(?:ref|appointed)|\bDPIA[-\s]?(?:ref|completed)|\bindependent[-\s]?audit[-\s]?(?:ref|annual)|\bData[-\s]?Protection[-\s]?Officer/i.test(
            text,
          );
        if (!hasTag) {
          return {
            verdict: "warn",
            reason:
              "DPDP Act § 10: Significant-Data-Fiduciary AI output missing SDF obligations tag (DPO/DPIA/audit)",
          };
        }
      }
      return { verdict: "pass" };
    },
  },
];

export const indiaDpdpAiPack: GuardianPack = {
  id: "in-dpdp-ai-2024",
  name: "India DPDP Act + MeitY AI Advisory",
  citation:
    "Digital Personal Data Protection Act 2023 §§ 6 / 10 + MeitY AI Advisory (Mar 2024) + IndiaAI Safety Institute guidance (Q4 2025)",
  rules: indiaDpdpAiRules,
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
  coloradoAiPack,
  californiaAb2013Pack,
  apraCps230Pack,
  fdaPccpPack,
  illinoisAiPack,
  canadaAidaPack,
  ukIcoPack,
  iso42001Pack,
  texasAiPack,
  brazilLgpdAiPack,
  indiaDpdpAiPack,
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

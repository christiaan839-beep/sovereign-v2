/**
 * WORKFORCE TRANSFORMATION AUDIT PACK (R72).
 *
 * The sixth vertical product. Distinct from R62 HR Hiring Pack:
 *   - R62 = compliance for AI-driven HIRING decisions (NYC LL144,
 *     Colorado SB 24-205, EEOC, FCRA)
 *   - R72 = compliance for AI-driven RESTRUCTURING decisions
 *     (which jobs to automate vs augment, how to document the
 *     decision, how to defend the layoffs that follow)
 *
 * The wedge: every Fortune 1000 is reading the same workforce-
 * displacement reports right now. They face overlapping legal
 * exposures when they restructure:
 *
 *   1. WARN Act (29 USC 2101+) — 60-day notice for mass layoffs
 *   2. ADEA (29 USC 621+) — disparate-impact on workers 40+
 *   3. NLRA §8 (29 USC 158) — concerted-activity protection +
 *      mandatory bargaining for unionized workers
 *   4. Title VII — disparate impact on protected classes
 *   5. State plant-closing laws (CA WARN, NY WARN, NJ Mini-WARN)
 *   6. EEOC + OFCCP enforcement of disparate-impact statistics
 *   7. ERISA fiduciary duties for benefit-plan changes
 *   8. ADA reasonable accommodation in workforce decisions
 *
 * Forrester's prediction: HALF of "AI-driven layoffs" will be
 * QUIETLY REVERSED because companies make decisions without
 * mature analysis (the "AI washing" pattern). R72 is the pack
 * that prevents this by forcing rigorous, signed, audit-trailed
 * analysis BEFORE any restructuring decision is final.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT make restructuring decisions.
 *     Authorized executives + legal + HR sign every decision
 *     via R34 CADC. The pack DOCUMENTS the analysis defensibly.
 *   - We are NOT a labor-relations firm. Customers must engage
 *     their own labor counsel for unionized workforces.
 *
 * Pricing: $50-300K ACV. Target: Fortune 1000 CHRO + Chief
 * Strategy Officer + COO + General Counsel offices preparing
 * for or executing AI-driven workforce changes.
 */

import type { VerticalPack } from "./types";

export const WORKFORCE_TRANSFORMATION_PACK: VerticalPack = {
  id: "workforce-transformation-v1",
  name: "Workforce Transformation Audit Pack",
  summary:
    "Audit-defensible AI agent infrastructure for Fortune 1000 leaders " +
    "navigating AI-driven workforce restructuring. Every job-task " +
    "automation decision is documented with role-level impact analysis, " +
    "disparate-impact statistics, ADEA/Title VII/WARN-Act compliance " +
    "checks, and a CADC signature chain that makes the restructuring " +
    "defensible against EEOC charges, plant-closing-law claims, and " +
    "shareholder derivative suits. Defends against the Forrester-" +
    "predicted 'AI-washing reversal' pattern by forcing rigorous " +
    "analysis BEFORE decisions are made.",
  version: "1.0.0",
  industry:
    "Workforce strategy — restructuring, automation impact analysis, " +
    "augmentation planning",
  targetBuyerPersona:
    "Chief People Officer, Chief Strategy Officer, COO, Chief AI " +
    "Officer, General Counsel, or Chief Transformation Officer at " +
    "Fortune 1000 employers (>5,000 employees) actively planning " +
    "or executing AI-driven workforce restructuring affecting >100 " +
    "roles. Also serves consulting firms (BCG / McKinsey / Accenture / " +
    "Bain) advising on transformation programs.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "gdpr",
    "ccpa",
    "nist-ai-rmf",
    "eu-ai-act",
  ],

  enabledAgents: [
    "role-task-decomposer",
    "automation-feasibility-scorer",
    "disparate-impact-statistician",
    "warn-act-trigger-analyzer",
    "adea-disparate-impact-analyzer",
    "augmentation-vs-replacement-recommender",
    "skill-gap-analyzer",
    "redeployment-pathway-suggester",
    "severance-package-calculator",
    "transition-communication-drafter",
    "regulatory-update-tracker",
    "workforce-impact-summarizer",
    "union-contract-clause-analyzer",
    "shareholder-disclosure-drafter",
  ],

  hitlRules: [
    {
      id: "workforce-restructuring-decisions-need-signed-analysis",
      description:
        "ANY recommendation that a role be ELIMINATED (vs augmented) " +
        "requires a SIGNED analysis package containing: (1) the role's " +
        "task decomposition, (2) automation feasibility per task, (3) " +
        "disparate-impact statistics across protected classes, (4) " +
        "ADEA-specific age-cohort impact, (5) WARN-Act triggers, " +
        "(6) augmentation alternative explicitly considered + rejected. " +
        "Signed by: Chief People Officer, General Counsel, AND the " +
        "executive accountable for the affected business unit. NEVER " +
        "auto-approved.",
      trigger:
        "agent.action == 'role.elimination_recommendation.draft' OR " +
        "agent.action == 'workforce.restructure_plan.draft'",
      requiredApprovers: 3,
      regulatoryCitation:
        "WARN Act (29 USC 2101 et seq.); ADEA (29 USC 621); " +
        "Title VII (42 USC 2000e); EEOC Compliance Manual §15; " +
        "Forrester 2026 'AI-washing reversal' findings",
    },
    {
      id: "workforce-warn-act-60-day-notice-enforced",
      description:
        "If automation analysis projects >50 employee terminations " +
        "at a single site, OR >33% of workforce, the platform AUTO-" +
        "TRIGGERS the WARN Act 60-day notice timeline. Restructuring " +
        "cannot proceed past the analysis stage without GC signature " +
        "confirming the timeline.",
      trigger: "agent.action == 'warn_act.trigger.detected'",
      requiredApprovers: 1,
      regulatoryCitation:
        "WARN Act 29 USC 2101-2109; 20 CFR Part 639; state mini-WARN " +
        "laws (CA Labor Code §1400+, NY Labor Law §860+, NJ §34:21-2)",
    },
    {
      id: "workforce-adea-disparate-impact-block",
      description:
        "Restructuring plans showing statistically-significant " +
        "disparate impact on workers 40+ (per EEOC's 'four-fifths " +
        "rule' applied to age cohorts) are HARD-BLOCKED until the " +
        "company's General Counsel + outside labor counsel jointly " +
        "review and sign. Defends against ADEA class actions.",
      trigger: "agent.action == 'adea.disparate_impact.detected'",
      requiredApprovers: 2,
      regulatoryCitation:
        "ADEA 29 USC 621; Smith v. City of Jackson, 544 US 228 (2005); " +
        "Meacham v. Knolls Atomic Power Lab, 554 US 84 (2008)",
    },
    {
      id: "workforce-title-vii-disparate-impact-block",
      description:
        "Restructuring plans showing >20% disparate impact on any " +
        "protected class (race, sex, national origin, religion) are " +
        "HARD-BLOCKED until GC + DEI Director jointly sign. The agent " +
        "must explicitly document the business necessity defense + " +
        "the less-discriminatory-alternative analysis.",
      trigger: "agent.action == 'title_vii.disparate_impact.detected'",
      requiredApprovers: 2,
      regulatoryCitation:
        "Title VII 42 USC 2000e-2(k); Wards Cove Packing v. Atonio, " +
        "490 US 642 (1989); 1991 Civil Rights Act §105 (codified " +
        "disparate-impact theory)",
    },
    {
      id: "workforce-union-bargaining-required",
      description:
        "If the affected workforce includes employees covered by a " +
        "collective bargaining agreement, the restructuring plan is " +
        "HARD-BLOCKED until: (1) the relevant CBA's automation/layoff " +
        "clauses are reviewed, (2) §8(a)(5) NLRA mandatory-bargaining " +
        "obligations are documented, (3) labor counsel signs off.",
      trigger: "agent.action == 'union.affected_workforce.detected'",
      requiredApprovers: 2,
      regulatoryCitation:
        "NLRA §8(a)(5) (29 USC 158(a)(5)); First National Maintenance " +
        "Corp v. NLRB, 452 US 666 (1981); Fibreboard Paper Products " +
        "v. NLRB, 379 US 203 (1964)",
    },
    {
      id: "workforce-augmentation-must-be-considered",
      description:
        "Before the agent is allowed to recommend ELIMINATION of any " +
        "role, it MUST first document an AUGMENTATION analysis: how " +
        "the role could be retained with AI assistance, the productivity " +
        "lift expected, retraining cost, and why augmentation is " +
        "rejected (if it is). This rule exists because Forrester's 2026 " +
        "research found that companies skipping augmentation analysis " +
        "are the ones who later REVERSE their AI-driven layoffs.",
      trigger:
        "agent.action == 'role.elimination_recommendation.draft' AND " +
        "input.augmentation_alternative_documented == false",
      requiredApprovers: 0, // hard block until augmentation analysis exists
      regulatoryCitation:
        "INTERNAL_POLICY: Sovereign Workforce Pack v1 — based on " +
        "Forrester 2026 AI Job Impact Forecast findings re. layoff " +
        "reversal patterns; not a regulatory requirement but defends " +
        "against shareholder derivative suits",
    },
    {
      id: "workforce-shareholder-disclosure-counsel-signoff",
      description:
        "Agent-drafted material-disclosure statements about workforce " +
        "restructuring (10-Q / 10-K / 8-K Item 2.05 / proxy statement " +
        "language) require Securities Counsel + CFO sign-off before " +
        "filing. The agent's draft is the starting point; lawyers " +
        "finalize.",
      trigger: "agent.action == 'shareholder_disclosure.workforce.draft'",
      requiredApprovers: 2,
      regulatoryCitation:
        "Securities Exchange Act §13(a); Item 2.05 of Form 8-K " +
        "(material costs of exit/disposal activities); Reg S-K " +
        "Item 303 (MD&A); 17 CFR 240.13a-15 disclosure controls",
    },
    {
      id: "workforce-severance-erisa-compliance",
      description:
        "Severance packages affecting >100 employees may trigger " +
        "ERISA welfare-plan-modification rules + COBRA + state-by-" +
        "state mini-COBRA requirements. Agent drafts the package " +
        "structure; benefits counsel + ERISA counsel sign off.",
      trigger: "agent.action == 'severance.package.draft' AND input.affected_count > 100",
      requiredApprovers: 1,
      regulatoryCitation:
        "ERISA 29 USC 1001+; COBRA 29 USC 1161+; state-by-state " +
        "mini-COBRA (NY DOL §3221, CA Insurance Code §1366.27, etc.)",
    },
  ],

  auditQueries: [
    {
      id: "workforce-audit-restructuring-decisions-1095d",
      title:
        "Restructuring decisions + signature chain (3 years — defends " +
        "against EEOC + ADEA charge windows)",
      description:
        "Every role-elimination decision the platform processed: the " +
        "task-decomposition analysis, the disparate-impact statistics, " +
        "the augmentation-alternative consideration, the WARN-Act " +
        "trigger evaluation, and the 3-signature chain (CHRO + GC + " +
        "business-unit executive). Defends against EEOC charges + " +
        "ADEA collective actions + shareholder derivative suits.",
      audienceContext: "EEOC charge response; ADEA litigation; OFCCP audit",
      actionPrefix: "agent.role.elimination_recommendation.",
      defaultWindowDays: 1095,
    },
    {
      id: "workforce-audit-warn-act-triggers-365d",
      title: "WARN Act trigger events + 60-day notice timeline (365 days)",
      description:
        "Every WARN Act analysis the platform performed: site-level " +
        "termination counts, % of workforce thresholds, state mini-" +
        "WARN multiplications. The 'we did the analysis on time' " +
        "evidence record.",
      audienceContext: "DOL audit; private WARN-Act class action defense",
      actionPrefix: "agent.warn_act.",
      defaultWindowDays: 365,
    },
    {
      id: "workforce-audit-disparate-impact-statistics-1095d",
      title:
        "Disparate-impact statistical analyses (3 years — covers " +
        "extended ADEA + Title VII charge windows)",
      description:
        "Every statistical analysis the platform produced for a " +
        "restructuring decision: protected-class composition before/" +
        "after, four-fifths-rule calculations, business-necessity " +
        "documentation, less-discriminatory-alternative consideration. " +
        "The Wards Cove + Smith v. Jackson defense record.",
      audienceContext:
        "EEOC investigation; ADEA collective action; Title VII class action",
      actionPrefix: "agent.disparate_impact.",
      defaultWindowDays: 1095,
    },
    {
      id: "workforce-audit-augmentation-considered-1095d",
      title:
        "Augmentation-alternative analysis log (3 years — anti-AI-" +
        "washing defense)",
      description:
        "Every augmentation analysis the platform performed before " +
        "an elimination recommendation. Forrester's 2026 research " +
        "shows that COMPANIES THAT SKIP THIS STEP are the ones who " +
        "later reverse their AI-driven layoffs. This query is the " +
        "evidence that the company DID consider augmentation.",
      audienceContext:
        "Shareholder derivative suit defense; board-level transformation review",
      actionPrefix: "agent.augmentation.",
      defaultWindowDays: 1095,
    },
    {
      id: "workforce-audit-union-affected-decisions-365d",
      title: "Union-covered workforce decisions + bargaining-obligation log",
      description:
        "Every restructuring decision affecting unionized workforce: " +
        "CBA clause review, §8(a)(5) bargaining-obligation analysis, " +
        "labor-counsel signature chain.",
      audienceContext: "NLRB unfair-labor-practice charge; CBA grievance",
      actionPrefix: "agent.union.",
      defaultWindowDays: 365,
    },
    {
      id: "workforce-audit-shareholder-disclosures-1095d",
      title: "Material-disclosure drafts + securities-counsel signoff (3 years)",
      description:
        "Every workforce-restructuring material disclosure the platform " +
        "drafted: 10-Q/10-K/8-K Item 2.05 language, MD&A workforce-" +
        "transition narrative, securities counsel + CFO signature chain.",
      audienceContext:
        "SEC investigation; private securities litigation; D&O insurance dispute",
      actionPrefix: "agent.shareholder_disclosure.",
      defaultWindowDays: 1095,
    },
    {
      id: "workforce-audit-anomalies-365d",
      title: "Anomaly Events in Workforce Agent Fleet (365 days)",
      description:
        "Audit-chain anomalies, reputation downgrades, ACT revocations, " +
        "disparate-impact red flags from R57 anomaly detector. The " +
        "'has anything bad happened with our workforce decisions' query.",
      audienceContext: "Internal audit; pre-charge risk review",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "regulated",

  keyOutcomes: [
    "Forrester 'AI-washing reversal' defense by design — no elimination " +
      "recommendation without documented augmentation analysis",
    "ADEA / Title VII disparate-impact statistics auto-computed before " +
      "any layoff plan is finalized; HARD-BLOCK on >20% protected-class " +
      "impact until GC + DEI sign",
    "WARN Act 60-day notice timeline auto-triggered when thresholds " +
      "are projected; GC must sign the timeline before restructuring " +
      "proceeds",
    "Union-covered workforce decisions are HARD-BLOCKED until labor " +
      "counsel reviews CBA + §8(a)(5) obligations",
    "Three-signature requirement on every elimination decision (CHRO + " +
      "GC + business-unit executive) — no single executive can unilaterally " +
      "drive a restructuring",
    "Material disclosure drafts (10-Q / 10-K / 8-K Item 2.05) start as " +
      "agent drafts; securities counsel + CFO finalize",
    "Customer-managed audit-log export (R45) — the restructuring evidence " +
      "package is YOUR property, FOIA-discoverable from your own systems",
    "Defends against shareholder derivative suits arguing the board " +
      "didn't perform due diligence on AI-driven layoffs",
  ],

  defaultDailyLimitCents: 25_000, // $250/day — workforce analysis at scale

  defaultActScopes: {
    // Read-only by default. Workforce agents perform ANALYSIS,
    // they NEVER autonomously commit a restructuring decision.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.analyze.*",
      "agent.score.*",
      "agent.draft.*",
      "agent.summary.*",
      "agent.alert.*",
      "agent.compute.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 50_000,
    maxAcvUsd: 300_000,
    targetCustomerSize:
      "Fortune 1000 employers (>5,000 employees) actively planning or " +
      "executing AI-driven workforce restructuring; consulting firms " +
      "(BCG, McKinsey, Accenture, Bain, Deloitte) advising on " +
      "transformation programs; PE-owned portfolio companies " +
      "executing AI-cost-takeout playbooks",
  },
};

export function getWorkforceTransformationPack(): VerticalPack {
  return WORKFORCE_TRANSFORMATION_PACK;
}

export function isAgentEnabledInWorkforcePack(agentId: string): boolean {
  return WORKFORCE_TRANSFORMATION_PACK.enabledAgents.includes(agentId);
}

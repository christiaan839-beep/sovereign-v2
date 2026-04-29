/**
 * RETAIL & E-COMMERCE COMPLIANCE PACK (R85).
 *
 * The ninth vertical product. Targets retail + e-commerce platforms
 * deploying AI agents into customer experience, sales development,
 * dynamic pricing, content moderation, and recommendation systems.
 *
 * The wedge: retail/e-commerce faces a unique regulatory mix that
 * NO horizontal agent platform addresses end-to-end:
 *
 *   1. CCPA / CPRA — California consumer privacy + sale-of-data rules
 *   2. GDPR — EU customer data; right-to-explanation under Art 22
 *   3. FTC Act §5 — unfair / deceptive practices (FTC AI guidance 2024)
 *   4. PCI DSS 4.0 — cardholder data on every checkout flow
 *   5. ADA Title III — accessibility for online customer journeys
 *      (Robles v. Domino's, Gil v. Winn-Dixie precedents)
 *   6. State dark-patterns laws (CA AB 375, CO Privacy Act, CT Data Privacy)
 *   7. CAN-SPAM Act + state mini-CAN-SPAM laws (marketing comms)
 *   8. EU Omnibus Directive 2019/2161 (price transparency, fake reviews)
 *   9. Children's Online Privacy Protection Act (COPPA) — under-13 users
 *  10. UCC §2-708 + state contract law on automated pricing changes
 *
 * Why this pack exists: AI agents in retail face the FTC + state
 * AGs as primary enforcers. Klarna's 2024 reversal of replacing 700
 * customer service reps shows what happens when augmentation is
 * skipped. Klaviyo + similar martech stacks need cryptographic
 * accountability for every customer-facing AI decision.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - This pack does NOT process payment cards directly. PCI DSS
 *     scope reduction is a customer responsibility (use a PCI-
 *     compliant payment processor; agents only see tokenized
 *     references).
 *   - We are NOT a Data Protection Officer (DPO). EU customers
 *     must designate their own per GDPR Art 37.
 *
 * Pricing: $30-150K ACV. Target: mid-market + enterprise retailers
 * ($50M-$10B revenue), e-commerce platforms (Shopify Plus +,
 * BigCommerce Enterprise), DTC brands at scale, and martech
 * platforms (Klaviyo, Braze, Iterable) deploying customer-facing
 * AI agents.
 */

import type { VerticalPack } from "./types";

export const RETAIL_ECOMMERCE_PACK: VerticalPack = {
  id: "retail-ecommerce-v1",
  name: "Retail & E-Commerce Compliance Pack",
  summary:
    "Customer-experience-grade AI agent infrastructure for mid-market + " +
    "enterprise retailers, e-commerce platforms, DTC brands, and martech " +
    "platforms. Every customer-facing agent action — pricing change, " +
    "promotion send, recommendation surface, support response, content " +
    "moderation decision — is signed by a designated employee's Ed25519 " +
    "key (R34 CADC); every CCPA/GDPR data-subject request is traceable " +
    "end-to-end; every AI-driven dynamic pricing decision is logged with " +
    "the underlying signal so FTC §5 unfairness investigations can " +
    "reconstruct the decision; every accessibility-related agent " +
    "interaction is captured for ADA Title III defense (Robles v. " +
    "Domino's pattern). Built to align with PCI DSS 4.0 (tokenized scope " +
    "only), GDPR Art 22 (right to explanation), and FTC AI guidance.",
  version: "1.0.0",
  industry:
    "Retail + e-commerce — customer experience, dynamic pricing, " +
    "marketing automation, recommendation systems, content moderation",
  targetBuyerPersona:
    "Chief Customer Officer, VP of E-Commerce, VP of Customer Experience, " +
    "Chief Marketing Officer, Director of Trust & Safety, or VP of " +
    "Compliance at mid-market + enterprise retailers ($50M-$10B revenue), " +
    "e-commerce platforms (Shopify Plus +, BigCommerce Enterprise, " +
    "Salesforce Commerce Cloud customers), DTC brands at scale, and " +
    "martech platforms (Klaviyo, Braze, Iterable, Bloomreach) deploying " +
    "customer-facing AI agents.",

  complianceFrameworks: [
    "soc2-type-ii",
    "iso-27001",
    "gdpr",
    "ccpa",
    "pci-dss",
    "nist-ai-rmf",
  ],

  enabledAgents: [
    "customer-service-tier1-triage",
    "order-status-explainer",
    "return-policy-interpreter",
    "product-recommendation-personalizer",
    "dynamic-pricing-recommender",
    "promotion-eligibility-checker",
    "fraud-pattern-flagger",
    "content-moderator",
    "review-authenticity-checker",
    "chargeback-evidence-compiler",
    "ccpa-data-subject-request-router",
    "gdpr-art22-explanation-drafter",
    "ada-accessibility-interaction-logger",
    "audit-trail-summarizer",
    "regulatory-update-tracker",
  ],

  hitlRules: [
    {
      id: "retail-customer-replacement-must-augment-not-replace",
      description:
        "Customer-facing service agents NEVER autonomously close a " +
        "high-value (>$500) support interaction. The agent triages, " +
        "drafts, and surfaces — but a human service representative " +
        "must Ed25519-sign the resolution before the customer sees " +
        "it. This rule exists because of the Klarna 2024 case (replaced " +
        "700 customer service reps with AI, customer satisfaction " +
        "tanked, complaints rose 40%, publicly reversed). We will not " +
        "let any deployment repeat that mistake.",
      trigger:
        "agent.action == 'customer.support.resolve' AND " +
        "(interaction.value_cents > 50000 OR interaction.escalation_level > 1)",
      requiredApprovers: 1,
      regulatoryCitation:
        "FTC Act §5 (unfair/deceptive); FTC AI Guidance (May 2024); " +
        "Klarna 2024 customer-service-reversal precedent (industry " +
        "post-mortem)",
    },
    {
      id: "retail-dynamic-pricing-fairness-block",
      description:
        "Agent-recommended dynamic pricing changes that would result " +
        "in (1) >25% price increase from baseline, (2) different " +
        "prices shown to users in protected classes, or (3) prices " +
        "below cost (predatory pricing risk) are HARD-BLOCKED until " +
        "Pricing Director + General Counsel jointly review and sign. " +
        "FTC + state AGs are the primary enforcers of unfair pricing " +
        "practices.",
      trigger:
        "agent.action == 'pricing.dynamic.recommend' AND " +
        "(price.delta_pct > 25 OR " +
        "price.protected_class_variance_detected == true OR " +
        "price.below_cost == true)",
      requiredApprovers: 2,
      regulatoryCitation:
        "FTC Act §5 (unfair pricing); Robinson-Patman Act (price " +
        "discrimination); state UDAP statutes (CA Bus & Prof Code " +
        "§17200, NY GBL §349)",
    },
    {
      id: "retail-ccpa-data-subject-request-counsel-review",
      description:
        "Any agent-drafted response to a CCPA/CPRA data-subject access " +
        "request, deletion request, or opt-out-of-sale request requires " +
        "Privacy Officer review + Ed25519 sign-off (R34 CADC) BEFORE " +
        "transmission to the consumer. Failed responses are the #1 " +
        "source of California AG enforcement actions.",
      trigger:
        "agent.action == 'ccpa.dsr.response.draft' OR " +
        "agent.action == 'ccpa.deletion.confirmation.draft' OR " +
        "agent.action == 'ccpa.opt_out_of_sale.confirmation.draft'",
      requiredApprovers: 1,
      regulatoryCitation:
        "CCPA Cal. Civ. Code §1798.100 et seq.; CPRA (Prop 24); " +
        "CA AG enforcement guidance + 2024 settlements",
    },
    {
      id: "retail-gdpr-art22-explanation-required",
      description:
        "When an agent makes an automated decision affecting a " +
        "customer (loan approval, pricing, fraud determination, " +
        "account suspension), the platform AUTO-GENERATES the GDPR " +
        "Art 22 explanation + opt-out-of-automation notice. The " +
        "responsible business owner signs each customer-facing " +
        "explanation before sending.",
      trigger:
        "agent.action == 'automated_decision.commit' AND " +
        "subject.in_eea == true",
      requiredApprovers: 1,
      regulatoryCitation:
        "GDPR Art 22 (automated individual decision-making); " +
        "EDPB Guidelines 03/2022 on AI; GDPR Art 13(2)(f) (transparency)",
    },
    {
      id: "retail-coppa-under-13-block",
      description:
        "If the platform detects a user is under 13 (per COPPA " +
        "verifiable parental consent rules), agent-driven personalization, " +
        "marketing comms, and behavioral targeting are HARD-BLOCKED. " +
        "FTC COPPA fines have reached $245M (TikTok 2025). Defense by " +
        "design.",
      trigger:
        "agent.action LIKE 'personalize.%' AND user.age < 13",
      requiredApprovers: 0, // hard block
      regulatoryCitation:
        "COPPA 15 USC §6501-6506; 16 CFR Part 312; FTC enforcement " +
        "(YouTube $170M 2019, TikTok $5.7M 2019, TikTok $245M 2025)",
    },
    {
      id: "retail-ada-accessibility-interaction-logged",
      description:
        "Every agent interaction with a screen-reader-using or " +
        "keyboard-only user is logged with full interaction trace. " +
        "This is the Robles v. Domino's defense: courts have ruled " +
        "automated systems must be ADA-accessible; AI agent " +
        "deployments must capture accessibility-relevant interactions " +
        "for litigation defense.",
      trigger: "agent.interaction.has_accessibility_indicators == true",
      requiredApprovers: 0, // automatic logging, no human approval
      regulatoryCitation:
        "ADA Title III (42 USC §12181 et seq.); Robles v. Domino's " +
        "Pizza, 913 F.3d 898 (9th Cir. 2019); Gil v. Winn-Dixie, 257 " +
        "F.Supp.3d 1340 (S.D. Fla. 2017); WCAG 2.1 AA",
    },
    {
      id: "retail-fake-review-detection-trust-and-safety-signoff",
      description:
        "Agent-detected fake or AI-generated reviews are flagged for " +
        "Trust & Safety review BEFORE removal. False removals expose " +
        "the platform to FTC enforcement under the Endorsement Guides " +
        "+ unfair-competition theories.",
      trigger: "agent.action == 'review.fake.flagged'",
      requiredApprovers: 1,
      regulatoryCitation:
        "FTC Endorsement Guides (16 CFR Part 255); FTC Final Rule on " +
        "Fake Reviews (effective Oct 2024); EU Omnibus Directive " +
        "2019/2161",
    },
    {
      id: "retail-pci-dss-card-data-never-in-prompt",
      description:
        "PII guard (`src/lib/pii-guard.ts`) enforces that primary " +
        "account numbers (PANs) NEVER appear in agent prompts or " +
        "outputs. PCI DSS 4.0 scope is reduced to tokenized references " +
        "only. Any detected PAN triggers a HARD-BLOCK + immediate " +
        "Privacy Officer + DPO notification.",
      trigger:
        "input.contains_primary_account_number == true OR " +
        "output.contains_primary_account_number == true",
      requiredApprovers: 0, // hard block
      regulatoryCitation:
        "PCI DSS 4.0 (effective March 2024); PCI Council compliance " +
        "guidance; Card Brand operating regulations",
    },
  ],

  auditQueries: [
    {
      id: "retail-audit-customer-service-resolutions-365d",
      title:
        "Customer service resolutions + human-signoff chain (365 days)",
      description:
        "Every agent-drafted customer service interaction, the human " +
        "rep who signed it, the customer's rated outcome. The Klarna-" +
        "case-defense record + the FTC §5 unfairness defense.",
      audienceContext:
        "FTC unfairness investigation; class-action customer service " +
        "claims; CSAT trend analysis",
      actionPrefix: "agent.customer.support.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-pricing-decisions-1095d",
      title: "Dynamic pricing decisions + fairness analysis (3 years)",
      description:
        "Every agent-recommended pricing change, the underlying signal, " +
        "the price delta, the protected-class-variance check result, " +
        "and the dual-approver chain (when blocked). Defends FTC + " +
        "state AG unfairness investigations.",
      audienceContext:
        "FTC pricing investigation; state AG enforcement (CA, NY); " +
        "Robinson-Patman class action defense",
      actionPrefix: "agent.pricing.",
      defaultWindowDays: 1095,
    },
    {
      id: "retail-audit-ccpa-dsr-pipeline-365d",
      title:
        "CCPA/CPRA data-subject request pipeline + Privacy Officer " +
        "signoff (365 days)",
      description:
        "Every CCPA access / deletion / opt-out request, response time, " +
        "Privacy Officer signature chain. Defends California AG " +
        "enforcement (DSR violations are the #1 enforcement category).",
      audienceContext:
        "CA AG enforcement examination; CPRA private right of action",
      actionPrefix: "agent.ccpa.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-gdpr-art22-explanations-365d",
      title: "GDPR Art 22 explanation drafts + delivery confirmation",
      description:
        "Every automated-decision explanation drafted for an EEA " +
        "subject, the responsible business owner's signature, the " +
        "delivery timestamp. Defends EU DPA enforcement.",
      audienceContext: "EU DPA investigation; GDPR Art 22 dispute",
      actionPrefix: "agent.gdpr.art22.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-ada-accessibility-365d",
      title: "ADA Title III accessibility-interaction log",
      description:
        "Every agent interaction with screen-reader, keyboard-only, " +
        "or assistive-technology users. Defends Robles-class ADA " +
        "Title III private litigation.",
      audienceContext:
        "ADA Title III private lawsuit; DOJ accessibility audit",
      actionPrefix: "agent.accessibility.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-fake-review-detections-365d",
      title: "Fake-review detections + Trust & Safety signoff",
      description:
        "Every agent-flagged fake/AI-generated review, the T&S " +
        "reviewer signature, the disposition (removed / kept). Defends " +
        "FTC Endorsement Guides + Final Rule enforcement.",
      audienceContext: "FTC Endorsement Guides enforcement; FTC fake " +
        "reviews rule audit",
      actionPrefix: "agent.review.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-pci-dss-pan-incidents-365d",
      title: "PCI DSS PAN-leakage attempts (blocked) + DPO notifications",
      description:
        "Every primary-account-number detection event blocked by the " +
        "PII guard, the DPO notification timestamp, the post-incident " +
        "scope-impact analysis. Defends PCI Council audit + Card Brand " +
        "operating-regulation reviews.",
      audienceContext:
        "PCI DSS 4.0 quarterly assessment; Card Brand audit",
      actionPrefix: "agent.pci.pan.",
      defaultWindowDays: 365,
    },
    {
      id: "retail-audit-anomalies-365d",
      title: "Anomaly events in retail agent fleet (365 days)",
      description:
        "Audit-chain anomalies, R73 multi-turn jailbreak attempts " +
        "(retail platforms are high-value attack targets for promo " +
        "abuse), reputation downgrades, ACT revocations.",
      audienceContext: "Internal trust & safety review; pre-incident risk",
      actionPrefix: "anomaly.",
      defaultWindowDays: 365,
    },
  ],

  slaTier: "professional",

  keyOutcomes: [
    "Klarna-case defense by design — high-value customer service " +
      "interactions ALWAYS have a human signer; agents augment, not " +
      "replace",
    "FTC §5 unfairness defense — every dynamic pricing decision logged " +
      "with the underlying signal + protected-class variance check",
    "CCPA/CPRA enforcement defense — Privacy Officer signature on every " +
      "data-subject-request response",
    "GDPR Art 22 right-to-explanation auto-generated for EEA customers; " +
      "right-to-opt-out-of-automation always offered",
    "ADA Title III defense — accessibility-relevant interactions " +
      "captured end-to-end (Robles v. Domino's pattern)",
    "COPPA HARD-BLOCK on under-13 personalization — the FTC $245M " +
      "TikTok-class enforcement defense",
    "PCI DSS 4.0 scope reduction — PANs NEVER reach agent prompts; " +
      "tokenized references only",
    "Customer-managed audit-log export to YOUR S3 (R45) — your retail " +
      "decision history is FTC-discoverable from your own systems",
  ],

  defaultDailyLimitCents: 20_000, // $200/day — retail customer-touch volume

  defaultActScopes: {
    // Read-only by default. Retail agents triage, draft, classify, alert,
    // analyze, recommend — they NEVER autonomously commit pricing
    // changes, send marketing, modify customer accounts, or close
    // high-value support cases.
    max_cents: 0,
    actions_allowed: [
      "agent.read.*",
      "agent.draft.*",
      "agent.classify.*",
      "agent.recommend.*",
      "agent.alert.*",
      "agent.summary.*",
      "agent.analyze.*",
      "agent.triage.*",
      "agent.flag.*",
    ],
    require_hitl_above_cents: 0,
  },

  pricingTier: {
    minAcvUsd: 30_000,
    maxAcvUsd: 150_000,
    targetCustomerSize:
      "Mid-market + enterprise retailers ($50M-$10B revenue), " +
      "e-commerce platforms (Shopify Plus +, BigCommerce Enterprise, " +
      "Salesforce Commerce Cloud customers, Magento Commerce), " +
      "DTC brands at scale (Glossier, Allbirds, Warby Parker tier), " +
      "and martech platforms (Klaviyo, Braze, Iterable, Bloomreach, " +
      "Movable Ink) deploying customer-facing AI agents.",
  },
};

export function getRetailEcommercePack(): VerticalPack {
  return RETAIL_ECOMMERCE_PACK;
}

export function isAgentEnabledInRetailPack(agentId: string): boolean {
  return RETAIL_ECOMMERCE_PACK.enabledAgents.includes(agentId);
}

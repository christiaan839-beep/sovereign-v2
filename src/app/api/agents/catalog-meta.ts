/**
 * AGENT CATALOG METADATA — what to surface publicly.
 *
 * The AGENT_REGISTRY at ./registry.ts is auto-generated from every
 * `src/app/api/_agents/{slug}/route.ts` and includes every agent that has
 * a handler. That's 131 agents — more than we want to showcase to
 * a prospect trying to evaluate the platform.
 *
 * This file is HAND-MAINTAINED. It's the curated set of agents
 * the /api/agents public catalog returns to unauthenticated callers
 * and the /playbooks marketing page links to. Authenticated
 * dashboard users still see all 131 via the direct registry.
 *
 * When you ship a new agent:
 *   1. Auto-registry picks it up on next `npm run gen:registry`
 *   2. If it's marketing-worthy (visible outcome, customer-valuable)
 *      add its slug to FEATURED_AGENTS below
 *   3. If it's infrastructure (embed, rerank, pii-guard), don't
 *
 * The cut from 131 → ~30 comes from this principle:
 *   "A prospect evaluating the catalog can understand what each of
 *    these does in one line and imagine using it."
 *
 * Everything not in this list is still fully callable — we just
 * don't brag about them in public listings.
 */

export const FEATURED_AGENTS: ReadonlySet<string> = new Set([
  // Growth — lead gen, outreach, conversion
  "leads",
  "abm-artillery",
  "booking",
  "email-sequence",
  "closer",

  // Content generation
  "blog-gen",
  "content",
  "ads",
  "case-study",
  "brand-voice",
  "product-description-writer",

  // SEO + research
  "seo-dominator",
  "competitor",
  "grounded-search",
  "market-analysis",

  // Intelligence + analysis
  "agentic-chain",
  "agentic-planner",
  "god-brain",
  "meeting-notes",
  "contract-analyzer",
  "review-analyzer",

  // Finance — new verticals
  "invoice-extractor",
  "expense-categorizer",

  // HR — new vertical
  "resume-screener",
  "offer-letter-gen",

  // Legal — expanding
  "nda-triage",

  // Developer-facing
  "code-reviewer",
  "translate",
  "claude-think",
  "sql-generator",
  "test-generator",

  // Accessibility
  "alt-text-generator",
  "plain-language-rewriter",

  // Productivity
  "daily-briefing",

  // Orchestration / control-plane
  "smart-router",
  "coordinator",
  "consensus",

  // A2E moat — agents that help other agents (platform differentiator)
  "agent-builder",
  "agent-reviewer",
  "playbook-builder",
  "cost-optimizer",
  "prompt-ab-tester",
  "agent-pricer",

  // Safety + compliance
  "content-safety",
  "pii-guard",

  // Media
  "image-gen",
  "flux-image",
  "voice-synth",

  // Integrations
  "slack-notify",
]);

export function isFeaturedAgent(slug: string): boolean {
  return FEATURED_AGENTS.has(slug);
}

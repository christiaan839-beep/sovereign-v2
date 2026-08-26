/**
 * FEATURED AGENTS — production-grade subset of AGENT_SLUGS.
 *
 * The full registry has 140 agent route folders (see agent-slugs.ts).
 * This file pins the subset that's tested, polished, and demo-ready —
 * the agents we're willing to put in front of a paying customer or
 * recruiter without a "this is a stub" caveat.
 *
 * Why this matters: claiming "137 production agents" overstates what
 * the platform actually delivers. Half the long tail is scaffolding for
 * the marketplace creator economy. Honest framing is "30 featured
 * agents + 100+ developer-API extensions" — the platform supports
 * either, the marketing leads with the polished thirty.
 *
 * To promote an agent into FEATURED status:
 *   1. Verify its route handler ships real output (no TODOs, no stubs).
 *   2. Run it 5x with different inputs; confirm output quality.
 *   3. Confirm it's on at least one playbook in src/lib/playbooks.ts
 *      OR one deliverable in src/lib/marketplace-deliverables.ts.
 *   4. Add the slug to FEATURED_AGENTS below.
 *
 * The marketplace UI defaults to FEATURED. Users can toggle to "all
 * 140 agents" if they want to browse the long tail.
 */

import { AGENT_SLUG_SET } from "@/lib/agent-slugs";

/**
 * 30 production-grade agents. Grouped by category in the comment so
 * future contributors can see what each one is for.
 */
export const FEATURED_AGENTS: ReadonlyArray<string> = Object.freeze([
  // Lead generation engine (5)
  "leads",
  "abm-artillery",
  "ghost-fleet",
  "outbound",
  "closer",

  // Content publishing engine (5)
  "content",
  "blog-gen",
  "social-router",
  "email-sequence",
  "organic-content",

  // Competitor intelligence (4)
  "competitor",
  "competitor-scan",
  "competitive-radar",
  "brand-audit",

  // Voice + cold-call conversion (4)
  "voice",
  "voice-closer",
  "voice-assistant",
  "voice-chat",

  // Customer onboarding (4)
  "auto-onboard",
  "email-onboard",
  "contract-analyzer",
  "client-report",

  // Strategic decision (4)
  "god-brain",
  "war-room",
  "deep-search",
  "deep-think",

  // Code + safety (4)
  "code-agent",
  "code-reviewer",
  "audit",
  "content-safety",
]);

export const FEATURED_AGENT_SET: ReadonlySet<string> = new Set(FEATURED_AGENTS);

/** Total count for marketing surfaces. Always reads from this file so a
 *  copy update doesn't require touching the marketplace UI. */
export const FEATURED_COUNT = FEATURED_AGENTS.length;

/** All registered agent count (for "and X more in the developer API"
 *  framing). Read at runtime since AGENT_SLUG_SET is the source of truth. */
export function getAllAgentCount(): number {
  return AGENT_SLUG_SET.size;
}

/** Sanity-check helper — flags any FEATURED slug that isn't in
 *  AGENT_SLUG_SET. Used by the test below; also useful at dev runtime. */
export function findOrphanFeaturedAgents(): string[] {
  return FEATURED_AGENTS.filter((slug) => !AGENT_SLUG_SET.has(slug));
}

/**
 * AGENT TIERS — quality gating for the marketplace surface.
 *
 * The platform ships ~140 agent endpoints. Roughly 15 are flagship —
 * curated copy, marketing pages, real test coverage. The rest are
 * useful long-tail tools: shipped, tested at the factory level, but
 * not individually marketed.
 *
 * This module is the single source of truth for which is which. The
 * marketplace UI uses it to:
 *   - feature `core` agents prominently
 *   - hide `experimental` agents unless `?experimental=1` or the user
 *     is admin
 *   - render `deprecated` agents with a sunset banner
 *
 * Default tier (when a slug isn't classified here) is `experimental`
 * — opt-in promotion to `core` keeps the front page tight.
 */

export type AgentTier = "core" | "experimental" | "deprecated";

/** Hand-curated flagship list — these get marketing priority. */
const CORE: ReadonlySet<string> = new Set([
  "god-brain",
  "war-room",
  "computer-use",
  "image-gen",
  "smart-router",
  "agency-packet",
  "sourcing-sprint",
  "growth-pulse",
  "listing-pulse",
  "lead-blitz",
  "content-machine",
  "competitor-takedown",
  "voicechat",
  "blog-gen",
  "email-onboard",
  "research",
  "deep-research",
]);

/**
 * Slugs explicitly marked for sunset.
 *
 * UI hides these from the marketplace grid but the underlying routes
 * keep working — anyone with a deep link still gets a response. Use
 * for vertical-specific stubs nobody is currently shipping demos
 * against. Promote back to "experimental" the moment a real
 * conversation surfaces a use case.
 *
 * Audit: every entry below has zero non-registry references in the
 * marketing site, dashboard, or playbooks as of 2026-05-11. They were
 * built as exploratory verticals and never made it to a customer
 * conversation.
 */
const DEPRECATED: ReadonlySet<string> = new Set([
  "agri-intel", // agriculture vertical stub
  "competitor-rip", // duplicates competitor-takedown / competitor-scan
  "compliance-monitor", // overlaps the audit + privacy stack
  "healthcare-docs", // healthcare vertical stub
  "prior-auth", // healthcare prior-authorization stub
  "supply-chain", // supply-chain vertical stub
  "threat-hunt", // security vertical stub
]);

export function getAgentTier(slug: string): AgentTier {
  if (DEPRECATED.has(slug)) return "deprecated";
  if (CORE.has(slug)) return "core";
  return "experimental";
}

export function isCoreAgent(slug: string): boolean {
  return getAgentTier(slug) === "core";
}

export function isDeprecatedAgent(slug: string): boolean {
  return getAgentTier(slug) === "deprecated";
}

/** Filter a list of slugs by tier. */
export function filterByTier(
  slugs: ReadonlyArray<string>,
  tier: AgentTier,
): string[] {
  return slugs.filter((s) => getAgentTier(s) === tier);
}

/** Used by the marketplace landing page to keep the surface focused. */
export function partitionAgents(slugs: ReadonlyArray<string>): {
  core: string[];
  experimental: string[];
  deprecated: string[];
} {
  const out = {
    core: [] as string[],
    experimental: [] as string[],
    deprecated: [] as string[],
  };
  for (const slug of slugs) out[getAgentTier(slug)].push(slug);
  return out;
}

/** Sort comparator: core first, experimental next, deprecated last. */
export function tierComparator(a: string, b: string): number {
  const order = { core: 0, experimental: 1, deprecated: 2 };
  return order[getAgentTier(a)] - order[getAgentTier(b)];
}

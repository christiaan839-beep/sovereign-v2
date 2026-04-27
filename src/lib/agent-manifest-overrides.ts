/**
 * AGENT MANIFEST OVERRIDES — manual corrections to the static analyzer.
 *
 * When `scripts/analyze-agent-manifests.mjs` under-classifies an agent
 * (the static rules don't catch a less-obvious control flow — e.g.,
 * the agent uses an SDK whose method call doesn't match our regex),
 * operators record the correction here. Each override carries a
 * `reason` string so the next reviewer understands why.
 *
 * The override merge order at runtime:
 *   1. Auto-generated manifest from agent-manifests.generated.ts
 *   2. Override here (if present) replaces specified fields
 *   3. Final manifest exposed at /api/_meta/agents.json
 *
 * The merger also COMPARES override vs generated and surfaces any
 * mismatches in `weekly-health.mjs` so we can tell when the static
 * analyzer has caught up to a previously-overridden classification
 * (and the override can be retired).
 */

import type { AgentManifest, AgentTier } from "./agent-manifest";

export interface AgentManifestOverride {
  slug: string;
  tier?: AgentTier;
  tierReason?: string;
  outputClass?: AgentManifest["outputClass"];
  reason: string; // why the override exists — visible to auditors
}

/**
 * The pre-existing `action-tiers.ts` classification, restated here as
 * overrides with rationale. These are the ground truth — the static
 * analyzer should converge on them; the gap between generated tier
 * and override tier is published as a transparency metric.
 */
export const AGENT_MANIFEST_OVERRIDES: AgentManifestOverride[] = [
  // Tier 3 — known destructive / high-impact agents.
  {
    slug: "voice-closer",
    tier: 3,
    tierReason: "Tier 3: places outbound phone calls (Twilio Voice)",
    reason:
      "Outbound dialing is regulated (TCPA in US, POPIA Section 12 in ZA). The static analyzer caught network egress and assigned Tier 2; the right tier is Tier 3 because the dialer talks directly to live humans. This override should retire when the analyzer learns the `twilio.calls.create(` pattern.",
  },
  {
    slug: "computer-use",
    tier: 3,
    tierReason: "Tier 3: takes control of a browser session (Anthropic Computer Use)",
    reason:
      "The Anthropic Computer Use API gives Claude full browser control — clicks, types, takes screenshots, runs bash. Browser control is one of the highest-blast-radius capabilities a hosted agent can have; admin approval is mandatory before any session starts. Override should retire when the analyzer recognizes the `computer_20241022` Anthropic tool definition.",
  },
  {
    slug: "whitelabel",
    tier: 3,
    tierReason: "Tier 3: modifies tenant DNS / domain / branding configuration",
    reason:
      "Domain + branding changes propagate to every customer-facing surface; a misfire blanks every tenant page. Manual approval gate is non-negotiable. The static analyzer doesn't yet model `whitelabel-config` writes — override stands until it does.",
  },

  // Tier 2 confirmations — agents that the analyzer might pretend
  // are Tier 1 because the side effect happens via a library import
  // we haven't taught the regex yet.
  {
    slug: "leads",
    tier: 2,
    tierReason: "Tier 2: writes leads to the user's CRM via downstream tool",
    reason:
      "Lead generation isn't read-only — the output is meant to be persisted, often via a `data-export` or `crm-push` follow-up agent. Classifying it Tier 2 is a UX choice (we want users to see + confirm before commit), not strictly required by source-code patterns.",
  },
  {
    slug: "blog-gen",
    tier: 2,
    tierReason: "Tier 2: generates content the user will publish",
    reason:
      "Generated blog content reaches the public web on publish. Even though the agent itself doesn't call out, the output is high-stakes enough to warrant a confirmation step before downstream publication.",
  },
];

/**
 * Look up override (if any) for an agent slug. Returns null when
 * generated manifest is the ground truth.
 */
export function getAgentOverride(slug: string): AgentManifestOverride | null {
  return (
    AGENT_MANIFEST_OVERRIDES.find((o) => o.slug === slug) ?? null
  );
}

/**
 * Merge generated manifest + override → final manifest. Pure function.
 */
export function applyOverride(
  generated: AgentManifest,
  override: AgentManifestOverride | null,
): AgentManifest {
  if (!override) return generated;
  return {
    ...generated,
    ...(override.tier !== undefined ? { tier: override.tier } : {}),
    ...(override.tierReason ? { tierReason: override.tierReason } : {}),
    ...(override.outputClass ? { outputClass: override.outputClass } : {}),
    tierOverridden:
      override.tier !== undefined && override.tier !== generated.tier,
  };
}

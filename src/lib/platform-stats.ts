/**
 * PLATFORM STATS — single source of truth for the numeric claims
 * the landing page and dashboard surface to visitors.
 *
 * Round 25. The audit found the agent total drifting across 6+
 * literals on a single page (137 / 198 / 203 / 218 / 223 / 130+).
 * For a platform whose entire trust narrative is "every claim has
 * a source", that drift is the worst kind of slop — credibility
 * erodes in 30 seconds with Cmd-F.
 *
 * The fix: every numeric claim that appears in user-visible copy
 * imports from THIS file. The values themselves derive from the
 * generated agent-manifests count + hand-curated counts that have
 * their own anti-drift gates (model registry, integrations).
 *
 * If we want to change the displayed number, we change it ONCE here,
 * and every page picks it up. No more drift. The anti-drift gate in
 * scripts/weekly-health.mjs verifies these numerics match their
 * source-of-truth files (e.g. AGENT_MANIFEST_COUNT in the generated
 * file).
 */

import { AGENT_MANIFEST_COUNT } from "./agent-manifests.generated";

/**
 * Total number of registered agents on the platform.
 *
 * Source of truth: src/lib/agent-manifests.generated.ts, which is
 * itself derived from src/app/api/_agents/* by the generator script
 * (scripts/generate-agent-manifests.mjs). Anti-drift gate verifies
 * the count.
 *
 * Use this in EVERY place the count is shown — landing hero, nav
 * dropdown, final CTA, dashboard badge, ConstellationPreview, etc.
 * Hardcoding "223" anywhere is a regression and the anti-drift gate
 * catches it.
 */
export const TOTAL_AGENTS = AGENT_MANIFEST_COUNT;

/**
 * Total models across all providers (NIM, Gemini, Claude, Groq,
 * Cerebras, DeepSeek, Alibaba, Ollama). Round 14 sprint set this
 * to 39+; subsequent additions should bump this AND
 * the model registry tests.
 *
 * Anti-drift gate: matches the count produced by /api/_meta/transparency
 * if the model registry is wired through it; otherwise this is the
 * curated number we display.
 */
export const TOTAL_MODELS = 39;

/**
 * Pre-built playbooks (lead-blitz, content-machine, etc).
 * Source of truth: src/lib/playbooks.ts list length.
 */
export const TOTAL_PLAYBOOKS = 26;

/**
 * Number of safety layers in the verification pipeline. NOT a marketing
 * count — this maps 1:1 to the 5 actual checks in src/lib/output-verifier.ts:
 * jailbreak / PII / content-policy / quality / Claude critic.
 */
export const SAFETY_LAYERS = 5;

/**
 * Anti-drift CI invariants count. Bumps when scripts/weekly-health.mjs
 * gains new checks. Surfaced on /security and HONEST-GAPS for the
 * "we lock in our claims with CI" story.
 */
export const ANTI_DRIFT_INVARIANTS = 109;

/**
 * Helper to format the count compactly when needed inline (e.g.
 * "223+ agents"). Prefer the bare number unless the surrounding
 * copy specifically calls for the +.
 */
export function formatAgentCount(opts: { trailingPlus?: boolean } = {}): string {
  return opts.trailingPlus ? `${TOTAL_AGENTS}+` : `${TOTAL_AGENTS}`;
}

/**
 * The counts this repository is allowed to publish.
 *
 * CLAUDE.md: "count it rather than quoting a number from memory, and never
 * publish a figure this repo cannot produce."
 *
 * That instruction existed and the site published "39+ models" on ten
 * surfaces — including the OpenGraph image, so on every link preview — while
 * the registry held twenty. The agent count had drifted to six different
 * values across live pages and outbound email: 126, 129, 130, 130+, 131, 137
 * and 140.
 *
 * A number typed into a marketing string cannot be kept true by intention.
 * These are derived from the registries at module load, so a figure moves when
 * the thing it counts moves, and `published-counts.test.ts` fails the build if
 * a hardcoded count reappears in published source.
 */
import { MODELS } from "./model-registry";
import { AGENT_SLUGS } from "@/app/api/agents/registry";

/** Models in the registry. The only model figure that may be published. */
export const MODEL_COUNT = Object.keys(MODELS).length;

/** Distinct providers across those models. */
export const PROVIDER_COUNT = new Set(
  Object.values(MODELS).map((m) => m.provider),
).size;

/** Agents in the registry. The only agent figure that may be published. */
export const AGENT_COUNT = AGENT_SLUGS.length;

/**
 * Ready-made strings, so a page interpolates a derived value rather than
 * retyping one. Singular/plural handled because "1 models" is its own tell.
 */
export const MODELS_LABEL = `${MODEL_COUNT} model${MODEL_COUNT === 1 ? "" : "s"}`;
export const AGENTS_LABEL = `${AGENT_COUNT} agent${AGENT_COUNT === 1 ? "" : "s"}`;
export const PROVIDERS_LABEL = `${PROVIDER_COUNT} provider${PROVIDER_COUNT === 1 ? "" : "s"}`;

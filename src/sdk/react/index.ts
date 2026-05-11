/**
 * @sovereign-matrix/agent-sdk/react — React surface of the SDK.
 *
 * Re-exports the components that customers drop into their React apps:
 *   - <SovereignBadge id="..." /> — verified-receipt badge
 *
 * Pairs with the HTTP client (src/sdk/client.ts) and the agent-author
 * framework (src/sdk/index.ts). Three layers, one package, three import
 * paths so customers only pay for what they use.
 */

export { SovereignBadge } from "./SovereignBadge";
export type {
  SovereignBadgeProps,
  SovereignBadgeTheme,
} from "./SovereignBadge";

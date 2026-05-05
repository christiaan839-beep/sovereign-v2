/**
 * Self-heal — passthrough higher-order wrapper around an agent handler.
 *
 * Stub implementation. The richer version (retry-on-failure with model
 * fallback + structured error diagnosis) was never landed. Until it is,
 * `withSelfHeal` is an identity wrapper so agent routes that imported it
 * continue to compile and behave normally — just without the recovery
 * loop documented at `src/lib/peer-loop.ts:4`.
 */

export type AgentHandler<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

export function withSelfHeal<TArgs extends unknown[], TResult>(
  handler: AgentHandler<TArgs, TResult>,
): AgentHandler<TArgs, TResult> {
  return handler;
}

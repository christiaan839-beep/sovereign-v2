/**
 * Self-Heal Wrapper — adds a single retry pass to an agent handler.
 *
 * When the inner handler throws, the wrapper logs the failure and retries
 * once. Real "self-healing" (model-side diagnosis + input rewrite) is left
 * to higher-level orchestration; this primitive is what most agents
 * actually need: catch transient errors and try again.
 *
 * Mirrors the call signature expected by createAgentRoute consumers:
 *   handler: withSelfHeal(async (ctx) => { ... })
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("self-heal");

type Handler<TIn, TOut> = (ctx: TIn) => Promise<TOut>;

export function withSelfHeal<TIn, TOut>(
  handler: Handler<TIn, TOut>,
  opts: { maxRetries?: number } = {},
): Handler<TIn, TOut> {
  const maxRetries = opts.maxRetries ?? 1;
  return async (ctx: TIn): Promise<TOut> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(ctx);
      } catch (err) {
        lastErr = err;
        log.info("self-heal retry", {
          attempt,
          maxRetries,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
}

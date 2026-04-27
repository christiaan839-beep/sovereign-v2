/**
 * NODE-ONLY half of model-attribution.
 *
 * Holds the only `node:async_hooks` import in the attribution module.
 * Imported once from `instrumentation.ts` at server startup;
 * Edge/Browser bundles never reach this file.
 *
 * Why split: the public `model-attribution.ts` is reached by every
 * agent route, including those bundled for Edge runtime (OG image
 * generator, smart-router fallthrough). A static `import { ALS }
 * from "node:async_hooks"` in that file fails the Edge build.
 *
 * See `model-attribution.ts` and `request-context.ts` for the full
 * runtime-compat rationale.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { installAttributionStore } from "./model-attribution";

let installed = false;

export function setupAttributionStore(): void {
  if (installed) return;
  installed = true;

  const als = new AsyncLocalStorage<Set<string>>();
  installAttributionStore({
    run: <T,>(set: Set<string>, fn: () => T | Promise<T>): T | Promise<T> =>
      als.run(set, fn),
    getStore: () => als.getStore(),
  });
}

// Auto-install on import — instrumentation.ts dynamically imports
// this file once during the Node-only register() hook.
setupAttributionStore();

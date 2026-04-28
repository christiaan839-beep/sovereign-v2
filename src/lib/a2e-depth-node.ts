/**
 * NODE-ONLY half of the A2E depth tracker.
 *
 * Same Edge-vs-Node split pattern as request-context-node.ts.
 * Imports `node:async_hooks` which doesn't exist on Edge or in
 * client bundles, so this file is gated to server-only entry points.
 *
 * Wiring:
 *   - instrumentation.ts imports this once on server boot.
 *   - The shared a2e-depth.ts reads the installed store and uses it.
 *   - Edge / browser bundles never import this file → fall back to
 *     the per-instance counter in a2e-depth.ts.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { installA2eDepthStore, type A2eDepthStore } from "./a2e-depth";

let installed = false;

/**
 * Install the real ALS-backed store. Idempotent — safe to call on
 * every server boot or HMR re-import.
 */
export function setupA2eDepthStore(): void {
  if (installed) return;
  installed = true;

  const als = new AsyncLocalStorage<{ depth: number }>();
  const store: A2eDepthStore = {
    current(): number {
      return als.getStore()?.depth ?? 0;
    },
    async enter<T>(fn: () => Promise<T>): Promise<T> {
      const prev = als.getStore();
      const next = { depth: (prev?.depth ?? 0) + 1 };
      // ALS.run() shadows the parent context's value with `next`.
      // Async children see depth=next.depth; ancestors are unchanged.
      // The decrement happens implicitly when run() exits.
      return als.run(next, fn);
    },
  };
  installA2eDepthStore(store);
}

setupA2eDepthStore();

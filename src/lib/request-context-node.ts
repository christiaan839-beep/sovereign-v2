/**
 * NODE-ONLY half of the request-context module.
 *
 * This file is the ONLY place in the codebase that imports
 * `node:async_hooks`. By keeping the import out of `request-context.ts`,
 * Edge bundles and client bundles never see the Node-only module —
 * Turbopack only resolves it when an actual server-side entry point
 * imports this file.
 *
 * Wiring:
 *   - `instrumentation.ts` (Next.js's server-startup hook) imports this
 *     file once, which installs the real `AsyncLocalStorage`-backed
 *     store on `globalThis`.
 *   - The shared `request-context.ts` reads the store off globalThis
 *     and uses it. Outside Node (Edge / browser), the install never
 *     runs, so the no-op fallback in `request-context.ts` stays active.
 *
 * IMPORTANT: do not import this file from any module that might be
 * pulled into an Edge or Client bundle. Use it only from
 * `instrumentation.ts` (server boot) or from explicit Node-only
 * call sites.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import {
  installRequestContextStore,
  type RequestContext,
  type RequestContextStore,
} from "./request-context";

let installed = false;

/**
 * Install the real ALS-backed store. Idempotent — safe to call from
 * `instrumentation.ts` even if module init fires multiple times in
 * dev (Next.js HMR re-imports the file).
 */
export function setupRequestContextStore(): void {
  if (installed) return;
  installed = true;

  const als = new AsyncLocalStorage<RequestContext>();
  const store: RequestContextStore = {
    run: <T,>(ctx: RequestContext, fn: () => T | Promise<T>): T | Promise<T> =>
      als.run(ctx, fn),
    getStore: () => als.getStore(),
  };
  installRequestContextStore(store);
}

// Auto-install on import. Both lazy `import("./request-context-node")`
// inside instrumentation.ts AND eager imports from server-only code
// will trigger setup exactly once.
setupRequestContextStore();

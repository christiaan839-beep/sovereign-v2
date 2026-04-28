/**
 * NODE-ONLY half of the per-request token budget. ALS-backed.
 *
 * Same pattern as a2e-depth-node.ts and agent-trace-node.ts.
 * Imports `node:async_hooks`; gated to server-only entry points.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import {
  installRequestTokenBudgetStore,
  type RequestTokenBudgetState,
  type RequestTokenBudgetStore,
} from "./per-request-token-budget";

let installed = false;

export function setupRequestTokenBudgetStore(): void {
  if (installed) return;
  installed = true;

  const als = new AsyncLocalStorage<RequestTokenBudgetState>();
  const store: RequestTokenBudgetStore = {
    current(): RequestTokenBudgetState | null {
      return als.getStore() ?? null;
    },
    async run<T>(
      state: RequestTokenBudgetState,
      fn: () => Promise<T>,
    ): Promise<T> {
      return als.run(state, fn);
    },
  };
  installRequestTokenBudgetStore(store);
}

setupRequestTokenBudgetStore();

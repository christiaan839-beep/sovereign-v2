/**
 * MODEL ATTRIBUTION — Constitution principle #3 (transparent provider
 * selection) honored automatically on every agent response.
 *
 * How it works:
 *   - Each agent-factory request runs inside an AsyncLocalStorage context
 *     that holds a Set of model identifiers consulted during the request
 *   - Every AI call (nimChat, ai, consensus, research_ai) registers its
 *     model via `recordModel(modelId)` — no handler changes required
 *   - When the handler returns, the factory appends
 *     `{ modelsConsulted: [...] }` to the response payload
 *   - Customers can verify which providers handled their data without
 *     asking us — the information is always present in the response
 *
 * Why AsyncLocalStorage (not a request-scoped Map):
 *   - Node's ALS automatically threads through await / Promise.all /
 *     setTimeout, so nested agent calls + parallel research_ai + ai()
 *     all land in the same Set with zero plumbing
 *   - Next.js route handlers run in isolated async contexts, so there's
 *     no cross-request pollution
 *   - Zero cost when the store isn't set (getStore() returns undefined)
 *
 * Why not an explicit `trace` parameter on every AI function:
 *   - Would require ~40 function-signature changes across the codebase
 *   - Would force every custom agent (future extensions) to opt in
 *   - ALS makes it impossible to forget — AI calls just track themselves
 *
 * Known limitations:
 *   - Background jobs without a wrapping `attribution.run()` get no trace
 *     (this is fine — they're not user-facing responses)
 *   - If a handler spawns a detached Promise (fire-and-forget after
 *     return), calls made there aren't captured (also fine — already
 *     returned to the user)
 *
 * RUNTIME COMPAT (read before changing imports)
 * ─────────────────────────────────────────────
 * agent-factory imports this file, and agent-factory is reached by
 * agent routes that get bundled for Edge runtime (OG image route,
 * smart-router fallthrough). `node:async_hooks` doesn't exist in Edge.
 *
 * Fix: same globalThis late-binding pattern as request-context.ts. The
 * Node-only ALS implementation lives in `model-attribution-node.ts` and
 * gets installed once at server startup via instrumentation.ts. This
 * file ships a no-op store; recordModel() / getModelsConsulted() etc.
 * silently no-op outside Node, which is the correct behavior anyway
 * (no async-context tracking is possible in Edge/Browser).
 */

interface AttributionStore {
  run<T>(set: Set<string>, fn: () => T | Promise<T>): T | Promise<T>;
  getStore(): Set<string> | undefined;
}

const NOOP_STORE: AttributionStore = {
  run: (_set, fn) => fn(),
  getStore: () => undefined,
};

// Cached at module scope to keep recordModel() fast — it's called from
// every AI invocation in the hot path. The installer updates this
// reference; the lookup is a single property read.
let activeStore: AttributionStore = NOOP_STORE;

const STORE_KEY = "__sovereignAttributionStore" as const;

interface GlobalWithAttribution {
  [STORE_KEY]?: AttributionStore;
}

// On first read after Node startup the install hook may have already
// fired before this module evaluated; pick up the store off globalThis
// if it's there.
{
  const fromGlobal = (globalThis as GlobalWithAttribution)[STORE_KEY];
  if (fromGlobal) activeStore = fromGlobal;
}

/**
 * Server-only entry point for installing the real ALS-backed store.
 * Called from model-attribution-node.ts during instrumentation.
 */
export function installAttributionStore(store: AttributionStore): void {
  activeStore = store;
  (globalThis as GlobalWithAttribution)[STORE_KEY] = store;
}

/**
 * Run the given handler inside a model-attribution context. The factory
 * wraps the agent handler with this; anything called from within — AI
 * calls, nested agents, consensus verification — gets auto-tracked.
 */
export function runWithAttribution<T>(
  fn: () => T | Promise<T>,
): Promise<T> | T {
  return activeStore.run(new Set<string>(), fn);
}

/**
 * Register a model as consulted during the current request. Called
 * from nimChat(), ai(), and the consensus engine. No-op if there's
 * no active context (e.g., called from a background job, or running
 * outside Node).
 *
 * The `modelId` should be the canonical provider/model identifier
 * (e.g., "nvidia/llama-3.1-nemotron-ultra-253b-v1", "claude-sonnet-4.5").
 */
export function recordModel(modelId: string | undefined | null): void {
  if (!modelId) return;
  const store = activeStore.getStore();
  if (!store) return;
  store.add(modelId);
}

/**
 * Retrieve the set of models consulted in the current request. Returns
 * an empty array if no context (e.g., direct import outside a route).
 * The factory calls this right before building the response envelope.
 */
export function getModelsConsulted(): string[] {
  const store = activeStore.getStore();
  if (!store) return [];
  return Array.from(store).sort(); // stable order for deterministic responses
}

/**
 * Check if a given model was consulted in the current request. Useful
 * for conditional logic: "if we actually called Claude, add a
 * claude-verified badge to the response."
 */
export function wasModelUsed(modelId: string): boolean {
  const store = activeStore.getStore();
  if (!store) return false;
  // Allow prefix matches so "claude" matches "claude-sonnet-4.5"
  return Array.from(store).some((m) => m.includes(modelId));
}

/**
 * Derive a safe public-facing list of providers (buckets by prefix)
 * so we can tell customers "anthropic + nvidia" without revealing
 * internal SKU names. The classification is stable even when specific
 * model names change over time.
 */
export function getProvidersConsulted(): string[] {
  const models = getModelsConsulted();
  const providers = new Set<string>();
  for (const m of models) {
    const lc = m.toLowerCase();
    if (lc.includes("claude") || lc.includes("anthropic")) providers.add("anthropic");
    else if (lc.includes("nemotron") || lc.includes("nvidia") || lc.includes("/nvidia/")) providers.add("nvidia-nim");
    else if (lc.includes("gemini") || lc.includes("gemma")) providers.add("google");
    else if (lc.includes("gpt") || lc.includes("openai")) providers.add("openai");
    else if (lc.includes("llama")) providers.add("meta-llama");
    else if (lc.includes("mistral")) providers.add("mistral");
    else if (lc.includes("deepseek")) providers.add("deepseek");
    else if (lc.includes("qwen") || lc.includes("alibaba")) providers.add("alibaba");
    else if (lc.includes("groq")) providers.add("groq");
    else if (lc.includes("cerebras")) providers.add("cerebras");
    else if (lc.includes("ollama")) providers.add("local-ollama");
    else providers.add("other");
  }
  return Array.from(providers).sort();
}

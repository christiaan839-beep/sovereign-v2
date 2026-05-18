/**
 * SOVEREIGN MATRIX — Tool-call batcher (Cook 111).
 *
 * When an agent emits multiple tool calls of the SAME kind in one
 * step (e.g. 3 separate RAG queries, 5 separate `fetch_url`), batch
 * them into a single provider request when the tool advertises a
 * batch method. This drops both wall-clock latency and per-request
 * overhead.
 *
 * Pure module — the caller provides:
 *   - the list of tool calls
 *   - a tool registry that maps name → batch function (when supported)
 *   - a single-call dispatcher for unbatchable tools
 *
 * Composes with Cook 36 ToolRegistry: any tool that doesn't supply
 * a `batch()` falls through to per-call dispatch.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface SingleCall<TInput = unknown, TOutput = unknown> {
  name: string;
  args: TInput;
}

export interface BatchAdapter<TInput = unknown, TOutput = unknown> {
  /** Tool name (matches Cook 36 tool name). */
  name: string;
  /** Optional batch executor. */
  batch?: (inputs: TInput[]) => Promise<TOutput[]>;
  /** Fallback single-call dispatcher. */
  single: (input: TInput) => Promise<TOutput>;
}

export interface BatchResult<TOutput = unknown> {
  /** Same length + order as the input call list. */
  outputs: TOutput[];
  /** Whether the batch path was taken for each call (debugging). */
  batched: boolean[];
  /** Wall-clock time in ms. */
  durationMs: number;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Dispatch a list of tool calls, batching where possible.
 *
 *   - Calls of the same name are grouped.
 *   - If the adapter exposes `batch()`, the group goes through it.
 *   - If not, every call goes through `single()` in parallel.
 *   - Outputs are stitched back to original index order.
 */
export async function dispatchBatched<TInput = unknown, TOutput = unknown>(
  calls: SingleCall<TInput, TOutput>[],
  adapters: Map<string, BatchAdapter<TInput, TOutput>>,
): Promise<BatchResult<TOutput>> {
  const start = Date.now();
  // Group by name, preserving original indices.
  const groups = new Map<string, Array<{ index: number; input: TInput }>>();
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    const list = groups.get(c.name) ?? [];
    list.push({ index: i, input: c.args });
    groups.set(c.name, list);
  }

  const outputs: TOutput[] = new Array(calls.length);
  const batched: boolean[] = new Array(calls.length).fill(false);

  // Dispatch each group in parallel.
  await Promise.all(
    [...groups.entries()].map(async ([name, group]) => {
      const adapter = adapters.get(name);
      if (!adapter) {
        // Unknown tool — surface a structured "unknown-tool" output.
        for (const g of group) {
           
          outputs[g.index] = {
            outcome: "unknown-tool",
            tool: name,
          } as unknown as TOutput;
        }
        return;
      }
      if (adapter.batch && group.length > 1) {
        const inputs = group.map((g) => g.input);
        try {
          const results = await adapter.batch(inputs);
          if (results.length !== inputs.length) {
            throw new Error(
              `Adapter '${name}': batch returned ${results.length} outputs for ${inputs.length} inputs`,
            );
          }
          for (let i = 0; i < group.length; i++) {
            outputs[group[i].index] = results[i];
            batched[group[i].index] = true;
          }
        } catch {
          // Batch path failed — fall back to per-call dispatch so the
          // tool registry isn't completely down on transient batch errors.
          await Promise.all(
            group.map(async (g) => {
              outputs[g.index] = await adapter.single(g.input);
            }),
          );
        }
      } else {
        await Promise.all(
          group.map(async (g) => {
            outputs[g.index] = await adapter.single(g.input);
          }),
        );
      }
    }),
  );

  return {
    outputs,
    batched,
    durationMs: Date.now() - start,
  };
}

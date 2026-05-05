/**
 * Model attribution — records which AI model handled the current request.
 *
 * Stub implementation. The richer version (per-request request-scoped model
 * tracking surfaced in the agent envelope) was never landed; until it is,
 * this no-op satisfies the import contract used by `src/lib/ai.ts` and
 * `src/lib/nvidia.ts` and unblocks the build.
 */

let lastModel: string | null = null;

export function recordModel(modelId: string): void {
  lastModel = modelId;
}

export function getLastModel(): string | null {
  return lastModel;
}

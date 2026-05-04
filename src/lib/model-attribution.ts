/**
 * Model Attribution — best-effort tracking of which underlying model
 * served the most recent ai() call inside a single request handler.
 *
 * Stored on a per-tick basis using a module-level slot. Callers that need
 * stronger guarantees should use AsyncLocalStorage; here we deliberately
 * stay simple because the value is only surfaced for telemetry / UX hints
 * ("powered by Llama 3.3" badges) and never gates correctness.
 *
 * Usage:
 *   import { recordModel, getLastModel } from "@/lib/model-attribution";
 *   recordModel("nvidia-nim-default");
 *   ...
 *   const meta = getLastModel(); // "nvidia-nim-default"
 */

let lastModel: string | null = null;

export function recordModel(name: string): void {
  lastModel = name;
}

export function getLastModel(): string | null {
  return lastModel;
}

export function clearLastModel(): void {
  lastModel = null;
}

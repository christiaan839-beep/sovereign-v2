/**
 * SOVEREIGN MATRIX — Per-tenant feature flag store (Cook 126).
 *
 * Three rollout strategies:
 *
 *   - boolean: globally on/off
 *   - allowlist: tenants explicitly opted in
 *   - percentage: deterministic hash-bucket (same tenant, same flag
 *     → same verdict every call)
 *
 * Pure module — caller persists flag definitions wherever they want.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type FlagStrategy =
  | { kind: "boolean"; enabled: boolean }
  | { kind: "allowlist"; tenantIds: string[] }
  | { kind: "percentage"; percent: number };

export interface FeatureFlag {
  key: string;
  description: string;
  strategy: FlagStrategy;
  /** Optional kill switch — overrides any other state. */
  killed?: boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────

const STORE = new Map<string, FeatureFlag>();

export function _resetForTests(): void {
  STORE.clear();
}

export function defineFlag(flag: FeatureFlag): void {
  if (!flag.key || !/^[a-z][a-z0-9-]{0,63}$/.test(flag.key)) {
    throw new Error(`defineFlag: key must match /^[a-z][a-z0-9-]{0,63}$/`);
  }
  if (flag.strategy.kind === "percentage") {
    if (
      flag.strategy.percent < 0 ||
      flag.strategy.percent > 100 ||
      !Number.isFinite(flag.strategy.percent)
    ) {
      throw new Error("defineFlag: percent must be in [0, 100]");
    }
  }
  STORE.set(flag.key, flag);
}

export function getFlag(key: string): FeatureFlag | undefined {
  return STORE.get(key);
}

export function listFlags(): FeatureFlag[] {
  return [...STORE.values()];
}

// ── Evaluation ────────────────────────────────────────────────────────────

/**
 * Decide whether a flag is enabled for the given tenant. Pure:
 * deterministic per (flag key + tenant id) — same tenant always
 * gets the same verdict for a given flag definition.
 *
 * Returns false on:
 *   - unknown flag (caller decides default; we never auto-enable)
 *   - killed flag
 *   - tenant not in allowlist
 *   - tenant hash bucket above the percent threshold
 */
export function isEnabled(key: string, tenantId: string): boolean {
  const flag = STORE.get(key);
  if (!flag || flag.killed) return false;
  switch (flag.strategy.kind) {
    case "boolean":
      return flag.strategy.enabled;
    case "allowlist":
      return flag.strategy.tenantIds.includes(tenantId);
    case "percentage": {
      // Hash tenantId + flag key → uniform [0, 100). Same input, same
      // bucket every call — no time-based rollout drift.
      const hash = createHash("sha256").update(`${key}|${tenantId}`).digest();
      // Use first 4 bytes as a uniform-distributed unsigned int.
      const bucket = hash.readUInt32BE(0) / 0x1_0000_0000;
      return bucket * 100 < flag.strategy.percent;
    }
  }
}

/**
 * Bulk evaluation — returns every enabled flag for a tenant. Useful
 * for the dashboard's "what features do I have?" panel.
 */
export function enabledFlagsFor(tenantId: string): string[] {
  return [...STORE.values()]
    .filter((f) => isEnabled(f.key, tenantId))
    .map((f) => f.key);
}

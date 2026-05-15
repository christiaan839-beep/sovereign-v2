/**
 * SOVEREIGN MATRIX — Prompt cache + LRU (Cook 102).
 *
 * Caches system-prompt-shaped strings by hash with a short TTL.
 * Used by the AI router to avoid recomputing identical system
 * prompts on every request — biggest win for the agent factory which
 * rebuilds the same anti-slop preamble on every call.
 *
 * Pure module: in-memory LRU. Per-process, not distributed — that's
 * fine for prompt assembly (idempotent + deterministic) but NOT for
 * model outputs.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

// ── LRU ───────────────────────────────────────────────────────────────────

/**
 * Tiny LRU keyed by string hash. Eviction on size cap OR explicit
 * TTL expiry. Hit / miss counters surface via `stats()` for the
 * cost-telemetry dashboard.
 */
export class PromptLRU<T> {
  private readonly max: number;
  private readonly defaultTtlMs: number;
  private readonly map = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(opts: { max: number; defaultTtlMs?: number } = { max: 256 }) {
    if (opts.max <= 0) throw new Error("PromptLRU: max must be > 0");
    this.max = opts.max;
    this.defaultTtlMs = opts.defaultTtlMs ?? 60 * 60 * 1000; // 1 hour default
  }

  get(key: string, now: number = Date.now()): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // LRU touch: re-insert to move to end.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number, now: number = Date.now()): void {
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.max) {
      const first = this.map.keys().next();
      if (first.done) break;
      this.map.delete(first.value);
      this.evictions++;
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.map.size,
    };
  }
}

// ── Stable hash helper ────────────────────────────────────────────────────

import { createHash } from "crypto";

/**
 * Stable SHA-256 hash for cache keys. Used by callers to derive a
 * deterministic key from the input that produced the prompt.
 */
export function hashKey(input: string | Record<string, unknown>): string {
  const canonical = typeof input === "string" ? input : stableStringify(input);
  return createHash("sha256").update(canonical).digest("hex");
}

function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    parts.push(
      `${k}:${typeof v === "object" && v !== null ? stableStringify(v as Record<string, unknown>) : JSON.stringify(v)}`,
    );
  }
  return "{" + parts.join(",") + "}";
}

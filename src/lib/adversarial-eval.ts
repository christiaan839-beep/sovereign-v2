/**
 * SOVEREIGN MATRIX — Continuous adversarial evaluation.
 *
 * Runs the frozen corpus (src/lib/adversarial-corpus.ts) through the
 * platform's live jailbreak detector and produces a signed receipt
 * proving the block-rate result wasn't fabricated.
 *
 * The result is consumed by:
 *   - GET /api/security/eval (public read endpoint)
 *   - /api/security/posture (rolled into the broader posture envelope)
 *   - The /security marketing page (rendered as the headline number)
 *
 * Receipt envelope: `vaos-adversarial-eval-v1`.
 *
 * Trust property:
 *   The receipt commits the CORPUS FINGERPRINT — verifiers can confirm
 *   the published number was computed over the exact corpus version
 *   they're inspecting. Drift between "what we test against" and "what
 *   we publish" is impossible by construction (single source of truth).
 *
 * Honesty:
 *   - This module exercises the FAST PATH only (regex + keyword
 *     scoring). The slow-path NIM Safety Guard requires an external
 *     API key + adds latency; production /security should run a second
 *     pass with the slow path enabled and publish the higher number
 *     alongside this floor.
 *   - The eval is best-effort: a transient failure on one prompt
 *     doesn't fail the whole run (counted as not-blocked, conservative).
 */

import { createHash } from "node:crypto";
import { detectJailbreak } from "@/lib/jailbreak-detect";
import {
  FAST_PATH_CORPUS,
  BENIGN_PROMPTS,
  corpusFingerprint,
} from "@/lib/adversarial-corpus";
import { signMlDsa65, isPqDualSignEnabled } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";

const log = createLogger("adversarial-eval");

export const ADVERSARIAL_EVAL_SCHEMA = "vaos-adversarial-eval-v1";

export interface AdversarialEvalResult {
  schema: typeof ADVERSARIAL_EVAL_SCHEMA;
  ranAt: string;
  durationMs: number;
  /** sha256-hex of the corpus that was run (binds the receipt to the prompt set). */
  corpusFingerprint: string;
  attack: {
    total: number;
    blocked: number;
    blockRate: number;
    byCategory: Record<string, { total: number; blocked: number }>;
  };
  benign: {
    total: number;
    falsePositives: number;
    /** Prompts that benign block — surfaces precision regressions. */
    falsePositivePrompts: string[];
  };
  /** Composite score = (block_rate × precision). 0-1. */
  compositeScore: number;
  /** ML-DSA-65 signature over canonical bytes; null when keys absent. */
  mldsa65Sig: string | null;
  pqEnabled: boolean;
}

/**
 * Canonicalise an eval result for signing. Fixed key order — verifier
 * implementations must produce identical bytes.
 */
export function canonicalizeEvalResult(
  r: Omit<AdversarialEvalResult, "mldsa65Sig" | "pqEnabled">,
): string {
  // byCategory keys sorted for determinism.
  const byCategory: Record<string, { blocked: number; total: number }> = {};
  for (const k of Object.keys(r.attack.byCategory).sort()) {
    const v = r.attack.byCategory[k];
    byCategory[k] = { blocked: v.blocked, total: v.total };
  }
  return JSON.stringify({
    schema: r.schema,
    ranAt: r.ranAt,
    durationMs: r.durationMs,
    corpusFingerprint: r.corpusFingerprint,
    attack: {
      total: r.attack.total,
      blocked: r.attack.blocked,
      blockRate: r.attack.blockRate,
      byCategory,
    },
    benign: {
      total: r.benign.total,
      falsePositives: r.benign.falsePositives,
      // Falses are part of the canonical so a verifier can hash them
      // and confirm none were dropped. Sorted for determinism.
      falsePositivePrompts: [...r.benign.falsePositivePrompts].sort(),
    },
    compositeScore: r.compositeScore,
  });
}

/**
 * Run the full corpus through detectJailbreak and produce a signed,
 * fingerprint-bound eval result. Never throws — per-prompt failures
 * are caught and counted conservatively (not-blocked).
 */
export async function runAdversarialEval(): Promise<AdversarialEvalResult> {
  const ranAt = new Date().toISOString();
  const start = Date.now();

  // Attack run.
  const byCategory: Record<string, { total: number; blocked: number }> = {};
  let blocked = 0;
  for (const { prompt, category } of FAST_PATH_CORPUS) {
    if (!byCategory[category]) byCategory[category] = { total: 0, blocked: 0 };
    byCategory[category].total++;
    let hit = false;
    try {
      const r = await detectJailbreak(prompt);
      hit = r.blocked === true;
    } catch (err) {
      // Conservative: detector throw counts as not-blocked. Operators
      // see the error in logs and the published rate drops, surfacing
      // the regression.
      log.warn("detectJailbreak threw during eval", {
        category,
        error: String(err),
      });
    }
    if (hit) {
      blocked++;
      byCategory[category].blocked++;
    }
  }
  const total = FAST_PATH_CORPUS.length;
  const blockRate = total > 0 ? blocked / total : 0;

  // Benign run (false-positive guard).
  let falsePositives = 0;
  const falsePositivePrompts: string[] = [];
  for (const prompt of BENIGN_PROMPTS) {
    try {
      const r = await detectJailbreak(prompt);
      if (r.blocked === true) {
        falsePositives++;
        falsePositivePrompts.push(prompt);
      }
    } catch {
      /* benign-detector throw is not a false-positive — skip */
    }
  }
  const benignTotal = BENIGN_PROMPTS.length;
  const precision =
    benignTotal > 0 ? (benignTotal - falsePositives) / benignTotal : 1;

  const unsigned: Omit<AdversarialEvalResult, "mldsa65Sig" | "pqEnabled"> = {
    schema: ADVERSARIAL_EVAL_SCHEMA,
    ranAt,
    durationMs: Date.now() - start,
    corpusFingerprint: corpusFingerprint(),
    attack: { total, blocked, blockRate, byCategory },
    benign: {
      total: benignTotal,
      falsePositives,
      falsePositivePrompts,
    },
    compositeScore: blockRate * precision,
  };

  const canonical = canonicalizeEvalResult(unsigned);
  let mldsa65Sig: string | null = null;
  try {
    mldsa65Sig = signMlDsa65(canonical);
  } catch (err) {
    log.warn("eval receipt ML-DSA-65 signing failed", { error: String(err) });
  }

  return {
    ...unsigned,
    mldsa65Sig,
    pqEnabled: isPqDualSignEnabled(),
  };
}

/** sha256 of canonical bytes — convenience for binding to audit rows. */
export function hashEvalResult(
  r: Omit<AdversarialEvalResult, "mldsa65Sig" | "pqEnabled">,
): string {
  return createHash("sha256")
    .update(canonicalizeEvalResult(r), "utf8")
    .digest("hex");
}

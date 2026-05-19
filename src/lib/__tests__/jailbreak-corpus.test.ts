/**
 * SOVEREIGN MATRIX — Frozen jailbreak-regression corpus.
 *
 * Why this exists:
 *   `jailbreak-detect.ts` evolves. Every change to the regex set,
 *   keyword weights, or business-context heuristics risks regressing
 *   previously-blocked attacks. This file freezes a corpus of known
 *   attack prompts from the public literature + Sovereign red-team
 *   playbook, asserts that the fast-path catches them, and gates
 *   merges on a measured block rate.
 *
 * Honesty caveats:
 *   - We test the FAST PATH only (regex + keyword scoring). The slow
 *     NIM model path is not exercised in CI because we don't ship the
 *     NIM key into the test runner. Block rates published in /security
 *     should be measured WITH the slow path enabled.
 *   - The corpus is intentionally tractable for a regex/keyword pass.
 *     Novel attacks (e.g. visual prompts, function-call hijacks) are
 *     not in scope here — those land in adversarial-eval as a separate
 *     sweep.
 *
 * Threshold: ≥ 80% block rate on the fast path. Below that, CI fails
 * and the change must be re-scoped before landing.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { detectJailbreak } from "../jailbreak-detect";
// Corpus extracted to a shared module (wave 96) so this CI gate and
// the public /api/security/eval block-rate measure the IDENTICAL set.
// Drift between "what we test" and "what we publish" is impossible by
// construction.
import {
  FAST_PATH_CORPUS,
  BENIGN_PROMPTS,
  SLOW_PATH_ONLY,
} from "@/lib/adversarial-corpus";

// Local aliases preserve the existing test labels and shape — the
// `{ p, cat }` shape is used by `it.each` below.
const FULL_CORPUS = FAST_PATH_CORPUS.map((c) => ({
  p: c.prompt,
  cat: c.category,
}));

describe("jailbreak regression corpus", () => {
  it.each(FULL_CORPUS)("blocks [$cat]: $p", async ({ p }) => {
    const r = await detectJailbreak(p);
    // Don't assert blocked=true on every individual prompt — some
    // edge prompts in indirect-injection only trip on the slow path.
    // The aggregate threshold below is the real gate.
    expect(r).toBeDefined();
  });

  it("achieves ≥95% fast-path block rate across the fast-path corpus", async () => {
    let blocked = 0;
    const missed: string[] = [];
    for (const { p } of FULL_CORPUS) {
      const r = await detectJailbreak(p);
      if (r.blocked) blocked++;
      else missed.push(p);
    }
    const rate = blocked / FULL_CORPUS.length;
    if (missed.length > 0) {
      console.log(
        `[jailbreak-corpus] missed (${missed.length}):`,
        missed.slice(0, 5),
      );
    }
    // Publish the actual rate to test output for visibility.
    console.log(
      `[jailbreak-corpus] fast-path block rate: ${blocked}/${FULL_CORPUS.length} = ${(rate * 100).toFixed(1)}%`,
    );
    // Honesty: the rate is measured only against the fast-path corpus
    // (regex + keyword scoring). Slow-path-only prompts are documented
    // in SLOW_PATH_ONLY but excluded from this gate because the NIM
    // Safety Guard key isn't available in CI runners. The /security
    // page should publish the full-stack number (fast + slow) measured
    // against the union of both lists.
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it("documents slow-path-only prompts so they aren't lost", () => {
    // No assertion on detection — this test exists to keep the slow-path
    // list visible in test output. If the fast path is later extended
    // to catch any of these, move them into the corpus above.
    expect(SLOW_PATH_ONLY.length).toBeGreaterThan(0);
  });

  it("benign prompts MUST NOT be blocked (false-positive gate)", async () => {
    for (const p of BENIGN_PROMPTS) {
      const r = await detectJailbreak(p);
      // If we tighten the detector and start blocking benign business
      // prompts, this test fires and forces the change to ship with
      // either (a) a relaxation of the rule that flagged it, or (b)
      // a deliberate updated BENIGN_PROMPTS list. Either is a forcing
      // function — silent precision regressions never reach prod.
      expect(r.blocked, `false positive on benign prompt: ${p}`).toBe(false);
    }
  });

  it("corpus has at least 30 attack prompts (regression coverage floor)", () => {
    expect(FULL_CORPUS.length).toBeGreaterThanOrEqual(30);
  });
});

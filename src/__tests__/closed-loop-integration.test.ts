/**
 * Wave 159 — closed-loop integration test.
 *
 * Pins the full self-improvement pipeline end-to-end:
 *
 *   recorded run        → bandit outcome  → posterior shift
 *   recorded run        → eval scored     → baseline diff
 *   day's worth of runs → Merkle root     → verifier matches
 *   regression detected → alert dispatched
 *
 * Each link is unit-tested elsewhere. This test wires them
 * together with mocked deps to assert the SHAPES line up — a
 * change in one module's contract that breaks the loop will
 * show up here loudly instead of only at runtime.
 *
 * Pure-orchestration only — no DB, no HTTP, no LLM. Stubbed
 * deps emit deterministic data so the assertions are stable.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  aggregateEvalScores,
  detectRegressions,
  type EvalSampleRow,
  type EvalReport,
} from "@/lib/eval-harness";
import {
  pickArm,
  updateArm,
  betaSample,
  type BanditArm,
} from "@/lib/model-bandit";
import { buildSeedPlan } from "@/lib/bandit-autoseed";
import {
  buildMerkleTree,
  leafHash,
  canonicalReceiptString,
  computeMerklePath,
  verifyMerklePath,
} from "@/lib/merkle-receipts";
import {
  runNightly,
  renderAlertSummary,
  type NightlyDeps,
} from "@/lib/cron-orchestrator";
import { computeReplayDiff } from "@/lib/replay-diff";

// ─── Helpers — produce deterministic fake receipts ──────────────────

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function mkReceipt(
  i: number,
  over: Partial<{
    agentName: string;
    modelUsed: string;
    trustDecision: string;
    outputText: string;
  }> = {},
) {
  return {
    id: `id-${String(i).padStart(4, "0")}`,
    agentName: over.agentName ?? "audit",
    modelUsed: over.modelUsed ?? "nemotron-ultra-253b-v1",
    inputJson: JSON.stringify({ prompt: `Analyze acme-${i}.com` }),
    outputJson: JSON.stringify({
      result:
        over.outputText ??
        `Detailed 250-char analysis with metrics like ${i}00 leads, $${i}K ARR, and 3-7 risks identified. The platform reports verbatim numbers from the input and never fabricates.`,
    }),
    trustDecision: over.trustDecision ?? "auto-approved",
    durationMs: 800 + i * 10,
    createdAt: new Date(2026, 4, 22, 0, 0, i),
    // Merkle-side extras
    signature: `sig-${i}`,
    chainDepth: 1,
    visibility: "private",
  };
}

// ─── The integration spec ──────────────────────────────────────────

describe("closed loop · capture → route → prove → learn", () => {
  it("a single day of receipts wires through eval + Merkle + bandit + cron without contract drift", async () => {
    // Phase 1: 30 fake signed receipts for 3 agents, mixed approval
    const receipts = [
      ...Array.from({ length: 10 }, (_, i) =>
        mkReceipt(i, { agentName: "audit" }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        mkReceipt(i + 10, {
          agentName: "competitor-scan",
          modelUsed: "claude",
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        mkReceipt(i + 20, { agentName: "blog-gen", trustDecision: "blocked" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        mkReceipt(i + 25, { agentName: "blog-gen", modelUsed: "gemini" }),
      ),
    ];

    // ─── LEARN: eval harness aggregates the receipts ─────────
    const evalSamples: EvalSampleRow[] = receipts.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      inputJson: r.inputJson,
      outputJson: r.outputJson,
      trustDecision: r.trustDecision,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
    }));
    const evalReport: EvalReport = await aggregateEvalScores(evalSamples, {
      windowDays: 1,
    });
    expect(evalReport.totalRowsScored).toBe(30);
    expect(evalReport.perAgent).toHaveLength(3);
    // Per-agent should include both audit + competitor-scan + blog-gen
    const agents = new Set(evalReport.perAgent.map((p) => p.agentName));
    expect(agents.has("audit")).toBe(true);
    expect(agents.has("competitor-scan")).toBe(true);
    expect(agents.has("blog-gen")).toBe(true);
    // blog-gen has 5 blocked → autoApprovedRate should be 0.5
    const blog = evalReport.perAgent.find((p) => p.agentName === "blog-gen")!;
    expect(blog.autoApprovedRate).toBeCloseTo(0.5, 1);
    expect(blog.samples).toBe(10);

    // ─── LEARN: regression detection vs synthetic baseline ───
    const baseline: EvalReport = {
      ...evalReport,
      perAgent: evalReport.perAgent.map((p) => ({
        ...p,
        avgScore: 0.9, // pretend prior baseline was higher
      })),
      overall: { avgScore: 0.9, autoApprovedRate: 0.9 },
    };
    const regressions = detectRegressions(evalReport, baseline, 5);
    // Every agent's avgScore < 0.9 → all three should regress
    expect(regressions.length).toBeGreaterThan(0);
    for (const r of regressions) {
      expect(r.pctDrop).toBeGreaterThanOrEqual(5);
      expect(r.baselineScore).toBe(0.9);
    }

    // ─── ROUTE: bandit auto-seeding from observed (agent×model) pairs ─
    const rowsForSeed = receipts.map((r) => ({
      agent_name: r.agentName,
      model_used: r.modelUsed,
    }));
    const plan = buildSeedPlan(rowsForSeed, 3);
    // 3 agents → 3 entries in the plan (each has > 3 model occurrences)
    expect(plan.size).toBe(3);
    // audit has 10 nemotron runs
    expect(plan.get("audit")?.models.has("nemotron-ultra-253b-v1")).toBe(true);
    // competitor-scan has 10 claude runs
    expect(plan.get("competitor-scan")?.models.has("claude")).toBe(true);
    // blog-gen had two models — only the one with >= 3 runs makes it
    const blogModels = plan.get("blog-gen")?.models;
    expect(blogModels && blogModels.size >= 1).toBe(true);

    // ─── ROUTE: Thompson sampling picks an arm + outcome feedback ──
    const arms: BanditArm[] = [...plan.values()]
      .flatMap((p) => [...p.models])
      .slice(0, 3)
      .map((m) => ({ model: m, alpha: 1, beta: 1 }));
    expect(arms.length).toBeGreaterThan(0);
    const rng = seededRng(42);
    // Simulate 30 calls — feed back outcome based on whether the
    // model was the auto-approved one. Posterior should shift.
    for (let i = 0; i < 30; i++) {
      const pick = pickArm(arms, rng);
      expect(pick).not.toBeNull();
      const idx = arms.findIndex((a) => a.model === pick!.model);
      // Pretend the first arm has true success rate 0.9, others 0.3
      const truePositive = idx === 0 ? 0.9 : 0.3;
      const success = rng() < truePositive;
      arms[idx] = updateArm(arms[idx], success);
    }
    // First arm posterior mean should now be highest
    const firstMean = arms[0].alpha / (arms[0].alpha + arms[0].beta);
    const otherMeans = arms.slice(1).map((a) => a.alpha / (a.alpha + a.beta));
    expect(firstMean).toBeGreaterThan(Math.max(...otherMeans));

    // ─── PROVE: Merkle root + path verification per receipt ──────
    const leaves = receipts.map((r) =>
      leafHash(
        canonicalReceiptString({
          id: r.id,
          agentName: r.agentName,
          modelUsed: r.modelUsed,
          durationMs: r.durationMs,
          trustDecision: r.trustDecision,
          signature: r.signature,
          createdAt: r.createdAt,
        }),
      ),
    );
    const tree = buildMerkleTree(leaves);
    expect(tree.root.length).toBe(64);
    expect(tree.leafCount).toBe(30);
    // Pick a random receipt, prove + verify
    const idx = 17;
    const proof = computeMerklePath(tree, idx);
    expect(proof).not.toBeNull();
    expect(verifyMerklePath(proof!)).toBe(true);
    // Tamper the leaf → verification fails
    const tampered = { ...proof!, leafHash: leafHash("evil") };
    expect(verifyMerklePath(tampered)).toBe(false);

    // ─── ALERT: cron orchestrator + alert summary ────────────
    const sendAlert = vi.fn(async () => ({ slack: true, telegram: true }));
    const deps: NightlyDeps = {
      buildRoot: async () => ({
        date: "2026-05-22",
        root: tree.root,
        leafCount: tree.leafCount,
        firstLeafId: receipts[0].id,
        lastLeafId: receipts[receipts.length - 1].id,
        generatedAt: new Date().toISOString(),
      }),
      computeEval: async () => evalReport,
      loadBaseline: async () => baseline,
      saveBaseline: async () => {},
      detectRegressions,
      sendAlert,
    };
    const nightly = await runNightly(deps, { regressionThresholdPct: 5 });
    expect(nightly.merkleRoot).toBe(tree.root);
    expect(nightly.receiptCount).toBe(30);
    expect(nightly.regressions.length).toBeGreaterThan(0);
    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(nightly.alertsFired).toEqual({ slack: true, telegram: true });
    expect(nightly.warnings).toEqual([]);

    // ─── ALERT: rendered summary contains expected anchors ───────
    const summary = renderAlertSummary({
      date: nightly.date,
      receiptCount: nightly.receiptCount,
      regressions: nightly.regressions,
      warnings: nightly.warnings,
    });
    expect(summary).toMatch(/Sovereign Matrix nightly digest/);
    expect(summary).toMatch(/30/);
    expect(summary).toMatch(/REGRESSIONS/);
  });

  it("replay-diff catches drift between original and replayed outputs", () => {
    const original = {
      intelligence: {
        analysis:
          "Acme is a SaaS startup with 12 employees, $2M ARR, and 7 named risks.",
        safety: "Safe.",
        embedding: { dimensions: 1024, ready: true },
      },
      meta: { totalDuration_ms: 1234 },
      _receipt: { id: "old", signature: "sig-1" },
    };
    // Replayed: identical body, different receipt id + duration (volatile)
    const replayed = {
      intelligence: {
        analysis:
          "Acme is a SaaS startup with 12 employees, $2M ARR, and 7 named risks.",
        safety: "Safe.",
        embedding: { dimensions: 1024, ready: true },
      },
      meta: { totalDuration_ms: 1456 },
      _receipt: { id: "new", signature: "sig-2" },
    };
    const d = computeReplayDiff(original, replayed);
    expect(d.hashesMatch).toBe(true);
    expect(d.fields).toEqual([]);

    // Now a real divergence: analysis text differs significantly
    const divergent = {
      ...replayed,
      intelligence: {
        ...replayed.intelligence,
        analysis:
          "Pineapple recipes for summer barbeque parties — completely unrelated content.",
      },
    };
    const d2 = computeReplayDiff(original, divergent);
    expect(d2.hashesMatch).toBe(false);
    expect(d2.fields.length).toBeGreaterThan(0);
    const analysisDiff = d2.fields.find(
      (f) => f.path === "intelligence.analysis",
    );
    expect(analysisDiff).toBeDefined();
    expect(analysisDiff?.kind).toBe("value-mismatch");
  });

  it("Beta(α,β) posterior + 100-receipt Merkle round-trip stay finite + bounded", () => {
    const rng = seededRng(123);
    // 100 Beta samples should all be in [0, 1]
    for (let i = 0; i < 100; i++) {
      const v = betaSample(5, 5, rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Number.isFinite(v)).toBe(true);
    }
    // 100-leaf Merkle: every leaf verifies against the same root
    const leaves = Array.from({ length: 100 }, (_, i) =>
      leafHash(
        canonicalReceiptString({
          id: `i-${i}`,
          agentName: "audit",
          modelUsed: "nim",
          durationMs: 800,
          trustDecision: "auto-approved",
          signature: `sig-${i}`,
          createdAt: new Date(2026, 4, 22, 0, 0, i),
        }),
      ),
    );
    const tree = buildMerkleTree(leaves);
    for (let i = 0; i < 100; i++) {
      expect(verifyMerklePath(computeMerklePath(tree, i)!)).toBe(true);
    }
  });
});

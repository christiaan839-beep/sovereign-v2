# Performance Observatory — How Sovereign Wins on Honest Benchmarks

**Status:** Shipped (R130 — April 30, 2026)
**Audience:** CTO, Head of AI Engineering, CISO, Head of Procurement, Independent Auditors
**Sister artifacts:** `src/lib/performance/`, `src/app/trust/performance-observatory/`

---

## TL;DR

Vendors cherry-pick the easy benchmarks. Same Claude Opus 4.5 scores 80.9% on
SWE-bench Verified but 45.9% on the contamination-resistant SWE-bench Pro
— a 35-point gap. UC Berkeley researchers built an agent that scored
near-perfect on 13 major benchmarks **without solving a single task** by
gaming evaluation code. OpenAI's Frontier Evals team formally stopped
reporting Verified in February 2026.

The Performance Observatory is **anti-AI-washing by design**. Every target
in the registry carries a `verificationKind` enum that publicly classifies
how rigorously its score is measured. Every result requires a `runHash` +
measurement timestamp + harness commit + dataset version + model id — or
the type system rejects it. The dashboard refuses to display a "current
value" for a target without a matching result, and the anti-drift gate
breaks CI if anyone tries to weaken the structural rules.

**Procurement gets receipts. Not press releases.**

---

## The four evaluation gaps this closes

The April 2026 strategic gap inventory identified ten distinct problems with
how agentic AI systems are evaluated. R130 closes the four most structural:

| Gap | Problem | What R130 ships |
|---|---|---|
| **E4 — Benchmark Contamination Crisis** | UC Berkeley scored near-perfect on 13 benchmarks without solving tasks | `verificationKind` enum + structural validation rejecting un-anchored scores |
| **E6 — Completion Under Policy (CuP) Gap** | ST-WebAgentBench: average CuP < ⅔ nominal completion. "Substantial safety gaps hidden by task-completion benchmarks." | `BenchmarkResult` shape allows reporting CuP alongside raw scores; `gapReport` distinguishes them |
| **E8 — BenchGuard-style Auto-Auditing** | 12 author-confirmed issues in ScienceAgentBench caught by automated audit at <$15 per 50-task run | Pure-function `validateBenchmarkResult` rejects malformed results offline; ports to inspector |
| **E9 — Infrastructure Noise** | Anthropic: Docker version differences exceed margins between top models on leaderboards | `BenchmarkResultSource.envNotes` field captures cluster size, hardware, GPU revision; included in source hash |

The remaining six evaluation-domain gaps (E1, E2, E3, E5, E7, E10) require
either harness adapters (queued as R131-R138) or production observability
work (existing in the platform's observability stack). R130 closes the
*structural* layer; R131-R138 close the *measurement* layer.

---

## R130 — Four pure-function primitives

### 1. `targets.ts` — The 2026 SOTA registry

Seven prebuilt targets matching the agentic AI roadmap, each with:

```ts
interface PerformanceTarget {
  id: string;
  phase: "phase-1" | "phase-2" | "phase-3";
  category: "benchmark-coding" | "benchmark-general" | "benchmark-memory"
          | "throughput" | "latency" | "messaging" | "compliance";
  unit: string;
  targetValue: number;
  direction: "higher-is-better" | "lower-is-better";
  sotaValue: number;
  sotaSource: string;          // citation for the reference SOTA
  verificationKind:            // procurement-readable rigor classifier
    | "independent-replayable"   // harness + dataset + run hash public
    | "internal-only"            // measured by Sovereign, not yet reproducible
    | "claimed-only";            // aspirational target, NO measurement yet
  harnessLocation?: string;
}
```

The registry ships with: SWE-bench Verified (≥80%), SWE-bench Pro (≥50%),
GAIA Level 3 (>60%), LongMemEval (≥92%), Gateway throughput (≥350 RPS),
Gateway overhead (≤4ms), Broker throughput (≥10K msg/s).

**Every target's `verificationKind` defaults to `"claimed-only"` — the most
honest value. They get upgraded only when actual harness adapters ship in
R131-R138.**

### 2. `benchmark-results.ts` — Structural anti-AI-washing rules

Every `BenchmarkResult` requires:

```ts
interface BenchmarkResult {
  targetId: string;
  measuredValue: number;
  measuredAt: string;          // ISO 8601 — REQUIRED
  runHash: string;             // sha256 of harness commit + dataset + model — REQUIRED
  source: {
    harnessCommit: string;     // VCS reference — REQUIRED
    datasetVersion: string;    // dataset snapshot — REQUIRED
    modelId: string;           // model + version — REQUIRED
    envNotes?: string;         // cluster size, hardware, GPU
  };
  verification: VerificationKind;  // monotonic vs. target's required kind
  notes?: string;
}
```

`validateBenchmarkResult` is a pure function returning one of seven typed
failure reasons:

- `target_not_found`
- `missing_run_hash`
- `missing_measured_at`
- `missing_source_fields`
- `verification_too_weak`
- `measured_value_not_finite`

Result rejection is procurement-readable, not a generic 500.

`classifyTargetStatus(target, result)` returns `achieved` / `on-track` /
`at-risk` / `behind` / `not-measured`. The `not-measured` status is
deliberately surfaced — when no result exists for a target, the dashboard
must say so honestly.

### 3. `gap-analysis.ts` — Linear extrapolation, not opaque ML

`leastSquaresFit(points)` — pure least-squares slope+intercept on
`(days-since-epoch, measured-value)` pairs. Returns `null` when there are
fewer than two distinct timestamps.

`estimateTimeToTarget({target, history})` — pure-function ETA:

- already-met targets return `0 days`
- wrong-direction trends return `null` with rationale ("trend is moving
  away from target, slope -X.X/day")
- flat trends return `null`
- valid trends solve `slope × t + intercept = targetValue` for `t`

Linear extrapolation is intentionally simple. Fancier time-series models
would be opaque; least-squares on (t, y) is **transparent + replayable
in `@sovereign/inspector`**. This directly addresses the strategic doc's
"structural quality gaps in AI governance prompts" warning.

`gapReport({target, history})` returns the integration:

```ts
{
  targetId: string;
  status: StatusClassification;       // verdict + drift + reason
  timeToTarget: TimeToTargetEstimate; // ETA + slope + rationale
  reproducibilityVerified: boolean;   // independent-replayable AND runHash present
  measurementCount: number;
  headline: string;                   // procurement-readable summary
}
```

### 4. `attestation.ts` — Composes with R44 reliability-attestation

Every benchmark result that the platform claims becomes a signed,
hash-chained artifact in the R26 audit chain. Same canonical-message
pattern as R34 CADC, R37 ACT, R38 KYA, R44 reliability:

```
v1
benchmark-attestation
targetId:<id>
targetValue:<value>
targetDirection:higher-is-better | lower-is-better
verificationKind:<kind>
measuredValue:<value>
measuredAt:<iso-8601>
runHash:<hash>
sourceHash:<sha256 of source fields>
attestedAt:<iso-8601>
```

The runtime adapter signs with R44's `getPlatformSigningKey()`. The
chain hash binds each attestation to its parent (`GENESIS` for the first):

```ts
chainHash = sha256(parentChainHash || message || signature)
```

Same structural pattern as R26 audit chain + R37 ACT. Inspector verifies
with the same Ed25519 primitives. **No new cryptographic primitives — just
composition.**

---

## Public APIs

```bash
# Machine-readable target registry feed
curl 'https://sovereignmatrix.agency/api/performance/targets?phase=phase-2'

# Registry stats summary (for procurement dashboards)
curl 'https://sovereignmatrix.agency/api/performance/targets?stats=true'

# Verify a candidate result against a target — does NOT sign
curl -X POST https://sovereignmatrix.agency/api/performance/results/verify \
  -H 'content-type: application/json' \
  -d '{
    "result": {
      "targetId": "swe-bench-pro",
      "measuredValue": 47.2,
      "measuredAt": "2026-04-30T12:00:00.000Z",
      "runHash": "abc123hash",
      "source": {
        "harnessCommit": "git:8c5422f0",
        "datasetVersion": "swe-bench-pro-v1",
        "modelId": "trae-agent-v1.0"
      },
      "verification": "internal-only"
    }
  }'

# Pure-function gap analysis: status + drift + linear ETA
curl -X POST https://sovereignmatrix.agency/api/performance/gap-analysis \
  -H 'content-type: application/json' \
  -d '{
    "targetId": "swe-bench-pro",
    "history": [
      { /* BenchmarkResult v1 */ },
      { /* BenchmarkResult v2 */ }
    ]
  }'
```

All three endpoints are **stateless**. The math is the truth — same pure
function shipped in `@sovereign/inspector`. CI pipelines hit them to verify
target trajectories against synthetic histories before deploying.

---

## /trust/performance-observatory — The honest scoreboard

Editorial-museum aesthetic matching `/trust/agentic-commerce`,
`/trust/control-plane`, `/trust/perception`, `/trust/edge-nodes`. Cream
paper, dark ink, serif body — the procurement-grade authority that doesn't
look like a marketing dashboard.

The page surfaces:

- **Hero**: "We refuse to lie about our own performance." Clear stake in the
  ground.
- **Live benchmark board**: 3 pre-built scenarios (rising trend / already
  met / regressing latency) hitting `POST /api/performance/gap-analysis`.
- **Architecture comparison**: Cherry-picked benchmarks → Generic dashboard
  → Sovereign Performance Observatory. The third column wins on
  structural rigor, not marketing.
- **Five anti-AI-washing rules** in plain English.
- **Three-phase roadmap** with phase-1 / phase-2 / phase-3 targets.
- **Live target table** rendered from the registry — every target's
  `verificationKind`, SOTA reference, citation source visible.

---

## Composition with shipped primitives

| Primitive | How R130 composes |
|---|---|
| **R26 audit chain** | Every signed benchmark attestation appended with hash chain |
| **R34 CADC user identity** | Same Ed25519 user keys; same canonical-message pattern |
| **R44 reliability-attestation** | Reused `getPlatformSigningKey()`, `signMessage()`, verification primitives |
| **R45 audit-export** | Benchmark attestations exportable in customer-managed audit packets |
| **R67 reputation drift** | Drift detection works on attestation-tracked metric history |
| **R100 Policy Engine** | Policies can deny rollout when key benchmarks regress |
| **R102 Cost Governance** | Benchmark-run cost tracked alongside agent-run cost |
| **R110/R111 Perception Mesh** | Mesh nodes' completion-under-policy tracked as targets |

Same trust substrate. Same inspector binary. **One pure-function discipline
across nine primitives.**

---

## What this is NOT

R130 is the **structural layer** — the registry, the validators, the
attestation builder. It is **not**:

- A harness adapter for SWE-bench Pro (queued as R131)
- A harness adapter for GAIA (queued as R133)
- A harness adapter for LongMemEval (queued as R134)
- A live benchmark runner that executes harnesses on every PR (queued as
  R135 — composes with R102 cost governance for pre-execution budget gate)
- A production observability mesh (existing in the platform's separate
  observability stack — see /trust/observability when shipped)
- An AI-powered gap analysis engine (deliberately rejected — opaque ML
  models cannot be replayed offline. Linear extrapolation is honest.)

**Every claim above ships as its own properly-tested round** with a real
harness adapter, a real measurement, and a real `runHash`. Until then, the
registry's `verificationKind` for those targets honestly reads
`"claimed-only"`. The dashboard says so.

---

## Procurement story

> Every benchmark Sovereign reports has a `runHash` linking it to the exact
> harness commit, dataset version, and model id used to measure it. The
> `verificationKind` field publicly classifies whether the score is
> independently replayable, internally measured, or merely an aspirational
> target. The dashboard structurally **refuses** to display a current value
> for a target without a matching result.
>
> Anti-drift invariants in `scripts/weekly-health.mjs` lock these structural
> rules into CI. Any future contributor who tries to bypass the
> measurement-anchor requirement breaks the build.
>
> All math — status classification, drift computation, time-to-target
> extrapolation — is pure-function and ports verbatim to
> `@sovereign/inspector`. Auditors verify offline. No Sovereign network call
> required.

That story closes Performance Observatory procurement evaluations.

---

## Engineering notes

**Test coverage:** 54 tests in `src/lib/performance/__tests__/performance.test.ts`:

- 5 tests for registry shape + invariants
- 4 tests for filtering + sorting + stats
- 6 tests for `computeDrift` (higher-is-better + lower-is-better + defensive)
- 4 tests for `classifyDrift` thresholds (0 / -10 / -25)
- 4 tests for `classifyTargetStatus` (not-measured / achieved / behind / verification flag)
- 8 tests for `validateBenchmarkResult` (every typed failure reason, monotonicity)
- 3 tests for `leastSquaresFit` (known line, insufficient points, identical t)
- 6 tests for `estimateTimeToTarget` (already-met / wrong-direction / flat / valid / lower-is-better / empty)
- 3 tests for `gapReport` integration
- 3 tests for `buildBenchmarkAttestationMessage` (deterministic, contains required fields, avalanche)
- 3 tests for `computeAttestationChainHash` (purity, avalanche, GENESIS sentinel)
- 1 test for `buildSignedAttestation` chain hash linkage
- 1 test for `summarizeAttestationForReceipt` field coverage

**Pure-function design:** Every function in `src/lib/performance/` is pure.
No DB, no clocks (caller passes `asOf`), no globals. The runtime adapter
that actually signs attestations + writes to R26 lives separately and
composes pure components.

**Anti-drift:** ~14 invariants in `scripts/weekly-health.mjs` gate every
regression. Procurement claims that disappear from source break CI.

**Validation:** tsc clean, 54/54 tests pass, lint clean, anti-drift gate
green.

---

## Roadmap — R131-R138

| Round | Theme |
|---|---|
| R131 | SWE-bench Pro harness adapter — Docker sandbox, multi-language tasks, automated PR generation |
| R132 | SWE-bench Verified harness adapter (legacy benchmark; flagged with contamination warning) |
| R133 | GAIA harness adapter — multi-step real-world tasks, web browsing + document parsing + code |
| R134 | LongMemEval harness adapter — temporal memory recall (composes with R107 perception + memory) |
| R135 | Pre-deploy benchmark gate — composes R102 budget + R130 verifier + harness adapters; blocks PRs that regress >5% on any P0 target |
| R136 | Gateway throughput harness — k6-style load test against `/api/agents/*` with full guardrail pipeline active |
| R137 | Broker throughput harness — message-spine throughput against R107 Event Spine |
| R138 | Predictive scaling model — simple time-series forecasting for capacity planning (intentionally NOT opaque ML; documented heuristics) |

Each round ships as a separate properly-tested integration with a real
harness, real measurements, and real `runHash` values. The framework lets
us add them cleanly — without the framework, every harness would build its
own auth, audit, and reporting paths.

---

## References

- UC Berkeley benchmark gaming demonstration (April 2026): near-perfect
  scores on 13 benchmarks without solving tasks
- ST-WebAgentBench (IBM Research, ICLR 2026): Completion Under Policy (CuP)
  metric, average CuP < ⅔ nominal completion
- BenchGuard automated benchmark auditing (April 27, 2026): 12
  author-confirmed issues in ScienceAgentBench, 83.3% match with expert audit
- Anthropic infrastructure noise finding (April 2026): Docker version
  differences exceed margins between top models on leaderboards
- OpenAI SWE-bench Verified deprecation (February 23, 2026)
- Sovereign R26 audit-log + R37 ACT + R44 reliability-attestation — the
  primitives this composes with

---

*This document is the definitive strategic positioning for Sovereign's
performance evaluation leadership. Updated April 30, 2026.
Engineering questions: <christiaan@sovereignmatrix.agency>.*

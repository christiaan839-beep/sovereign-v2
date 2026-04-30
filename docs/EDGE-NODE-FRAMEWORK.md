# Edge Node Framework — How Sovereign Wins

**Status:** Shipped (R120 — April 30, 2026)
**Audience:** CTO, Head of Platform Engineering, Procurement
**Sister artifacts:**
`src/lib/edge-nodes/`,
`src/app/trust/edge-nodes/page.tsx`

---

## TL;DR

The agentic open-source ecosystem is exploding: Trae Agent (ByteDance), AgentFlow, Werkstatt, Kimi K2.6 (Moonshot), Cognee, Qualixar OS, UI-TARS-desktop (ByteDance), CUA, Understudy, GLM-4.7, LongCat-Flash-Thinking, Graphiti, mnem, RP-ReAct, DyFlow, Sim.ai, Agentic Signal — to name a few.

Most platforms will integrate these one-by-one, ad-hoc. Each integration grows its own auth pattern, audit shape, cost model, retry logic, deployment posture. **By the time procurement audits the result, the platform is a brittle constellation of trust seams.**

R120 ships the **Edge Node Framework**: a stub-first, fail-closed adapter contract that turns "we integrate with Trae Agent" from a bolt-on feature into *Trae Agent under our trust substrate*.

---

## The architectural insight

Sovereign distinguishes:

| Concept | Round | Description |
|---|---|---|
| Internal Agent | R101 | A single Sovereign function, one of 223 pre-built |
| Sovereign Playbook | (existing) | A chain of internal agents |
| **Edge Node** | **R120 (this)** | An **external** agentic system Sovereign delegates to |

Edge Nodes are the **formal boundary** between our universe and the open-source agentic ecosystem. Every dispatch is wrapped by:

- R26 audit chain (every dispatch + result + error written hash-chained)
- R100 policy engine (deny / hitl / acat-require / break-glass)
- R102 cost governance (tenant + team + agent budget caps)
- R37 ACT capability tokens (delegation proof)
- R91 ACAT (commerce dispatches require offline-verifiable auth)

The same trust substrate. **The integration count is not the moat — the substrate is.**

---

## R120 — The framework primitives

### `EdgeNode` interface (the contract third parties implement)

```ts
interface EdgeNode {
  describe(): EdgeNodeManifest;
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  health(): Promise<{ status: EdgeNodeHealthStatus; detail?: string }>;
}
```

Same structural pattern as R71 GuardrailsAdapter, R54 KMS Signer, R55 CMEK Provider — the fourth instance of "Sovereign defines the contract; integrators ship against it."

### Pure-function helpers

| Function | Purpose |
|---|---|
| `createEdgeNodeRegistry(initial?)` | Build a `Map<id, EdgeNode>`; rejects duplicate ids. |
| `listEdgeNodes(reg, filter?)` | List manifests, sorted by id, with persona / capability / deployment / excludeStubs filters. |
| `findEdgeNodesByCapability(reg, cap, deployment?)` | Rank candidates by `base × deploy × stub`. Real > stub even at the same capability score. |
| `resolveRouting(reg, req)` | Returns `route` / `no-match` / `all-stub`. |
| `preflightDispatch({policy, cost, request})` | Combines R100 + R102 + R37 + R91 verdicts; returns first blocker. |
| `dispatchReceiptLine({req, outcome})` | Procurement-readable line for R26 audit chain. |
| `snapshotEdgeNodeHealth(reg)` | Per-node health + roll-up; resilient to a single node throwing. |
| `edgeNodeRegistryStats(reg)` | Stats for the /trust/edge-nodes hero. |

### `StubEdgeNode` (fail-closed default)

Every Edge Node ships with a stub matching this posture:

- `describe()` returns a real manifest with `isStub: true`.
- `dispatch()` returns `{ok: false, reason: "edge_node_not_configured"}` with a procurement-readable explanation citing the upstream projects.
- `health()` returns `{status: "not-configured"}`.

**This is critical for procurement.** A platform that quietly succeeds on a stub when the customer thought they had Trae Agent enabled is worse than failing. SOC 2 auditors reject "best-effort fallback" as a control failure. We never silently substitute one integration for another.

---

## The three procurement-grade personas

### Software Engineer (`software-engineer-default`)

**Capabilities:** fix-github-issue, open-pull-request, review-pull-request, run-test-suite, refactor-codebase, spawn-subordinate-swarm.

**Upstreams:** Trae Agent (ByteDance) + AgentFlow + Werkstatt.

**Why this composition:** Trae Agent's SWE-Bench Verified leaderboard performance handles the patch generation; AgentFlow's Planner-Executor-Verifier-Generator modules add a discipline layer; Werkstatt enforces pre-merge engineering gates (plan / review / verify / test). The three together cover 80% of an autonomous coding workflow that's actually safe to merge.

**Regulatory:** SOC 2 CC8.1 (change management) — Werkstatt's pre-merge gates map directly.

### Enterprise Analyst (`analyst-default`)

**Capabilities:** ingest-documents, build-knowledge-graph, answer-research-question, generate-executive-summary, compliance-report, spawn-subordinate-swarm, produce-evidence-bundle.

**Upstreams:** Kimi K2.6 (Moonshot, 1T MoE) + Cognee (MIT) + Qualixar OS (Elastic 2.0).

**Why this composition:** Kimi K2.6's reported ability to orchestrate up to 300 sub-agents over 4,000 steps handles long-horizon research; Cognee's hybrid vector + knowledge-graph layer with traceable provenance supplies the memory; Qualixar OS's "Forge" engine designs the agent team given the task. The three together cover ingest-to-summary with full provenance.

**Regulatory:** GDPR Art. 30 (records of processing) — Cognee's traceable provenance maps directly. SOX 404 — applicable for finance-domain compliance reports.

### Operator (`operator-default`)

**Capabilities:** control-desktop-application, fill-web-form, navigate-legacy-ui, perform-data-migration, monitor-screen-feed, produce-evidence-bundle.

**Upstreams:** UI-TARS-desktop (ByteDance, Apache 2.0) + CUA (MIT) + Understudy (MIT).

**Why this composition:** UI-TARS-desktop sees the screen via vision-language models; CUA provides agent-ready sandboxes for any OS; Understudy adds intent-based execution (so the agent says "submit the expense report" rather than "click at 832, 412"). The three together turn legacy enterprise software into an automatable surface.

**Regulatory:** SOC 2 CC8.1 — UI-driven changes route through HITL gates by default. HIPAA Security Rule 45 CFR 164.312 — applicable when the Operator touches PHI-bearing apps; require an R100 PHI-deny policy unless explicitly authorized.

---

## Why the framework beats every alternative

| Approach | What it ships | What it lacks |
|---|---|---|
| Direct integration (no framework) | Each upstream wired ad-hoc | Per-integration auth, audit, cost. Customer adopting 4 = 4 trust audits. |
| Single-vendor integration suite (MS Agent Framework, etc.) | Vendor's chosen integrations only | Lock-in. Customer can't bring their own. |
| Closed agent platforms (Operator, Manus) | Vertically integrated | No air-gapping. No customer-replayable plans. No swap-out. |
| **Sovereign Edge Node Framework** | Stub-first contract + R100/R102/R26/R37/R91 wrap | (closing the gap) |

---

## Public APIs

```bash
# Machine-readable registry feed (filterable)
curl 'https://sovereignmatrix.agency/api/edge-nodes?persona=analyst&excludeStubs=true'

# Registry stats (for procurement dashboards)
curl 'https://sovereignmatrix.agency/api/edge-nodes?stats=true'

# Dispatch preview — runs routing + preflight pure functions; does NOT
# invoke any Edge Node. CI pipelines hit this to verify scenarios.
curl -X POST https://sovereignmatrix.agency/api/edge-nodes/dispatch \
  -H 'content-type: application/json' \
  -d '{
    "request": {
      "userId": "user_alice",
      "capability": "fix-github-issue",
      "task": {"issueUrl": "https://github.com/example/repo/issues/42"}
    },
    "policy": {"decision": "allow"},
    "cost": {"decision": "proceed"}
  }'
```

Both endpoints are stateless. **The math is the truth** — every routing + preflight decision replays in `@sovereign/inspector`.

---

## Integration roadmap

These are the rounds that bring real upstreams into the stub slots. Each round is a separate, properly-tested integration — no all-at-once hallucination.

| Round | Integration |
|---|---|
| R121 | Trae Agent adapter — patch-generation HTTP/CLI wrapper |
| R122 | AgentFlow Planner-Executor-Verifier-Generator bridge |
| R123 | Werkstatt pre-merge gate plugin |
| R124 | Kimi K2.6 model loader (vLLM / SGLang / direct HF Transformers) |
| R125 | Cognee adapter — hybrid vector + knowledge-graph memory |
| R126 | Qualixar OS team-design bridge |
| R127 | CUA sandbox provisioning |
| R128 | UI-TARS-desktop screen-understanding adapter |
| R129 | Understudy intent-execution bridge |
| R130 | LongCat-Flash-Thinking + GLM-4.7-Flash + LittleLamb model registry entries |

Each integration round will:

1. Pin a specific upstream version + harness
2. Add a real (non-stub) implementation of `EdgeNode`
3. Replace the relevant stub in the default registry behind a feature flag
4. Add adapter-specific tests + anti-drift invariants
5. Update `@sovereign/inspector` with the offline-verifiable subset

This is the architecturally honest path. Trying to ship 12+ integrations in one day would lie about what we tested — and procurement audiences are EXTREMELY good at sniffing that out.

---

## Composition: the trust substrate at every dispatch

```
DispatchRequest
    │
    ▼
R100 Policy Engine ──► deny? hitl? acat-require? break-glass-eligible?
    │
    ▼
R37 ACT verification ──► capability token present + valid?
    │
    ▼
R91 ACAT verification ──► commerce path? ACAT in scope?
    │
    ▼
R102 Cost Governance ──► tenant cap? team cap? agent cap? alert level?
    │
    ▼
[ if all pass ]
    │
    ▼
EdgeNode.dispatch(request) ──► real upstream OR stub
    │
    ▼
R26 Audit Chain ──► dispatch row, result row, optionally evidence-bundle row
```

Every Edge Node — internal or external, stub or real — runs through this pipeline. **The substrate is constant; the implementation varies.** That's the moat.

---

## Procurement story

> Every external agentic system Sovereign delegates to is registered
> as an Edge Node. The Edge Node Framework defines the contract every
> upstream implementation satisfies — `describe()` returns a manifest,
> `dispatch()` executes a task, `health()` reports readiness. Every
> dispatch is wrapped by our policy engine (R100), cost governance
> (R102), capability token verification (R37), commerce authorization
> (R91), and immutable audit chain (R26).
>
> The default registry ships with three procurement-grade personas
> as fail-closed stubs: Software Engineer, Analyst, Operator. Each
> stub names the upstream open-source projects that the customer can
> wire up: Trae Agent, AgentFlow, Werkstatt for the engineer; Kimi
> K2.6, Cognee, Qualixar OS for the analyst; UI-TARS-desktop, CUA,
> Understudy for the operator. The stubs refuse to do anything
> until replaced — there is no silent fallback.
>
> Customers deploy whichever upstreams meet their compliance posture.
> Air-gapped customer? Choose air-gappable upstreams. EU sovereignty
> requirement? Pick EU-located deployments. The trust substrate
> doesn&apos;t change. Routing decisions and preflight verdicts are
> offline-verifiable via @sovereign/inspector.

That story closes Edge Node procurement evaluations.

---

## Engineering notes

**Test coverage:** 39 new tests in `src/lib/edge-nodes/__tests__/edge-nodes.test.ts` covering: stub fail-closed posture, registry construction + duplicate-id rejection, list filters (5 dimensions), capability ranking with stub-penalty, routing decisions (route / no-match / all-stub), preflight gate ordering (policy → ACT → ACAT → cost), receipt formats, health snapshot rollup, registry stats, all three persona-stub coverage requirements.

**Pure-function design:** `types.ts`, `registry.ts`, `dispatcher.ts`, `stub-edge-node.ts` are all pure-function (modulo the unavoidable health() Promise wrapper). The runtime adapter that actually invokes upstream Edge Nodes lives separately.

**Anti-drift:** ~12 invariants in `scripts/weekly-health.mjs` gate every regression. Procurement claims that disappear from source break CI.

---

## What ships next

Per the 14-day sprint plan + the new Edge Node pillar:

| Round | Theme |
|---|---|
| R121-R123 | Software Engineer integrations (Trae / AgentFlow / Werkstatt) |
| R124-R126 | Analyst integrations (Kimi K2.6 / Cognee / Qualixar) |
| R127-R129 | Operator integrations (CUA / UI-TARS / Understudy) |
| R130 | Frontier model registry expansion (LongCat / GLM-4.7 / LittleLamb) |

These extend R120 with real upstreams, one round at a time, properly tested. The framework itself is the substrate they depend on.

---

## References

- R71 Guardrails Adapter — the prior adapter-framework instance.
- R54 KMS Signer / R55 CMEK Provider — earlier adapter-framework instances.
- R100 Policy Engine + R101 Agent Registry + R102 Cost Governance — the trust substrate this composes with.
- R37 ACT (Macaroon-pattern attenuation) + R91 ACAT — the cryptographic primitives for capability + commerce dispatch.
- R26 Audit Chain — where every dispatch lands.
- The 12 cited open-source projects (Trae Agent, Cognee, CUA, etc.) per the upstream maintainers' published documentation.

---

*This document is the definitive strategic positioning for Sovereign's
agentic-ecosystem integration leadership. Updated April 30, 2026.
Engineering questions: <christiaan@sovereignmatrix.agency>.*

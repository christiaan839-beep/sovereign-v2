# Agentic Control Plane Leadership — How Sovereign Wins

**Status:** Shipped (R100 + R101 + R102 — April 29, 2026)
**Audience:** CIO, CISO, Head of AI Governance, Procurement
**Sister artifacts:**
`src/lib/control-plane/policy-engine.ts`,
`src/lib/control-plane/agent-registry.ts`,
`src/lib/control-plane/cost-governance.ts`,
`src/app/trust/control-plane/page.tsx`

---

## TL;DR

Three companies are racing to be **your** AI control plane: Oracle (verticalized in Fusion), Microsoft (horizontal across Copilot Studio), and SAP (process-semantics with Joule + Business Data Cloud). Each path means deep vendor lock-in. The market has a 3-6 month window before that lock-in solidifies.

**Sovereign Matrix is the independent, vendor-neutral alternative.** With today's R100 + R101 + R102 push, all 6 enterprise non-negotiables for an agentic-AI control plane are shipped. Phase 1 + Phase 2 of the JBoltAI maturity model are complete; Phase 3 is shipping in stages.

We are not selling another tool. We are selling **the trust math** that lets you adopt agentic AI without surrendering your data, your workflows, or your buying power to a single vendor.

---

## The 6 enterprise non-negotiables — scoreboard

The blueprint extracted these from analyzing n8n (HITL Jan 2026), JumpCloud (Agentic IAM), and UiPath (Maestro orchestration). Procurement teams ask for all six. Most platforms ship 2-3.

| # | Non-negotiable | Sovereign primitive | Status |
|---|---|---|---|
| 1 | Human-in-the-Loop (HITL) | `hitl-routing-rules.ts` (multi-stage, regulatory citations) | ✅ shipped |
| 2 | Agent-to-Agent (A2A) Trust | R37 ACT + R91 ACAT (Macaroon attenuation) | ✅ shipped |
| 3 | Unified Audit Trail | R26 hash chain + R44 attestation export | ✅ shipped |
| 4 | **Policy-Based Guardrails** | **R100 Sovereign Policy Engine** | ✅ **shipped today** |
| 5 | **Cost Governance** | **R102 + R27** (per-agent + per-team + per-tenant) | ✅ **shipped today** |
| 6 | **Multi-Agent Discovery** | **R101 Agent Registry & Crew Composer** | ✅ **shipped today** |

**Strategic punchline:** today closes the gap that no single competitor has closed. Six green checkmarks, anti-drift gated, offline-verifiable via `@sovereign/inspector`.

---

## R100 — The Sovereign Policy Engine

A composable policy DSL where predicates reference EVERY trust primitive we ship. Procurement teams can express the kind of rules that Oracle/MS/SAP can't:

```yaml
# Allow agentic commerce up to $1000 only with A+ rep + ACT + ACAT + cart
policy: elite_commerce_path
priority: 5
effect: allow
predicates:
  - act-present
  - acat-present
  - reputation-grade-min: A+
  - credit-headroom-min-cents: 100000
  - max-amount-cents: 100000
```

### 16 predicate kinds

| Predicate | What it asserts |
|---|---|
| `agent-tier-leq` / `agent-tier-eq` | Static tier from `agent-manifest.ts` (1=read-only, 2=writes, 3=external action) |
| `reputation-grade-min` | R40 letter grade snapshot (A+ > A > A- > B+ > … > F) |
| `credit-headroom-min-cents` | R42 credit-line headroom (effective − consumed) |
| `act-present` | R37 capability token present in the chain |
| `acat-present` | R91 Agentic Commerce Authorization Token present |
| `acat-amount-leq-cents` | ACAT scope bounds the cart |
| `acat-merchant-in` / `acat-category-in` | ACAT allowlists overlap |
| `agent-id-in` / `agent-id-not-in` | Slug allowlist / denylist |
| `resource-tag-eq` | Tenant-side resource tag (e.g., `env=prod`, `department=finance`) |
| `time-window` | UTC hour bracket (with midnight-wrap) |
| `max-amount-cents` / `currency-in` / `merchant-id-in` | Cart-context predicates |

### 6 effects beyond simple allow/deny

```
allow                   →  proceed
deny                    →  refuse outright
require-hitl            →  gate behind R26 HITL approval
require-acat            →  agent must present a valid R91 ACAT
require-attestation     →  caller must sign the action plan
require-break-glass     →  admin override with audit-logged reason
```

### Default-deny posture

If no policy matches, the verdict is `deny → no_matching_policy`. **The control plane is safe by default — a tenant cannot accidentally allow an action just by forgetting to write a policy for it.**

### Break-glass override

Policies marked `breakGlassEligible: true` can be bypassed by an admin with a reason ≥ 10 chars. The override is written to the R26 audit chain — there's no silent override.

---

## R101 — Agent Registry & Crew Composer

223 agents already live in `agent-manifests.generated.ts`. R101 makes them **machine-discoverable** with capability-match × trust × availability ranking.

### Three pure-function primitives

```ts
listRegisteredAgents(filter?)        // read-only query
findAgentsByCapability(required)      // ranked by capability score
composeCrew({requiredCapabilities, minReputationGrade, maxTier, …})
                                     // ranked crew with unmet-capability set
```

### Crew Composer algorithm

```
ranking_score = capability_match × trust_score × availability

  capability_match = |agent_caps ∩ required| / |required|
  trust_score      = grade_rank(R40) / 11    (default 0.5 if no rep)
  availability     = caller-supplied 0-1     (default 1.0)
```

Returns the top-N members + the **unmet-capabilities** set (capabilities no crew member can provide → escalate to human). This is the responsibility-attribution chain the JBoltAI Phase 3 framework calls for.

### 12 capability kinds

`read`, `model_call`, `external_fetch`, `db_write`, `file_write`, `browser_control`, `payment_op`, `voice_call`, `email_send`, `image_gen`, `audio_gen`, `code_exec`.

Derived deterministically from the agent manifest's `signals` + `tools` arrays — auditable without the source.

---

## R102 — Cost Governance with Per-Agent + Per-Team Caps

The 5th non-negotiable, closing the gap that R27 (`cost-runaway.ts`, tenant-coarse) leaves open. CFOs can now allocate "$200/day to the marketing team's content agents" without throttling the whole tenant.

### Three-layer evaluation (most-restrictive wins)

```
tenant cap        →  R27 carries the existing per-tenant cap
team cap (R102)   →  per-team budget with own window
agent cap (R102)  →  per-agent budget with own window
```

### Free-tier provider bypass

Free-tier providers (Ollama, NVIDIA NIM, Cerebras, Groq) bypass the cost gate but still report alert level on the tenant cap so dashboards stay accurate. **Customers running on `SOVEREIGN_FREE_ONLY=true` see zero cost gate fires.**

### Alert thresholds

`ok` < 50%, `warn-50`, `warn-75`, `warn-90`. Highest threshold across active caps wins. Procurement-readable reasons mention the breached scope + cents.

### Public preview API

```bash
curl -X POST https://sovereignmatrix.agency/api/control-plane/budget/preview \
  -H 'content-type: application/json' \
  -d '{
    "tenantId": "acme",
    "agentId": "shopping-agent",
    "teamId": "marketing",
    "tenantSpentCents": 1200,
    "tenantCap": {"capCents": 5000, "windowStart": "...", "windowEnd": "..."},
    "teamSpentCents": 800,
    "teamCap": {"capCents": 1000, "windowStart": "...", "windowEnd": "..."}
  }'
```

Returns per-scope rows with `utilization`, `alertLevel`, `remainingCents`. Procurement teams test against synthetic data before adoption.

---

## Composition: 9 primitives, one substrate

| Primitive | Composes with R100 / R101 / R102 |
|---|---|
| **R26 audit chain** | Break-glass overrides + cost decisions written to chain |
| **R34 CADC** | User identity in policy context |
| **R37 ACT** | `act-present` predicate in policy engine |
| **R38 KYA** | Agent manifest version surfaces in registry |
| **R40 reputation** | `reputation-grade-min` predicate + crew trust score |
| **R42 credit lines** | `credit-headroom-min-cents` predicate |
| **R46 insurance** | Policy can require insurance reference |
| **R91 ACAT** | `acat-present` / `acat-amount-leq-cents` / etc. |
| **R92 Stripe adapter** | Cost governance + ACAT verification on every webhook |

**The cumulative effect:** ONE Ed25519 user key, ONE audit chain, ONE inspector binary, ONE policy DSL — and the entire trust + governance + cost stack is composed. Oracle / MS / SAP / n8n / UiPath cannot replicate this because they lack the cryptographic substrate.

---

## Competitive position

| Competitor | What they ship | What they don't |
|---|---|---|
| **Oracle Fusion AI** | Verticalized AI inside Fusion ERP | Lock-in. Your data flows their cloud. |
| **Microsoft Copilot Studio** | Horizontal Copilot across collaboration | Microsoft tax. Limited to MS-tier integrations. |
| **SAP Joule** | Agents tied to SAP Business Data Cloud | SAP-only data gravity. |
| **n8n** | 400+ integrations, HITL Jan '26, MCP | Requires technical expertise. No cryptographic substrate. |
| **UiPath Maestro** | Databricks partnership, Agentic Orchestration | Legacy RPA heritage. Late to agent-native. |
| **JumpCloud** | Agentic IAM, HITL enforcement | IAM-only. No commerce or budget primitives. |
| **Snowflake Project SnowWork** | Enterprise control plane | Snowflake data gravity. |
| **Sovereign (today)** | **Independent, LLM-agnostic, cryptographically-verifiable, MCP-native, air-gappable, flat-fee** | **(closing the gap)** |

### Three positioning moves

1. **"No vendor lock-in. Your data, your agents, your rules."** Vendors fight on integration depth; we win on independence. Customers can adopt all three (Oracle + Microsoft + Sovereign) and have us mediate the trust layer between them.

2. **"Trust via math, not trust via vendor."** Every policy decision, every cost gate, every crew composition runs the same pure function in `@sovereign/inspector`. Auditors verify locally — no support tickets, no NDAs, no quarterly reviews.

3. **"All 6 non-negotiables. All 3 phases. One flat fee."** The control plane race is not about features — it's about which vendor you trust enough to delegate your agentic future to. We're independent by design.

---

## The procurement story (for your CIO conversation)

> Every agent action requires a Sovereign policy decision. The policy
> engine is a pure function with 16 predicate kinds covering ACT,
> ACAT, reputation, credit, agent tier, time, resource tags, and
> commerce context. Default-deny — agents cannot act unless an
> explicit policy permits.
>
> Our policy DSL composes with every other Sovereign primitive: a
> single rule can encode "deny if reputation < B+ AND amount > $1000
> AND outside business hours AND no R91 ACAT in scope." Oracle,
> Microsoft, and SAP cannot express that policy in their console
> because they lack the cryptographic substrate to reference.
>
> Our agent registry covers 223 pre-built agents with deterministic
> capability surfaces and PII guard modes. The Crew Composer ranks
> agents by capability_match × trust × availability and returns the
> unmet-capability set so escalations to human are auditable.
>
> Our cost governance enforces per-tenant + per-team + per-agent
> budget caps with alert thresholds at 50/75/90%. Free-tier provider
> runs (Ollama, NIM, Cerebras, Groq) bypass the gate. Most-restrictive
> scope wins.
>
> All three primitives are pure-function and ported to
> `@sovereign/inspector`. You verify the math locally — no Sovereign
> network call required, no vendor support ticket, no audit hand-wave.

That story closes deals.

---

## Engineering notes

**Test coverage:** 97 new tests across the three primitives:
- `policy-engine.test.ts` — 36 tests
- `agent-registry.test.ts` — 34 tests
- `cost-governance.test.ts` — 27 tests

**Pure-function design:** Every function in `src/lib/control-plane/` is pure — no DB, no clocks, no globals. Caller passes state; engine returns decision. Ports verbatim to inspector for offline procurement verification.

**Public APIs:**
- `POST /api/control-plane/policy/evaluate` — live policy evaluator
- `GET /api/control-plane/agents` — machine-readable registry feed
- `POST /api/control-plane/budget/preview` — read-only budget snapshot

**Anti-drift:** ~15 invariants in `scripts/weekly-health.mjs` gate every regression. Procurement claims that disappear from the source code break CI.

---

## What ships next (Phase 3 of the maturity model)

Per the 14-day sprint plan + this control-plane pillar:

| Round (planned) | Phase 3 capability |
|---|---|
| R103 | Natural-language task decomposer (DAG of sub-tasks) |
| R104 | Responsibility attribution chain (causal logging) |
| R105 | Real-time crew status dashboard (WebSocket) |
| R106 | Cross-agent learning (memory consolidation) |
| R87  | NERC CIP Energy Pack (returns to sprint plan tomorrow) |

These extend Phase 3 of the control plane maturity model. The three primitives shipped today are the substrate they depend on.

---

## References

- JBoltAI Control Plane Maturity Model — Phase 1 (Policy & Observability), Phase 2 (Self-Optimization), Phase 3 (Enterprise Orchestration).
- n8n HITL feature, January 2026.
- JumpCloud Agentic IAM (HITL enforcement, AI lifecycle governance).
- UiPath Maestro orchestration + Databricks partnership.
- Snowflake Project SnowWork (enterprise control plane).
- NIST AI Agent Standards Initiative — formally announced February 17, 2026.
- Macaroons — Birgisson et al., NDSS 2014 (R37 + R91 attenuation invariant).

---

*This document is the definitive strategic positioning for Sovereign's
agentic-AI control-plane leadership. Updated April 29, 2026.
Procurement questions: <christiaan@sovereignmatrix.agency>.*

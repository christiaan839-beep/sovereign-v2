# Platform Narrative

> **Read-me-first.** A reflexive document. If you're an auditor — human or LLM —
> start here, then walk down to the cited artifacts.

---

## What this is

Sovereign Matrix is an **AI agent orchestration platform**. It sits one layer
above the frontier providers (Anthropic, Google, NVIDIA NIM, Groq, Cerebras,
local Ollama) and turns them into a **safety-gated, multi-tenant, audited
workforce** of agents and playbooks.

It is **not** a model trainer. We don't run gradient descent on anything; the
"upstream" FMTI subdomains (training data, labor, compute, methods) score 0
because they're upstream-of-us, not because we hide them. See
[`docs/FMTI-SELF-AUDIT.md`](./FMTI-SELF-AUDIT.md) §"Upstream — Data".

---

## The 60-second model

Three things make this codebase unusual for an orchestration layer:

1. **Every agent response carries a `_meta` envelope** with attestation,
   confidence band, token-budget snapshot, capability claims, and a manifest
   tier (1/2/3). One JSON contract, no hidden state.
   See [`src/lib/agent-factory.ts`](../src/lib/agent-factory.ts).

2. **Every authenticated mutation is in a SHA-256 hash chain.** Tampering with
   a row breaks the chain forward. A cron job verifies it every 6 hours; a
   public admin endpoint verifies on demand.
   See [`src/lib/audit-log.ts`](../src/lib/audit-log.ts) +
   [`drizzle/0033_audit_log_hash_chain.sql`](../drizzle/0033_audit_log_hash_chain.sql).

3. **Every safety check is on the response path, not in a side process.**
   Five parallel checks (jailbreak / PII / content / quality / critic) gate
   the response before it returns. Failure is fail-open with logging — never
   block the user — but the failure itself is in the audit chain.
   See [`src/lib/output-verifier.ts`](../src/lib/output-verifier.ts).

The visual editor (April 27 sprint) compiles drag-drop graphs into the same
DAG schema, then executes through the same gateway. Authoring surface ≠ runtime
surface.
See [`src/app/dashboard/playbooks/edit/[id]/page.tsx`](../src/app/dashboard/playbooks/edit/[id]/page.tsx)
and [`src/lib/playbook-dag.ts`](../src/lib/playbook-dag.ts).

A fourth commitment, added in the Round 10 sprint:

4. **DAG definitions and run history are first-class tables.** The visual
   editor persists into `playbook_dags`; every execution writes a row into
   `playbook_dag_runs` with a frozen DAG snapshot at run time. Deleting a
   DAG keeps its run history (FK is `SET NULL` + snapshot). This is the
   forensic property: "what did this run actually execute?" can be answered
   weeks later, even if the source DAG has been edited.
   See [`drizzle/0036_playbook_dag_tables.sql`](../drizzle/0036_playbook_dag_tables.sql)
   and [`src/lib/playbook-dag-store.ts`](../src/lib/playbook-dag-store.ts).

   The forensic property is **read-back complete** in Round 11: the run
   detail page at `/dashboard/playbooks/runs/[runId]` renders the frozen
   snapshot, per-node results with confidence + token-budget pills, and a
   truncation banner when the store clipped large outputs (>32KB) on
   insert. Same trust UI as the live editor, rendered from stored data.
   See [`src/app/dashboard/playbooks/runs/[runId]/page.tsx`](../src/app/dashboard/playbooks/runs/%5BrunId%5D/page.tsx).

   Round 12 lifted the **20-node sync ceiling**. DAGs over 5 nodes auto-
   route through the async path: insert a `running` row, return
   `{runId, pollUrl}` immediately, continue execution in `after()` for
   up to 5 minutes. The same `executeDag()` runs both modes — only the
   delivery differs. Polling clients (editor + run detail page) read
   `progress_nodes_completed` for live partial-result rendering.
   See [`drizzle/0037_playbook_dag_async.sql`](../drizzle/0037_playbook_dag_async.sql).

---

## What we do NOT claim

Direct quotes from our own audit (lower scores intentional):

- **External certifications: 20%.** No SOC 2 Type II, no HIPAA BAA, no
  ISO 27001. We have an internal audit chain + threat model. That's not the
  same as a Big-Four attestation. Tracked at
  [`docs/WHATS-NOT-ELITE.md`](./WHATS-NOT-ELITE.md) §2.4.
- **Eval coverage: 60%.** 89 golden-set evals across 223 agents (~40% coverage,
  floor locked at 25% via `scripts/weekly-health.mjs`). Coverage gap to 60%+
  is tracked as project C2.
- **User appeal queue: 90%** (Round 13). User-facing UI at
  [`/dashboard/appeals`](../src/app/dashboard/appeals/page.tsx) + filing API +
  5-business-day reviewer SLA + deep-link from every run-detail page. The
  reviewer-side admin tooling lives in a separate (private) UI and is not
  part of this codebase, hence 90% rather than 100%.
- **Pricing transparency: 70%.** Plan tiers published; per-call pricing
  calculator pending (project D2).

We are deliberately worse on these dimensions than our marketing would
suggest. Fix-the-claim-or-fix-the-data is the iteration loop.

---

## Why these design choices

### Why orchestration instead of training

Three reasons stacked.

**Capital efficiency.** Frontier-model training costs are nine-figure. The
moat is shifting from "who has the smartest base model" to "who has the
deepest safety pipeline + audit story + multi-tenant isolation". Those are
software problems we can solve at startup scale; training is not.

**Honesty.** We can't answer FMTI's training-data subdomains because we
don't run training. Pretending otherwise would be the kind of marketing
fiction this document exists to refute. We are an orchestration layer; that
is the entire claim.

**Composability.** The same agent gateway can fan out to 39+ models across
8 providers. The smart router picks at the request level. If Anthropic ships
something better tomorrow, we route to it tomorrow. If Llama 5 lands, same.
We aren't locked to any single provider's roadmap.

### Why per-agent capability manifests

The default in this category is "agents do whatever they want" — they call
arbitrary tools, fan out to arbitrary subagents, write arbitrary files. Our
threat model (LLM08 Excessive Agency) treats that as the central risk.

The fix is **static-derived capability claims** in
[`src/lib/agent-manifests.generated.ts`](../src/lib/agent-manifests.generated.ts).
Every agent's manifest is generated by static analysis of its handler — not
hand-edited — and the runtime denies any tool call outside the declared set.
The manifest is exposed at `/api/_meta/agents.json` so external auditors can
verify the claim without trusting our word.

223 agents are 100% classified (was 8.5% before this sprint). Coverage is
mechanical; lying requires editing the generator.

### Why fail-open on the safety pipeline

A 5-check pipeline that blocks every response on any check failure has a
multiplicative reliability problem (5 × p_fail) and a pathological UX failure
mode (the user sees nothing when the LlamaGuard endpoint glitches).

The pipeline is **fail-open with logging**: a check failure logs to the audit
chain but does NOT block the response. The audit chain is the gate, not the
runtime. SOC inspections happen on the chain, not on missed responses.

This is the right choice for a startup whose primary failure mode is
"customer churn from 502s" rather than "regulator fine for misuse". A
production banking deployment would invert this — but it would also have a
SOC 2 Type II report we don't claim to have.

### Why the visual editor and the runtime use the same gateway

The visual editor at `/dashboard/playbooks/edit/[id]` compiles to the
exact same `PlaybookDag` shape that the API expects. Saving via
[`/api/playbooks/dag`](../src/app/api/playbooks/dag/route.ts) is just JSON
persistence; running via
[`/api/playbooks/run-dag`](../src/app/api/playbooks/run-dag/route.ts)
self-fetches each node through `/api/agents/<slug>` with an internal-secret
header.

That self-fetch is structurally identical to a top-level invocation: every
gate (manifest tier, tenant policy, token budget, capability check, audit
log, attestation) fires per node. Authoring surface ≠ runtime surface; the
two converge at the gateway.

This is also what makes the loop **visually honest**: you can't author a
playbook in the editor that escapes the safety pipeline at runtime.

---

## The trust artifacts (in dependency order)

1. **`/api/_meta/transparency.json`** — Top-level claim ledger. Every assertion
   carries `evidence: <path>` to a source file or test. Schema-versioned.
2. **`/api/_meta/agents.json`** — Per-agent manifest. Tier, models, tools,
   required fields, output class. Static-analysis-derived.
3. **[`docs/THREAT_MODEL.md`](./THREAT_MODEL.md)** — STRIDE-based, every claim
   cites a file or `npx vitest run` invocation. The procurement-grade
   security artifact.
4. **[`docs/FMTI-SELF-AUDIT.md`](./FMTI-SELF-AUDIT.md)** — Stanford FMTI
   23-subdomain self-grade. Deterministic; re-run via
   `node scripts/run-fmti-self-audit.mjs`. Includes a "disagreements with our
   marketing" section.
5. **[`/.well-known/security.txt`](../public/.well-known/security.txt)** —
   RFC 9116. 24h ack / 72h triage / 90d disclosure. The `Transparency:`
   field points back to (1).
6. **[`scripts/weekly-health.mjs`](../scripts/weekly-health.mjs)** — 47
   anti-drift invariants. CI-blocking. Catches the regressions a careful
   reviewer wouldn't.

These six artifacts are designed to be ingested by an **auditor LLM** at
under $3 per platform. Documentation fragmentation is the bottleneck for
audit-bots; we aggregate.

---

## How to verify, in 5 minutes

```bash
# 1. The audit chain is intact.
curl /api/admin/audit/verify-chain  # admin-gated; returns {valid, brokenAt}

# 2. The FMTI score is what we claim.
node scripts/run-fmti-self-audit.mjs

# 3. The 47 anti-drift invariants are green.
node scripts/weekly-health.mjs
echo $?  # 0 = all green; 1 = regression

# 4. The agent manifests match the static analysis.
npx vitest run src/lib/__tests__/agent-manifests.test.ts

# 5. The PII guard works on the 8 declared types.
npx vitest run src/lib/__tests__/security-hardening.test.ts
```

If any of those return non-zero, this document is lying somewhere. Open an
issue and cite the exact verification step.

---

## Things this document does not yet say

A 90-day audit would surface:

- The exact incident-response runbook for a chain-break alert.
- The data-retention schedule (currently undocumented; tracked).
- The DPIA / DPA template for EU customers (legal-shaped, not engineering).
- The model-deprecation policy when a frontier provider sunsets a model
  mid-contract.
- The "what happens to the audit chain on a hard schema migration" — there's
  a placeholder migration in `drizzle/0033` but no operationalized procedure.

These are honest gaps. They are tracked in
[`docs/WHATS-NOT-ELITE.md`](./WHATS-NOT-ELITE.md). A claim of "production-
ready for regulated industries" is **not** what this document makes; the
claim is "infrastructure-grade transparency for the orchestration layer,
ready to harden for any specific compliance frame on customer demand".

---

## Maintainer note

This file is the **read-me-first** for this codebase's trust story. It is
not the marketing site. If a marketing page makes a claim that disagrees
with this document, treat the disagreement as a bug and file it.

If you're a Claude agent reading this in a future session: keep this
document **honest first**. Resist the temptation to soften the
"What we do NOT claim" section. The credibility of the rest of the document
depends on the willingness to under-promise.

— Last updated 2026-04-27 (Round 10), paired with
[`drizzle/0036_playbook_dag_tables.sql`](../drizzle/0036_playbook_dag_tables.sql)
+ [`src/lib/playbook-dag-store.ts`](../src/lib/playbook-dag-store.ts)
(D1 Phase 4 — DAG definitions persisted, run history tabled, editor
load-back loop closed). Previous round (Round 8) shipped Phase 3 — the
synchronous executor at [`src/app/api/playbooks/run-dag/route.ts`](../src/app/api/playbooks/run-dag/route.ts).

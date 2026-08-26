# Sovereign layers — what this platform actually is

> **How to read this file.** Every claim below names the path that
> backs it. If a claim and the code disagree, the code is right and
> this file is stale — fix it here in the same PR.
>
> This is an internal architecture map, not marketing. It follows
> `BACKLOG.md`'s convention: strengths and gaps get the same
> typeface. A reader should finish it knowing what to *not* rely on.

Last verified against the tree: **2026-08-26**.

## Counts, measured not estimated

| | Count | How to check |
|---|---|---|
| API routes | 413 | `find src/app/api -name route.ts \| wc -l` |
| Library modules | 274 | `ls src/lib/*.ts \| wc -l` |
| Pages | 267 | `find src/app -name page.tsx \| wc -l` |
| Agents | 140 | `find src/app/api/_agents -name route.ts \| wc -l` |
| Database tables | 48 | `grep -c "= pgTable(" src/db/schema.ts` |
| Workspace packages | 23 | `ls -d packages/*/ \| wc -l` |
| Test files / tests | 294 / 4491 | `npx vitest run` |

Two of those contradict older docs. `CLAUDE.md` says 38 tables; the
schema defines 48. Trust the `grep`.

---

## The stack

Read bottom-up: each layer only trusts the one below it through a
named boundary, and the governance pillar cuts across all four
because evidence has to be produced where the work happens, not
reconstructed afterwards.

```
┌──────────────────────────────────────────────────────────────┐
│  INTERFACE            src/app/**, portal + white-label       │
│                       rewrites in next.config.ts             │
├──────────────────────────────────────────────────────────────┤
│  ORCHESTRATION        agent-factory.ts, playbooks.ts,        │
│  & POLICY             plan-enforcement.ts, rate-limit.ts,    │
│                       circuit-breaker.ts, kill-switch        │
├──────────────────────────────────────────────────────────────┤
│  INFERENCE            src/lib/ai.ts — one entry point,       │
│  & ROUTING            Ollama → Cerebras → NIM → Claude/Gemini│
├──────────────────────────────────────────────────────────────┤
│  DATA & TENANCY       tenant-resolver/scope/memory.ts,       │
│                       src/db/schema.ts, drizzle/             │
└──────────────────────────────────────────────────────────────┘
        ▲ governance cuts across every layer above ▲
   receipt-*.ts · pq-sign.ts · transparency-*.ts · audit-*.ts
```

### Boundaries that are load-bearing

These are the ones a change can silently break. `BACKLOG.md`'s
invariants list is the authoritative version; this is the map.

- **`src/lib/ai.ts` is the only sanctioned path to a model.** Provider
  SDK calls outside it bypass cost routing, the kill-switch, and the
  budget checkpoint.
- **`outboundFetch` is the only sanctioned outbound HTTP in API
  routes.** ESLint warns on bare `fetch()`; 183 warnings remain
  (backlog M1). Each one is a route that skips the SSRF allowlist and
  the resolved-IP private-network check in `safe-host.ts`.
- **`createAgentRoute` is the only sanctioned way to add an agent.**
  It supplies auth, rate limiting, the output verifier, audit
  logging and memory hooks. An agent that hand-rolls its handler gets
  none of them.
- **CSRF/origin enforcement runs first in `clerkMiddleware`**, before
  auth lookup, with webhook exemptions by explicit prefix allowlist —
  never substring match. A substring match here was a Critical in
  wave 107, hotfixed in 107.1.

---

## The four pillars, honestly

The public framing of sovereign AI converges on four pillars — data,
model, compute, governance. It is a useful lens precisely because it
separates things this codebase does well from things it does not.

### Compute — real

Local-first execution is not a slogan here. `src/lib/ai.ts` routes
Ollama (local, $0) ahead of Cerebras, NVIDIA NIM, and only then the
hosted frontier models. The `node` plan tier in `plans.ts` sells local
execution as its distinguishing feature.

**Caveat:** local-first is the *routing preference*, not a guarantee.
An operator without a reachable Ollama endpoint falls through to
hosted providers. Nothing in the code prevents that fallthrough, and
nothing surfaces to the end user that it happened. If you need a hard
guarantee that data never leaves a machine, this does not yet provide
one — it provides a default, and defaults are not controls.

### Data — real

Tenant isolation runs through `tenant-resolver.ts`, `tenant-scope.ts`
and `tenant-memory.ts`. Retention is a fail-closed allowlist in
`audit-retention.ts` — adding an evidence action throws at module
load, deliberately. `deletion-receipts.ts` produces a cryptographic
record that data was destroyed. DSAR routes exist under
`src/app/api/dsar/`. PII redaction runs on every log call
(`src/lib/logger.ts`).

**Caveat:** row-level security is a runbook
(`docs/runbooks/rls-enforcement.md`), not an enforced database
property. Isolation is application-enforced. That is a real
architecture, but it means a route that forgets `tenant-scope` is
a cross-tenant read, and the database will not stop it.

### Model — real

BYOK keys are encrypted at rest in the `settings` table and read back
through `safeDecrypt` in `crypto.ts`. 39+ models across 8 providers
are reachable through one router, so no single vendor is structural.

**Caveat:** vendor independence at the routing layer is not the same
as output equivalence. `consensus.ts` (`verifiedAi()`) exists to cross-
check two models against each other precisely because they disagree.

### Governance — the actual moat

This is where the platform is genuinely above market, and it is worth
being precise about why rather than listing acronyms.

- **Post-quantum dual signing** — `pq-sign.ts` co-signs every canonical
  projection with Ed25519 (v2) and ML-DSA-65 / FIPS 204 (v3). Written
  for the 7–25 year retention horizons in clinical-trial and tax-audit
  work, where harvest-now-decrypt-later is a real threat model rather
  than a talking point.
- **Transparency log** — RFC 9162 inclusion proofs, independent
  witnesses, threshold cosigning (`transparency-*.ts`,
  `threshold-signer.ts`). Publication ordering is provable by a third
  party.
- **A specification, not just an implementation** — `docs/specs/`
  carries VAOS 1.0/2.0/3.0, TRS, RSA and an IETF draft, CC0. The wire
  format survives this company.
- **Cross-language conformance** — TypeScript, Python and Go verifiers
  check the same corpus (`packages/verifiable-receipts*/`). The format
  is portable in fact, not in principle.
- **Compliance exporters** — 11 of them, EU AI Act Annex IV through
  ISO 42001, NIST AI RMF, SOC 2, GDPR DPIA, HIPAA Security, EU CRA.

**Caveat, and it is the important one:** none of this is a
certification. The architecture supports an audit; it does not
constitute one. There is no SOC 2 attestation, no HIPAA BAA with
downstream providers, no notified-body involvement. Marketing language
was softened in wave C1 for exactly this reason. Keep it soft.

---

## The gap: orchestration

Three pillars are built. The layer that is *not* built is
orchestration, and it is the one the marketing has historically
claimed loudest.

- **2 of 140 agents** are genuinely multi-step tool-use loops
  (`competitor-scan`, `site-assassin`). The other 138 are single-shot
  model calls behind good plumbing. That plumbing is real and worth
  having — it is not the same as an agent.
- **21 of 140** are memory-aware.
- **The playbook executor is a serial `for` loop** —
  `src/app/api/playbooks/run/route.ts:127`. `swarm-protocol.ts` — 299
  lines of DAG machinery — has **zero importers**
  (`grep -rl swarm-protocol src/` returns only the file itself).

So: "140 agents" is a count of endpoints, not of autonomous systems.
Anything written for a buyer should say so. The honest claim is a
governed inference platform with a large verified-endpoint surface,
and that claim is strong enough on its own.

---

## What this document is not

It is not a scorecard. There is deliberately no percentage and no
grade here, because a system grading itself is the failure mode this
platform exists to replace — if self-assessment were sufficient
evidence, VAOS would have no reason to exist. The numbers at the top
are counts anyone can reproduce; the judgements are labelled as
judgements.

For what is left to build, in priority order, read `BACKLOG.md`.

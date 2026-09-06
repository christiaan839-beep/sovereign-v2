# Sovereign Matrix — Engineering Backlog

> **Source of truth for what's left.** This file is committed so future
> sessions and contributors don't have to rediscover gaps. Every wave
> updates this. If something is shipped, move it to the bottom log; if
> something new is discovered, add it under the right severity band.

Last refreshed: **2026-09-06** after wave 122 (one definition of "verified").

---

## Wave 122 — one definition of "verified" (2026-09-06)

`npm run verify` is now the single gate list for this repo. `scripts/verify.mjs`
owns it; `.github/workflows/ci.yml` calls it per gate (`--only=`) so the parallel
fan-out survives, and `scripts/git-hooks/pre-push` calls it as `--profile=quick`.
Ported from the `Sovereign-Matrix` package, adapted for a repo where the build
needs secrets and CI must stay parallel.

**The drift it closes.** "Verified" meant four different things in four places,
and they disagreed:

| Gate | ci.yml (before) | pre-push (before) | deploy-check skill (before) |
| --- | --- | --- | --- |
| lint / typecheck / tests | blocking | blocking | typecheck "advisory only" |
| registry drift | blocking | absent | absent |
| build | blocking | skipped | step 1 |
| `npm audit` high+ | blocking | skipped | absent |
| migration parity | **soft** (exit 0) | **hard** (exit 1) | absent |
| Suspense hook-trap | absent | warn | absent |
| `ssr:false` placement | absent | absent | step 4 |
| secret scan | absent | absent | step 6 |

Same schema drift failed on a laptop and passed in CI. Three checks existed only
inside a skill, so they ran only when someone remembered to invoke it.

**Stale claims corrected in `.claude/skills/deploy-check`** — it asserted
`ignoreBuildErrors: true` and told the reader type errors were advisory
(`next.config.ts:16` says `false`; verified 0 errors), referenced the
`ClientOnlyEffects` wrapper deleted in wave 121, and warned of a ClerkProvider
prerender crash the current `SafeClerkProvider` SSR path doesn't have. The skill
now runs `npm run verify` and interprets failures; it carries no check list.

**Skips are not passes.** A gate that can't run here (`build` without Clerk/DB
env, `migration parity` without `DATABASE_URL`) reports `∅ skipped` and the
summary says `no blocking failures` rather than `all gates passed`.

**Secret-scan patterns rewritten** — the skill's `_secret|_api_key|password`
matched every identifier in a diff, which is why it was never automated. Now
matches secret *values* (`sk_live_`, `sk-ant-`, `AKIA…`, `ghp_`, long inline
assignments) with a placeholder exclusion.

**Verified on this tree:** typecheck 0 errors (67s), eslint clean (78s), 4491
tests passing across 294 files (42s), registry in sync, both `ssr:false` uses
correctly inside client components. `audit` fails — see C2 below, found by this
gate on its first run.

---

## Wave 121 — deferred-flaw closeout + PayPal-only enablement (2026-07-08)

Closed the items wave 120 deferred as "needs its own tested wave," plus made
PayPal a complete standalone billing path. Typecheck + full suite (294 files,
4491 passing) + production build + `npm audit --audit-level=high` (0 highs) all
green.

**Revenue-counting correctness (the deferred cluster):**

- **Usage double-counting FIXED** — `free-tier.countMonthlyUsage` and
  `plan-enforcement.getMonthlyUsage` now `SUM(tokens_used)` over the
  `model='platform'` run-marker rows instead of `count(*)` over the whole
  table, so a run's cost-telemetry rows no longer each burn quota.
- **`addBonusRuns` FIXED** — the same SUM counts the bonus row's negative
  `tokens_used` as a credit (was `count(*) → +1 consumption`); net usage is
  clamped to ≥0.
- **Quota check-then-act race** — still a bounded over-serve (concurrent burst
  at the limit boundary); correct fix is an atomic reservation on the quota hot
  path tangled with the 5–10s usage caches. Documented, not rushed (blocking
  paying users would be worse than the bounded over-serve).

**Webhook idempotency (crash-drop) FIXED** — new `unmarkProcessed()` releases
the marker in the error path so a provider retry reprocesses instead of being
skipped. Wired into all 7 payment webhooks (stripe, paystack, payfast, crypto,
yoco, paypal, moonpay); paystack/payfast hoist their id so the catch can see it.

**PayPal is now a complete billing path (enables PayPal-only operation)** —
the webhook previously provisioned add-ons ONLY; a `plan` capture fell through
to "no provisioning hook", charging the customer without upgrading them. Now
`activatePaypalPlan` upserts a 30-day subscription (mirrors the crypto one-time
model, with amount-tampering defense), and `currentPeriodEnd` enforcement
downgrades it afterwards. Route test added.

**Prototype-pollution in `normalizePlanId` FIXED** — `lower in PLANS` was true
for `"__proto__"`/`"constructor"` (prototype chain), smuggling a bogus "plan"
past every webhook. Now uses `hasOwnProperty`. Central fix for all callers.

**`_billing/webhook` node-default FIXED** — the legacy duplicate defaulted plan
to `node` on `subscription.updated`; now derives from the price id and only
overwrites when resolvable (same fix as `_payments/stripe`).

**`isEncrypted` hardened** — now requires canonical base64 + exact round-trip
before the length check, so long plaintext secrets (`sk_live_…`, JSON blobs) are
no longer misclassified as ciphertext. Backward-compatible (no format change).

**SSR invariants reconciled** — CLAUDE.md claimed ClerkProvider must be
`dynamic ssr:false` and cinematic components must use `ClientOnlyEffects`, but
the shipped, build-green code deliberately SSRs Clerk via `SafeClerkProvider`
and imports mount-guarded `"use client"` cinematic components directly. Updated
the docs to match reality and removed the dead, contradictory `ClientOnlyEffects`
(zero importers).

**Dependency hardening (greens the Security Audit CI gate)** — `npm audit fix`
(non-breaking) + surgical `nodemailer@9` bump cleared all 8 high-severity
advisories (8 → 0; total 29 → 10 moderate). Re-added `svix` as an explicit
dependency (the resend bump dropped it; the Clerk webhook imports it directly).

**Deferred (documented, not shipped):**

- **page-builder preview CSP** — generated previews load the Tailwind **Play
  CDN**, which needs `unsafe-eval` (deliberately removed from the site CSP), and
  `srcDoc` iframes inherit the parent CSP. Correct fix: a scoped-CSP preview
  route serving generated HTML via `src=` with its own relaxed policy (4 builder
  UI touch points). Not weakening the global CSP for a cosmetic internal-tool fix.
- **Quota atomic reservation** (see above) and the **two-state `stripe_events`
  table** (the `unmarkProcessed` release-on-error fix covers the reported
  crash-drop; the full received→completed table remains a nice-to-have).
- **ZAR price inconsistency** — a pricing/business decision, needs operator input.

---

## Wave 120 — repo-revival flaw sweep (2026-07-07)

A multi-agent audit (7 finders × adversarial verify) plus a green-baseline
pass. Every fix below ships with typecheck + full test suite (293 files,
4484 passing) + production build all green. New/updated tests: vector-memory
cap, claudeToolUse M7 bounds, agent-factory L5 (5 cases), safe-host IPv4-mapped
IPv6, retry 4xx, rate-limit Redis fail-closed.

**Liveness / build (was silently broken):**

- **Workspace packages never built on clone.** `postinstall → build-packages`
  added to `package.json` so `@sovereign-matrix/*` dist exists after a plain
  `npm install` (typecheck failed on a fresh clone before this).
- **Conformance corpus unrunnable on clone** — `public-key.pem` was swallowed
  by the root `*.pem` gitignore, so the TS/Py/Go harnesses ENOENT'd. Added a
  deterministic `generate-fixtures.mjs`, committed the public key, gitignore
  exception, README section. Suite 1-failed → green.
- **Dockerfile 100% broken** (Railway/self-host): `npm ci` ENOENT on workspace
  manifests + `--omit=dev` stripped `next build` deps + missing `scripts/`.
  Rewrote to a correct full-install builder stage.
- **`vercel.json` functions glob** `app/api/**` → `src/app/api/**` (matched
  nothing; 60s maxDuration never applied).
- **CSP blocked all brand fonts** — added `fonts.googleapis.com` (style-src) +
  `fonts.gstatic.com` (font-src).
- **CORP `same-site` killed the embeddable badge** — added `cross-origin`
  overrides for `/badge/:path*` and `/embed/:path*`.
- **`engines.node`** `>=18` → `>=20.9.0` (Next 16 floor).
- **Middleware headers contradicted next.config.ts** (mic policy, HSTS
  preload) — removed the duplicate keys; next.config.ts is now sole source.

**Payments (revenue was silently broken):**

- **CRITICAL — Paystack rejected every real payment**: validated the
  ZAR-charged amount against `priceUsdCents` (~18-100× off). Now `priceZarCents`.
- **PayFast rejected legit array/node/enterprise**: `USD*19` heuristic →
  canonical `priceZarCents`.
- **Stripe `subscription.updated` never wrote `plan`** — portal
  upgrades/downgrades didn't change tier. Now derives plan from the price ID
  (`getPlanIdFromStripePriceId`) + treats `trialing` as active.
- **`currentPeriodEnd` never enforced** — one-time crypto payments granted the
  tier forever. `getUserPlan` now downgrades expired subs.

**Security:**

- **IDOR — `/api/scheduled-runs` & `/api/inbox`** trusted a spoofable
  `x-user-id` header for cross-user CRUD. Now Clerk `auth()` only.
- **Unauth disclosure** — `/api/agent-analytics` (platform analytics) →
  `requireAdmin`; `/api/errors` GET (stack traces) → `requireAdmin`, POST
  (injection/DoS) → internal-secret.
- **SSRF — IPv4-mapped IPv6 bypass** (`::ffff:169.254.169.254`) in
  `safe-host.ts` now decodes the embedded v4 and re-checks it; `::` blocked.

**Reliability / correctness:**

- **Claude thinking mode always 400'd** (no `max_tokens`, poisoned the shared
  breaker) — always set `max_tokens > budget_tokens`.
- **`error-recovery.safeFetch` never retried 5xx/429** — thrown errors now
  carry `status` so `classify` routes them retryable.
- **Upstash rate-limit failed OPEN** on any error (+ shared key namespace, no
  timeout) — now checks `res.ok`/error body → memory fallback, namespaced key,
  2s timeout.
- **`verifiedAi` treated "NOT APPROVED" as approval** — word-boundary +
  negation-exclusion regex.
- **Router hijacked pinned `mistral`/`groq`/`deepseek`/`qwen`** to NIM for
  nvidia-BYOK users — exempted models with their own handler.
- **`groqTranscribe` uploaded whole pooled buffer** (byteOffset ignored) —
  copies the view's bytes.
- **`ollamaText` had no timeout** (a wedged endpoint hung every call) — 20s.
- **`smartAi` stripped legit "Step N:" content** anywhere — anchored to start +
  gated on thinking mode.
- **`withRetry` retried deterministic 4xx** — added `shouldRetry` + default
  4xx-skip (except 408/429).
- **H3 / H2 / M7 / L2 / L3 / L4 / L5** (pre-tracked below) all shipped.

**Deferred (documented, not fixed — need their own tested wave):**

- **Usage double-counting** — each run writes ≥2 usage rows; `getMonthlyUsage`
  uses `count(*)`, so quota burns 2×+ per run. Needs a canonical run counter
  (distinct requestId / runs table). Signed-column refactor — high blast radius,
  do NOT rush.
- **`addBonusRuns` backfires** — inserts a negative-token row that `count(*)`
  reads as +1 consumption. Same counting refactor as above.
- **Check-then-act quota race** — concurrent runs can exceed the cap (no atomic
  reservation).
- **Stripe (+ all provider) idempotency marks-before-process** — a handler crash
  - provider retry permanently drops the event. Use the two-state
    `stripe_events` table (received→completed).
- **ZAR prices internally inconsistent** with USD (array R4997 for a $49 plan)
  — a pricing/business decision; needs operator input, not a silent code change.
- **`_billing/webhook` duplicate** defaults plan to `node` on
  `subscription.updated` — retire in favour of `_payments`.
- **`isEncrypted` misclassifies long plaintext** as ciphertext — current sole
  caller survives via a JSON fallback; tighten before a new caller relies on it.
- **Root layout imports browser-only cinematic components directly** (bypasses
  `ClientOnlyEffects`) and **`SafeClerkProvider` SSRs Clerk** — both contradict
  CLAUDE.md invariants; code and docs must be reconciled deliberately (one is
  wrong) rather than auto-"fixed".
- **page-builder previews reference `cdn.tailwindcss.com`** (CSP-blocked in
  srcDoc) — fix by inlining styles in the generator, not by weakening CSP.

---

## How "done" the platform actually is (honest %s)

These percentages are anchored in code I read this session, not marketing.

| Dimension                                                                                                         | % complete | Reasoning                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cryptographic infrastructure** (HMAC + Ed25519 + ML-DSA-65 + threshold cosigs + deletion receipts + federation) | **~95%**   | Genuinely above-market. Real implementations, real tests. Bleeding-edge ML-DSA-65 in production is rare.                                                                |
| **Audit log + retention + compliance evidence**                                                                   | **~95%**   | Wave 105 retention with fail-closed allowlist + 30d/forever policies. Real.                                                                                             |
| **Security wiring** (CSRF middleware, PII redaction, kill-switch, ESLint guardrail)                               | **~80%**   | Active after waves 107/107.1. Gaps: DNS-rebinding at outboundFetch (only fetch_page has per-caller defense), 121 bare fetch() callsites still in API routes.            |
| **Cost-aware AI routing**                                                                                         | **~90%**   | NIM-first default, verifiedAi auto-gated, contract-analyzer 3-tier, 4 SDK-direct paths checkpoint-covered. ~$590-1,300/mo savings live.                                 |
| **UI / Landing** (brand-correct, glass, motion, telemetry)                                                        | **~80%**   | All 26 /for-\* pages brand-correct (10 shell + 14 bespoke-corrected wave 109.7 + 2 already-clean). VerticalPageShell + scroll rail + LiveReceiptFeed live.              |
| **Agent layer — multi-step tool-use**                                                                             | **~1.4%**  | 2 of 140 (competitor-scan wave 110, site-assassin wave 113). Pattern proven on a second flagship. Per-flagship conversion is mechanical now but per-agent.              |
| **Agent layer — memory-awareness**                                                                                | **~15.0%** | 21 of 140 opted in via wave-111 factory hooks (18 prior + competitor, threat-hunt, supply-chain from batch 6). 119 are one ~25-line config block away.                  |
| **DAG executor for playbooks**                                                                                    | **0%**     | Still a for-loop in `src/app/api/playbooks/run/route.ts`. swarm-protocol.ts (299 LOC) has zero callers.                                                                 |
| **Marketing claims vs actual compliance certifications**                                                          | **~30%**   | Platform infrastructure addresses HIPAA/FERPA/SOC 2 architecturally, but no signed certifications. Marketing language needs softening OR certifications need acquiring. |

**Composite (weighted by user-visible impact):** ~55-60% from "production-deployable with every marketing claim true."

The platform is production-deployable RIGHT NOW for: agency operators automating workflows, audit-grade compliance evidence trails, regulated verticals needing cryptographic receipts. **Not yet ready for**: marketing claims of full autonomous multi-agent orchestration (5% of the way there); HIPAA Covered Entity processing without BAA paperwork; SOC 2-certified-only procurement panels.

---

## Wave Log (this session — chronological)

| #   | Commit         | Wave               | Outcome                                                                                                                                                                                                                                                                                      |
| --- | -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `5ad2057d`     | 107                | Security wiring — middleware activation (was dead code), CSRF/origin enforcement, kill-switch wire-up in ai.ts + agent slug-route, PII redaction in logger, ESLint guardrail vs bare fetch() in API routes                                                                                   |
| 2   | `d1ef9531`     | 107.1              | Hotfix — Critical CSRF substring-bypass + 2 Highs + 3 Mediums from review                                                                                                                                                                                                                    |
| 3   | `1bbffe76`     | 108                | Cost routing — smartAi NIM-first, verifiedAi auto-gate, contract-analyzer 3-tier, kill-switch on grounded-search + deep-think direct fetches                                                                                                                                                 |
| 4   | `26e662bc`     | 108.5              | More cost flips — god-brain JSON truncation, smart-router → Cerebras, prospector → Cerebras, grounded-search synthesis → NIM, checkpoints on filmmaker/voice/claude-think/ai-stream direct fetches                                                                                           |
| 5   | `3100a240`     | 109                | VerticalPageShell with frozen accent map (closes silent Tailwind dynamic-class purge bug); 2 example pages refactored                                                                                                                                                                        |
| 6   | `e62f7568`     | 109.5              | 8 more vertical pages refactored to the shell, 5 accent tokens visually verified in Chrome                                                                                                                                                                                                   |
| 7   | `50176591`     | 109.6              | Scroll-linked rail on VerificationPipeline + LiveReceiptFeed block on landing                                                                                                                                                                                                                |
| 8   | `40137587`     | 110                | First flagship agent (competitor-scan) becomes multi-step `claudeToolUse` with vector-memory + 2 Highs fixed inline                                                                                                                                                                          |
| 9   | `fc950cf0`     | 111                | Factory-level memory hooks (any agent one config-block away from memory-awareness) + leads opt-in + 2 Highs fixed inline                                                                                                                                                                     |
| 10  | `7956b1c0`     | 107.2              | DNS-rebinding hardening — `safeResolveOrNull` + `resolvedHostIsSafe` promoted from federation-puller to shared `src/lib/safe-host.ts`, wired into `outboundFetch` so every caller inherits the resolved-IP private-net check. Closes H1 uniformly. +17 tests pinning the contract.           |
| 11  | `30a9dab4`     | C1 + 111.1 (batch) | Marketing-language pass on 11 vertical pages (HIPAA / FERPA / SOC 2 Type II claims softened) + memory opt-in on email-sequence and ad-report (3 of 140 agents now memory-aware).                                                                                                             |
| 12  | `0dd8fd16`     | 109.7              | Brand-correct 14 bespoke /for-\* pages — bg-[#010101] → bg-[#030303] + white-pill nav → glass chrome + for-recruiting hero CTA → copper PrimaryCTA. All 26 /for-\* pages now brand-correct. UI dimension 60% → 80%.                                                                          |
| 13  | `478c5c45`     | 111.1 (batch 2)    | Memory opt-in on 4 more agents: blog-gen, reputation, funnel-xray, social-router. Memory-aware coverage 3 → 7 of 140 (~5%). All use factory `pastContextAsPrompt()` with auto-prepended untrusted-marker directive.                                                                          |
| 14  | `2b31bcd3`     | 111.1 (batch 3)    | Memory opt-in on 3 more agents: brand-audit, client-report, competitor-rip. Memory-aware coverage 7 → 10 of 140 (~7%).                                                                                                                                                                       |
| 15  | `a1acd62c`     | 111.1 (batch 4)    | Memory opt-in on 5 more agents: competitive-radar, organic-content, agri-intel, compliance-monitor, meeting-notes. Memory-aware coverage 10 → 15 of 140 (~11%). Diverse domain coverage — competitive intel, content gen, ag, compliance, meeting-summary.                                   |
| 16  | `815f87a9`     | 111.1 (batch 5)    | Memory opt-in on 3 more agents: auto-heal (proven-remediation pattern compounding), code-reviewer (repeat-issue surface), outbound (industry/offer sequence-hook compounding). Memory-aware coverage 15 → 18 of 140 (~13%). Skipped booking + healthcare-docs (delegation + HIPAA concerns). |
| 17  | _pending push_ | 111.1 (batch 6)    | Memory opt-in on 3 more agents: competitor (per-competitor battle-plan compounding), threat-hunt (recurring TTP surface), supply-chain (per-region disruption history). Memory-aware coverage 18 → 21 of 140 (~15%).                                                                         |

---

## Active Backlog (prioritized)

### CRITICAL — production-down or legal-exposure risk

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Effort | Notes                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| ~~C1~~ | ~~Marketing-language audit pass~~ — **SHIPPED.** `HIPAA-compliant` → `HIPAA-aware controls. BAA available for enterprise deployments` on /for-healthcare. `FERPA-compliant` → `FERPA-aware controls` on /for-education. `SOC 2 Type 2 — continuous monitoring` → `SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)` across 9 verticals (insurance, insurance-claims, prior-auth, tax-audit, utilities, esg, legal-services, banking, defense). | DONE   | Eliminates the only real legal exposure. |
| C2     | **`npm audit --audit-level=high` is RED — the blocking Security Audit CI job is failing on main.** 11 high advisories (`next` direct; `undici`, `axios`, `postcss`, `sharp`, `nanoid`, `js-yaml`, `browserslist`, `brace-expansion`, `fast-uri`, `ip-address` transitive), 22 total. Every one reports a fix available. Wave 121 claimed 8 → 0 highs; advisories have landed since. Found by wave 122's `verify` gate on first run. Needs its own wave: `next` is a direct dependency and the bump wants a build + smoke pass, not a drive-by. | 1 session | Run `node scripts/verify.mjs --only=audit` to reproduce. |

### HIGH — security gaps the audit found that aren't fully closed yet

| ID     | Item                                                                                                                                                                                                                                                                                                   | Effort | Notes                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------ |
| ~~H1~~ | ~~DNS-rebinding hardening at `outboundFetch` layer~~ — **SHIPPED in wave 107.2.** `safeResolveOrNull` + `resolvedHostIsSafe` promoted to `src/lib/safe-host.ts`; wired into `outboundFetch` so every caller inherits the defense. Federation-puller re-exports the shared symbols for backward-compat. | DONE   | 17 tests pin the contract.                       |
| ~~H2~~ | ~~Per-user `storeMemory` write cap.~~ — **SHIPPED (wave 120).** `trimUserMemories` deletes oldest rows beyond `MAX_MEMORIES_PER_USER` (env `MEMORY_MAX_ROWS_PER_USER`, default 10K, floor 100) after every write; new index `agent_memories_user_created_idx`; 6 tests.                                | DONE   | Trim is fire-and-forget — never fails the write. |
| ~~H3~~ | ~~`INTERNAL_WEBHOOK_SECRET \|\| ""` fallback~~ — **SHIPPED (wave 120).** New `src/lib/internal-secret.ts`: `getInternalWebhookSecret()` returns null when unset (senders skip), `verifyInternalSecretHeader()` fails closed. Wired into paystack/payfast/auto-onboard.                                 | DONE   | Documented in `.env.example`.                    |

### MEDIUM — quality/cost/architecture improvements that aren't blockers

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                 | Effort                   | Notes                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| M1     | **Bulk `fetch()` → `outboundFetch()` codemod** across 121 callsites in `src/app/api/**`. ESLint warns on every site since wave 107; codemod replaces them uniformly. Most are hardcoded provider URLs (Resend, NVIDIA, Anthropic) so the security upgrade is incremental, but the codemod is the structural fix.                                                     | 1 session                | Mechanical. Per-site verify shape (provider URLs are safe; user-supplied URLs need the SSRF allowlist). Wave 107.5.       |
| M2     | **Convert 4 more flagship agents to wave-110 multi-step pattern**: `lead-blitz`, `closer`, `site-assassin`, `deep-think`, `content-machine`, `super-agent`. Each ~300 LOC with 5-tool registry + tests + security review.                                                                                                                                            | 1 session each           | Pattern proven by competitor-scan. Per-flagship work. Bring "% multi-step agentic" from 0.7% → 4% per flagship converted. |
| M3     | **Memory opt-in across remaining 137 agents.** Wave-111 made this a 1-config-block change. Each agent: decide what to search (input-derived query) + what to store (1 line of `extract`) + metadata. Now at 3 of 140 (~2.1%) — leads + email-sequence + ad-report.                                                                                                   | ~30 min each, batch-able | Mechanical. Brings "% memory-aware" from 2.1% → ~50% in a focused session.                                                |
| ~~M4~~ | ~~14 bespoke `/for-*` pages still ship `bg-[#010101]` + white-pill CTA~~ — **SHIPPED in wave 109.7.** All 14 pages now use `bg-[#030303]` + glass-chrome nav (`bg-white/[0.04] border border-white/[0.08]`) preserving each page's bespoke content (compliance grids, ISR/metadata, per-vertical accent). for-recruiting hero CTA also swapped to copper PrimaryCTA. | DONE                     | Net: all 26 /for-\* pages brand-correct.                                                                                  |
| M5     | **DAG executor for playbooks.** Replace the `for`-loop in `src/app/api/playbooks/run/route.ts:109-184` with a real DAG using `swarm-protocol.ts` (299 LOC currently unused). Enables actual parallel agent fanout + conditional edges. Wave 112.                                                                                                                     | 2-3 sessions             | Architectural. Closes the "multi-agent OS" marketing gap.                                                                 |
| M6     | **Vector-memory storage growth audit + LRU/TTL strategy.** Beyond per-user cap (H2), need a backstop retention policy for `agent_memories`. Tie into wave-105 retention if appropriate.                                                                                                                                                                              | 1 session                | Schema change + audit-log integration.                                                                                    |
| M7     | **Trace cap in `claudeToolUse` internal trace** + tool-result truncation older than N turns. Wave-110 review L1 + M3 findings. Costs scale with token count on long loops.                                                                                                                                                                                           | 2-3 hours                | Inside `claudeToolUse` in ai.ts. Truncate tool_result older than 2 turns to a one-line summary.                           |
| M8     | **Performance benchmarks** — measure + publish actual P50/P99 latency, model-failover hit rate, kill-switch trip rate. Replace "trust us" with measured numbers in `/spec` or `/explorer`.                                                                                                                                                                           | 1 session                | Add metrics-collection module + a public dashboard.                                                                       |

### LOW — cleanup and polish that doesn't change behavior

| ID  | Item                                                                                                                                                                                                                                                                                    | Effort  | Notes                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------- |
| L1  | **6 transitive `next → postcss` vulns** from `npm audit`. No upstream patch yet. Watch for Next.js minor release.                                                                                                                                                                       | passive | Re-run `npm audit fix` quarterly. |
| L2  | **`as NextRequest` cast** in `src/middleware.ts:271` — works in practice (Edge runtime always passes NextRequest) but worth an `instanceof` guard for clarity. Wave-107 review's Low.                                                                                                   | 15 min  | Cosmetic.                         |
| L3  | **Hardcoded `User-Agent: SovereignBot/1.0`** in competitor-scan's fetch_page. Should be env-configurable. Wave-110 review's L2.                                                                                                                                                         | 15 min  | Cosmetic.                         |
| L4  | **claudeToolUse `ctx.trace` not internally bounded** — only response sliced to 12. Long error-retry loops can grow the trace array. Wave-110 review's L1.                                                                                                                               | 15 min  | Cap push at e.g. 50 entries.      |
| L5  | **Test coverage gaps in wave-111 memory hooks**: (a) extractor that throws synchronously, (b) extractor returning non-string/non-array (number/object), (c) verify pastContext threads to the retry handler invocation, (d) post-store doesn't run when verifier blocks. None critical. | 30 min  | Add 4 targeted test cases.        |

### OPERATIONAL — manual steps the operator needs to take (not code)

| ID  | Item                                                                                                                       | Owner              |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| O1  | Apply DB migrations 0002-0004 (plus newer 0016-0025) in Neon SQL Editor before deploy. `drizzle/` is canonical.            | Operator           |
| O2  | Set up Stripe webhook endpoint in Stripe Dashboard → `/api/payments/stripe/webhook`.                                       | Operator           |
| O3  | Add Stripe price IDs: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_ARRAY`, `STRIPE_PRICE_NODE`, `STRIPE_PRICE_ENTERPRISE`.        | Operator           |
| O4  | Set up Clerk webhook endpoint → `/api/webhooks/clerk` (welcome emails + tenant creation).                                  | Operator           |
| O5  | Add `CLERK_WEBHOOK_SECRET` env var from Clerk Dashboard → Webhooks.                                                        | Operator           |
| O6  | (If pursuing) SOC 2 readiness assessment using the existing audit-grade infrastructure as the basis.                       | Operator + auditor |
| O7  | (If pursuing) HIPAA BAA paperwork with downstream providers (Anthropic, NVIDIA, etc.) before marketing as HIPAA-compliant. | Operator + legal   |

---

## Future Wave Numbering (so the wave-by-wave discipline continues)

| Next wave | Scope                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ~~107.2~~ | ~~DNS-rebinding hardening at `outboundFetch` (H1)~~ — SHIPPED                                                                 |
| 107.5     | Bulk `fetch()` → `outboundFetch()` codemod (M1)                                                                               |
| ~~109.7~~ | ~~Brand-correct the 14 bespoke `/for-*` pages (M4) — page-by-page~~ — SHIPPED                                                 |
| 111.1     | Mass memory opt-in across remaining 119 agents (M3) — batched. **In progress:** 21 of 140 (~15%) opted in across batches 1-6. |
| 111.x     | Per-user storeMemory write cap (H2)                                                                                           |
| 112       | DAG executor for playbooks (M5)                                                                                               |
| 113-117   | Flagship agent conversions: lead-blitz / closer / site-assassin / deep-think / content-machine / super-agent (M2)             |
| 118       | claudeToolUse trace cap + tool-result summarisation (M7)                                                                      |
| 119       | Performance benchmarks + public dashboard (M8)                                                                                |

---

## Invariants — properties future waves MUST preserve

These are the load-bearing contracts. If any wave breaks one, the wave failed.

1. **Audit log retention allowlist is fail-CLOSED.** `RETENTION_POLICIES` (wave 105) contains only operational actions. Adding an evidence action throws at module load. Never weaken this guard.
2. **PII redaction runs on every log call.** Two-tier policy (substring + exact) in `src/lib/logger.ts`. Don't bypass.
3. **CSRF/origin enforcement runs FIRST in `clerkMiddleware`.** Before auth lookup. Don't move it later in the chain.
4. **Webhook routes bypass CSRF via explicit prefix allowlist only.** Never substring-match; the substring approach (`pathname.includes('/webhook')`) created a Critical bypass in wave 107 that 107.1 hotfixed.
5. **`outboundFetch` is the only sanctioned outbound HTTP in API routes.** ESLint warns on bare `fetch()`. Codemod is wave 107.5.
6. **Kill-switch checkpoint inside every iterative tool loop.** `claudeToolUse` calls `budgetCheckpoint` per iteration. Any future tool-loop primitive must do the same.
7. **Memory ops skip `userId === "anon" || !userId`** in BOTH search and store. Cross-tenant namespace defense.
8. **`pastContextAsPrompt()` auto-prepends `PAST_MEMORY_DIRECTIVE`** in front of wrapped content. Don't strip the directive in a future "cleanup" PR — it closes the 140x prompt-injection-via-memory blast radius.
9. **`neutraliseInjectionPatterns()` runs before `storeMemory`** in the factory store hook. Layer-2 defense.
10. **`runWithBudgetAndAudit` captures stats INSIDE the budget scope.** Outside the scope, AsyncLocalStorage has torn down and `getExecutionStats()` returns null.
11. **`scripts/verify.mjs` is the only place a gate is defined.** CI, the pre-push hook, and `/deploy-check` all call it; none of them carries its own check list. Adding a check to a workflow file or a skill instead of this script re-creates the wave-122 drift. A gate that cannot run reports skipped, never passed.

---

## Decision log — non-obvious choices made this session

- **Refused Modules 1-9 from the "master blueprint" prompts.** Multiple security vulnerabilities (command injection, hardcoded fallback secrets, path traversal) + fictional infrastructure (OpenClaw, NeMo Retriever, Matrix homeserver) + Vercel-incompatible patterns. Real systems already implement the intent correctly.
- **Wave 109 SKIPPED `for-recruiting`** even though it had the standard signature. The 3-line h1 + longer hero blurb structure didn't fit cleanly into the shell.
- **Wave 110 chose `competitor-scan` as the first multi-step conversion** over lead-blitz/closer because of clear tool boundaries, headline marketing position, and zero dependencies on voice infra.
- **Wave 111 chose `leads` as the first memory opt-in** because the memory pattern (compound past lead signals on same niche) has obvious user value vs other agents.
- **DNS-rebinding fix scope decision in wave 110.1**: per-caller defense in `fetch_page` only (the only NEW SSRF surface wave 110 added) rather than promoting to `outboundFetch` itself. The architectural fix is deferred to wave 107.2.
- **Wave 122 kept CI's parallel fan-out** rather than copying the source repo's "CI runs `npm run verify` and nothing else". That repo builds in seconds; here a 15-minute `next build` behind lint would make CI strictly worse. Each job calls `--only=<gate>`, so there is still exactly one definition.
- **Wave 122 did NOT flip migration parity from soft to hard in CI.** The split was the drift, but ci.yml's "soft until baseline established" is a deliberate call. It is now one env var (`VERIFY_MIGRATIONS_SOFT`) in one file instead of an accident across two; dropping it is the whole change when the baseline lands.
- **Per-user memory write cap deferred twice** (wave 110 + wave 111 reviews). Real gap. Track as H2 above. Don't defer a third time.

---

## How to use this file

- Every new wave: update the wave log + decision log, move items from Active to ✓-done if completed.
- Every session start: read this file before planning. The summary table tells you % done; the prioritized backlog tells you what to pick.
- A new contributor: read this top-to-bottom in 10 minutes; you know exactly where the platform is.

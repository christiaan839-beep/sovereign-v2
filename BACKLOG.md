# Sovereign Matrix — Engineering Backlog

> **Source of truth for what's left.** This file is committed so future
> sessions and contributors don't have to rediscover gaps. Every wave
> updates this. If something is shipped, move it to the bottom log; if
> something new is discovered, add it under the right severity band.

Last refreshed: **2026-06-10** after wave 114 (repo-health + H2/H3 + L2-L5/M7 sweep).

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
| 18  | _this wave_    | 114                | Repo-health + security sweep: conformance corpus repaired (`public-key.pem` was swallowed by the blanket `*.pem` gitignore and never committed — cross-language suite was unrunnable; regenerated v2 fixtures via new committed `generate-fixtures.mjs`, gitignore exception added, TS/Py/Go harnesses all agree); session-start hook now runs `build:packages` (fresh clones had ~25 TS2307 errors); H2 shipped (per-user storeMemory cap); H3 shipped (`internal-secret.ts`); M7 shipped (claudeToolUse tool-result compaction); L2/L3/L4/L5 shipped. +34 tests (4445 → 4479). |

---

## Active Backlog (prioritized)

### CRITICAL — production-down or legal-exposure risk

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Effort | Notes                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------- |
| ~~C1~~ | ~~Marketing-language audit pass~~ — **SHIPPED.** `HIPAA-compliant` → `HIPAA-aware controls. BAA available for enterprise deployments` on /for-healthcare. `FERPA-compliant` → `FERPA-aware controls` on /for-education. `SOC 2 Type 2 — continuous monitoring` → `SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)` across 9 verticals (insurance, insurance-claims, prior-auth, tax-audit, utilities, esg, legal-services, banking, defense). | DONE   | Eliminates the only real legal exposure. |

### HIGH — security gaps the audit found that aren't fully closed yet

| ID     | Item                                                                                                                                                                                                                                                                                                   | Effort   | Notes                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ~~H1~~ | ~~DNS-rebinding hardening at `outboundFetch` layer~~ — **SHIPPED in wave 107.2.** `safeResolveOrNull` + `resolvedHostIsSafe` promoted to `src/lib/safe-host.ts`; wired into `outboundFetch` so every caller inherits the defense. Federation-puller re-exports the shared symbols for backward-compat. | DONE     | 17 tests pin the contract.                                                                                                        |
| ~~H2~~ | ~~Per-user `storeMemory` write cap~~ — **SHIPPED in wave 114.** `enforcePerUserCap()` pre-flight in `storeMemory`: count per user_id, prune oldest (`created_at ASC`) to open a slot at the 10K default cap (`MEMORY_MAX_ROWS_PER_USER` env override, floor 100). Fail-open on count errors (quota guard, not a security boundary). Anon-namespace refusal also moved INTO the primitives (`storeMemory`/`searchMemory`) as invariant-7 defense-in-depth. 9 tests. | DONE | Concurrent writers can briefly overshoot; next write self-heals via `count - cap + 1` delete. |
| ~~H3~~ | ~~`INTERNAL_WEBHOOK_SECRET \|\| ""` fallback~~ — **SHIPPED in wave 114.** New `src/lib/internal-secret.ts` is the only sanctioned access path: `getInternalWebhookSecret()` returns non-empty string or null (never `""`), `verifyInternalSecret()` is the fail-closed header check. 3 call sites migrated; senders now SKIP the auto-onboard call when the env is unset instead of mailing a doomed empty header. Registered in env-check as `important`. 7 tests pin the empty-vs-empty non-match. | DONE | |
| H4     | **payfast webhook signature weaknesses** (pre-existing, surfaced by wave-114 security review): (a) accepts a passphrase-less MD5 signature when `PAYFAST_PASSPHRASE` is unset, (b) non-constant-time `hash === signature` compare (paystack handler already uses `timingSafeHexEqual`), (c) derives `sourceIP` from the FIRST `x-forwarded-for` entry while the middleware rate-limiter deliberately trusts the LAST. `src/app/api/_payments/payfast/webhook/route.ts:48-107`. | 1-2 hours | Align with the paystack handler's patterns; require passphrase in production. |

### MEDIUM — quality/cost/architecture improvements that aren't blockers

| ID     | Item                                                                                                                                                                                                                                                                                                                                                                 | Effort                   | Notes                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| M1     | **Bulk `fetch()` → `outboundFetch()` codemod** across 121 callsites in `src/app/api/**`. ESLint warns on every site since wave 107; codemod replaces them uniformly. Most are hardcoded provider URLs (Resend, NVIDIA, Anthropic) so the security upgrade is incremental, but the codemod is the structural fix.                                                     | 1 session                | Mechanical. Per-site verify shape (provider URLs are safe; user-supplied URLs need the SSRF allowlist). Wave 107.5.       |
| M2     | **Convert 4 more flagship agents to wave-110 multi-step pattern**: `lead-blitz`, `closer`, `site-assassin`, `deep-think`, `content-machine`, `super-agent`. Each ~300 LOC with 5-tool registry + tests + security review.                                                                                                                                            | 1 session each           | Pattern proven by competitor-scan. Per-flagship work. Bring "% multi-step agentic" from 0.7% → 4% per flagship converted. |
| M3     | **Memory opt-in across remaining 137 agents.** Wave-111 made this a 1-config-block change. Each agent: decide what to search (input-derived query) + what to store (1 line of `extract`) + metadata. Now at 3 of 140 (~2.1%) — leads + email-sequence + ad-report.                                                                                                   | ~30 min each, batch-able | Mechanical. Brings "% memory-aware" from 2.1% → ~50% in a focused session.                                                |
| ~~M4~~ | ~~14 bespoke `/for-*` pages still ship `bg-[#010101]` + white-pill CTA~~ — **SHIPPED in wave 109.7.** All 14 pages now use `bg-[#030303]` + glass-chrome nav (`bg-white/[0.04] border border-white/[0.08]`) preserving each page's bespoke content (compliance grids, ISR/metadata, per-vertical accent). for-recruiting hero CTA also swapped to copper PrimaryCTA. | DONE                     | Net: all 26 /for-\* pages brand-correct.                                                                                  |
| M5     | **DAG executor for playbooks.** Replace the `for`-loop in `src/app/api/playbooks/run/route.ts:109-184` with a real DAG using `swarm-protocol.ts` (299 LOC currently unused). Enables actual parallel agent fanout + conditional edges. Wave 112.                                                                                                                     | 2-3 sessions             | Architectural. Closes the "multi-agent OS" marketing gap.                                                                 |
| M6     | **Vector-memory storage growth audit + LRU/TTL strategy.** Beyond per-user cap (H2), need a backstop retention policy for `agent_memories`. Tie into wave-105 retention if appropriate.                                                                                                                                                                              | 1 session                | Schema change + audit-log integration.                                                                                    |
| ~~M7~~ | ~~Trace cap in `claudeToolUse` internal trace + tool-result truncation~~ — **SHIPPED in wave 114.** `compactOldToolResults()` in ai.ts truncates tool_result blocks older than the most recent 2 turns to a 200-char prefix before each next API call (kills the quadratic token growth across the 10-iteration loop). 2 tests pin keep-recent-2/truncate-older semantics. | DONE | |
| M8     | **Performance benchmarks** — measure + publish actual P50/P99 latency, model-failover hit rate, kill-switch trip rate. Replace "trust us" with measured numbers in `/spec` or `/explorer`.                                                                                                                                                                           | 1 session                | Add metrics-collection module + a public dashboard.                                                                       |

### LOW — cleanup and polish that doesn't change behavior

| ID  | Item                                                                                                                                                                                                                                                                                    | Effort  | Notes                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------- |
| L1  | **6 transitive `next → postcss` vulns** from `npm audit`. No upstream patch yet. Watch for Next.js minor release.                                                                                                                                                                       | passive | Re-run `npm audit fix` quarterly. |
| ~~L2~~ | ~~`as NextRequest` cast in middleware~~ — **SHIPPED in wave 114.** `instanceof NextRequest` narrow; fails CLOSED (500) if the runtime ever hands something else, because falling through would skip the CSRF gate (invariant #3). | DONE | |
| ~~L3~~ | ~~Hardcoded `User-Agent: SovereignBot/1.0`~~ — **SHIPPED in wave 114.** `scraperUserAgent()` in outbound-fetch.ts, `SOVEREIGN_SCRAPER_UA` env override; competitor-scan, site-assassin, competitive-radar migrated. | DONE | |
| ~~L4~~ | ~~claudeToolUse `ctx.trace` not internally bounded~~ — **SHIPPED in wave 114.** Trace push capped at 50 entries in competitor-scan + site-assassin tool executors. | DONE | |
| ~~L5~~ | ~~Test coverage gaps in wave-111 memory hooks~~ — **SHIPPED in wave 114.** 4 cases added: (a) sync-throwing extractor → 200 + no store, (b) number/object extractor returns skipped, (c) pastContext threads into the quality-retry invocation, (d) verifier block (403) prevents the memory store. | DONE | |

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
| O8  | Enable **Dependency Graph** in GitHub repo Settings → Security analysis, then flip the `dependency-review` CI job back to blocking (remove `continue-on-error` — see comment in ci.yml). The action hard-errors without the setting. | Operator           |

---

## Future Wave Numbering (so the wave-by-wave discipline continues)

| Next wave | Scope                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ~~107.2~~ | ~~DNS-rebinding hardening at `outboundFetch` (H1)~~ — SHIPPED                                                                 |
| 107.5     | Bulk `fetch()` → `outboundFetch()` codemod (M1)                                                                               |
| ~~109.7~~ | ~~Brand-correct the 14 bespoke `/for-*` pages (M4) — page-by-page~~ — SHIPPED                                                 |
| 111.1     | Mass memory opt-in across remaining 119 agents (M3) — batched. **In progress:** 21 of 140 (~15%) opted in across batches 1-6. |
| ~~111.x~~ | ~~Per-user storeMemory write cap (H2)~~ — SHIPPED in wave 114                                                                 |
| 112       | DAG executor for playbooks (M5)                                                                                               |
| 113-117   | Flagship agent conversions: lead-blitz / closer / site-assassin / deep-think / content-machine / super-agent (M2)             |
| ~~118~~   | ~~claudeToolUse trace cap + tool-result summarisation (M7)~~ — SHIPPED in wave 114                                            |
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

---

## Decision log — non-obvious choices made this session

- **Refused Modules 1-9 from the "master blueprint" prompts.** Multiple security vulnerabilities (command injection, hardcoded fallback secrets, path traversal) + fictional infrastructure (OpenClaw, NeMo Retriever, Matrix homeserver) + Vercel-incompatible patterns. Real systems already implement the intent correctly.
- **Wave 109 SKIPPED `for-recruiting`** even though it had the standard signature. The 3-line h1 + longer hero blurb structure didn't fit cleanly into the shell.
- **Wave 110 chose `competitor-scan` as the first multi-step conversion** over lead-blitz/closer because of clear tool boundaries, headline marketing position, and zero dependencies on voice infra.
- **Wave 111 chose `leads` as the first memory opt-in** because the memory pattern (compound past lead signals on same niche) has obvious user value vs other agents.
- **DNS-rebinding fix scope decision in wave 110.1**: per-caller defense in `fetch_page` only (the only NEW SSRF surface wave 110 added) rather than promoting to `outboundFetch` itself. The architectural fix is deferred to wave 107.2.
- **Per-user memory write cap deferred twice** (wave 110 + wave 111 reviews). Real gap. Track as H2 above. Don't defer a third time.
- **Wave 114 regenerated the conformance-corpus keypair.** The original `public-key.pem` was never committed — the blanket `*.pem` gitignore silently swallowed it at corpus creation, so the cross-language suite could not run from a fresh clone. Ed25519 offers no key recovery from signatures and no tagged release exists, so the frozen-corpus guarantee was not yet in force. New committed `generate-fixtures.mjs` regenerates v2 fixtures + public key together (private halves discarded); inclusion-proof fixtures are key-independent and stayed byte-identical. From the FIRST tagged release onward the corpus is frozen for real.

---

## How to use this file

- Every new wave: update the wave log + decision log, move items from Active to ✓-done if completed.
- Every session start: read this file before planning. The summary table tells you % done; the prioritized backlog tells you what to pick.
- A new contributor: read this top-to-bottom in 10 minutes; you know exactly where the platform is.

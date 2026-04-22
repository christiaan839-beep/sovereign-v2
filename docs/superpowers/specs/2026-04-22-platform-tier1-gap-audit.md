# Platform Tier 1 Gap Audit — Landing v2 Companion

**Status:** Proposed — awaiting user review before implementation.
**Date:** 2026-04-22
**Branch:** `claude/wizardly-benz`
**Companion spec:** `docs/superpowers/specs/2026-04-22-landing-v2-design.md`
**Related:** `docs/superpowers/specs/2026-04-21-month-1-sprint.md` (absorbs W2–W4 tasks)

---

## 1. Executive Summary

We're closer to elite-tier than I initially assumed. An audit agent swept the codebase with file-level evidence. Here's the honest picture:

### Already elite — do not touch

| Area | Evidence |
|---|---|
| `/pricing` page | `src/app/pricing/page.tsx` (503 lines) — full 5-tier comparison, FAQ, 14-day refund, Stripe+Yoco payment failover, dev-time drift check against `plans.ts` |
| GDPR compliance | `src/app/api/_misc/data-export/route.ts` (Article 20), `src/app/api/account/route.ts` (Article 17), `src/app/dashboard/settings/export/page.tsx`, `src/lib/account-deletion.ts` — all wired with confirmation phrase |
| `/status` page | `src/app/status/page.tsx` (138 lines) — real `/api/health` pings every 30s, subscribe form, honest empty incident history |
| Audit trail UI | `/dashboard/audit-trail` — paginated, time-range filters, 11 action-type filters, real summary stats |
| ⌘K command palette | `CommandEgg` on landing + `CommandPalette` on dashboard — both live, fuzzy-searched |
| Changelog + Roadmap | `src/app/changelog/page.tsx` auto-parses `SESSION_LOG.md`; `/roadmap` has 15 hardcoded real items across 3 phases |
| `/world` + `/marketplace` | v2-aligned (dark + copper + editorial) |

### Thin but foundation exists — closeable

| Area | Evidence | Gap |
|---|---|---|
| `/agents/[slug]` detail pages | `src/app/agents/[slug]/page.tsx` (279 lines) — has metadata, JSON-LD, stats, related agents, install button | Missing: 3+ use cases, sample output, FAQ, Run-it-now demo, review bodies |
| Public API endpoints | Only `src/app/api/public/recent-runs/route.ts` exists under `/public/` | Landing v2 needs 5 more public endpoints |
| `/playground` | `src/app/playground/page.tsx` claims "3 free tries" via localStorage | Actually requires auth — endpoints return 401 for unauth'd users. Misleading. |
| Error recovery UX | Infrastructure is elite (`error-recovery.ts`, `retry.ts`, `self-heal.ts`, resume endpoint) | Zero customer-facing "run failed → refund → retry" UX |
| Webhook signing | `src/lib/webhook-dispatcher.ts` signs via HMAC-SHA256 when secret set | No retry on failure, no idempotency keys, in-memory registry (file comment: "production: DB table") |
| API docs | `src/app/developers/docs/page.tsx` static markdown-style docs | No live Try-it-now playground (playground route exists but auth-broken) |
| Playwright E2E | `playwright.config.ts` + `e2e/landing.spec.ts` (158 lines) | Covers landing/pricing/docs/signup/login/onboarding/terms/privacy — missing critical signup→run→pay flow |

### Claimed but not wired — credibility risk

| Area | Claimed Where | Actually Wired? |
|---|---|---|
| SAML SSO | `src/app/security/page.tsx:34`, `src/lib/plans.ts:165` (Enterprise tier feature), `docs/superpowers/specs/2026-04-21-3-month-roadmap.md:339` | No. No SAML connection setup, no organization middleware, no Clerk SAML provider config found. Clerk supports it — not configured. |
| Playground 3 free tries | `/playground` UI | No. Server returns 401. UI lies. |

### Missing entirely

| Area | Reason |
|---|---|
| `/cookies` page | GDPR requires an accessible cookie policy. Content lives nowhere. |
| Public Atlas edge data | Landing v2 Atlas graph needs A2E call edges — not currently exposed |
| Live demo endpoints | 4 endpoints (catalog, memory, router, verify) — required for landing v2 |

### Biggest single risk

**`/platform` page palette mismatch.** `src/app/platform/page.tsx` uses editorial cream `#F4EFE6` while the rest of the v2 surface (landing, `/world`, `/marketplace`) is dark `#030303`. Per CLAUDE.md this was an intentional developer-audience split. But when Landing v2's nav links to `/platform`, the jump feels like a different company. Decision required: convert or keep.

---

## 2. Tier 1 Gaps — Landing-Blockers

Ordered by blocking-severity (top = blocks landing v2 cutover; bottom = doesn't block but warranted by landing promises).

### T1-A — `/api/public/*` endpoints (5 new)

**Status:** missing
**Blocks landing sections:** 01 (Hero), 02 (Atlas), 03 (Memory), 04 (Router), 05 (Verify)
**Files to create:**

- `src/app/api/public/catalog/route.ts` — GET: returns `PublicAgent[]` from `listCatalog()` (already implemented in `src/lib/agent-catalog.ts`), cached `s-maxage=300`. Small wrapper on existing function.
- `src/app/api/public/atlas-edges/route.ts` — GET: returns `{ source, target, weight }[]` of A2E edges, derived from `agent-spawn.ts` call history (or hardcoded for initial pass).
- `src/app/api/public/memory-demo/route.ts` — GET: returns a real recent run from a dedicated public demo tenant, with recalled-context vector similarity scores. Anonymized.
- `src/app/api/public/router-demo/route.ts` — POST: runs a real routing pass on a preset prompt. Rate-limited 5/hour per IP. Returns classification + ranking + selection + latency.
- `src/app/api/public/verify-demo/route.ts` — POST: runs 5-layer verification pipeline on user input (max 500 chars). Rate-limited 5/hour per IP. Returns pass/fail per layer with reasons.

**Rate-limit rules** (to add in `src/lib/rate-limits.ts`):

```
{ pattern: /^\/api\/public\/catalog/, strategy: "per-ip", capacity: 120, window: "1m" },
{ pattern: /^\/api\/public\/atlas-edges/, strategy: "per-ip", capacity: 60, window: "1m" },
{ pattern: /^\/api\/public\/memory-demo/, strategy: "per-ip", capacity: 10, window: "1h" },
{ pattern: /^\/api\/public\/router-demo/, strategy: "per-ip", capacity: 5, window: "1h" },
{ pattern: /^\/api\/public\/verify-demo/, strategy: "per-ip", capacity: 5, window: "1h" },
```

**Tests:** unit tests per endpoint (happy path + rate limit + fallback).

**Effort:** 3 days (1 day catalog+edges, 2 days the three demo endpoints with real pipelines).

### T1-B — `/agents/[slug]` detail page thickening

**Status:** thin
**Blocks landing sections:** 01 (Hero dossier links here), 02 (Atlas nodes link here), 06 (Profiles link here)
**File to modify:** `src/app/agents/[slug]/page.tsx` (currently 279 lines → target ~500)

**Current state:** description, JSON-LD, stats, related agents, install button, tag list.

**Target state additions:**

1. **3+ real use cases.** Content comes from a new `agent_metadata.useCases` column (text[]) — seeded per agent. Use-case structure: `{ title, description, example_input, example_output }`.
2. **Sample output section.** Pulled from a real recent run (anonymized) via a helper `getSampleOutput(slug)`. Shows as a formatted quote or code block.
3. **FAQ section.** 3–5 Q&A per agent. Stored in `agent_metadata.faq` column (JSON). Seeded per flagship agent initially; progressive backfill for the rest.
4. **Run-it-now inline demo.** A button that triggers a demo run on a hardcoded input, shows streaming output below. Rate-limited 3/hour per IP.
5. **Reviews with bodies.** `agentReviews` table has rating but display missing body text. Show top-rated review body per agent.
6. **Related content.** Already exists — keep.

**Data migration:** Add `useCases`, `faq` columns to `agent_metadata` table via new Drizzle migration. Seed top 20 flagship agents at first; backfill remainder in Tier 3.

**Effort:** 4 days (1 day migration + seed for 20 flagship; 2 days UI rebuild; 1 day Run-it-now inline demo with rate limiting and fallback).

### T1-C — `/platform` palette decision + execution

**Status:** open question (see landing v2 spec §21)
**Blocks landing sections:** nav links break the v2 visual flow if palette differs.

**Options:**

- **Convert to dark.** Unifies the platform; landing → platform feels continuous. Effort: ~2 days (type + color pass; layout unchanged).
- **Keep cream as intentional split.** No work; document rationale on the page ("Developer-facing surface — different palette on purpose").

**Recommendation:** Convert. The landing v2 is the primary entry point for all audiences (operators + developers). A palette split one click away is discontinuity the user perceives as "two different companies."

**Effort:** 2 days if converting; 0 days if keeping (plus a "why different" caption on the page).

### T1-D — `/playground` auth fix OR removal

**Status:** thin — actively misleading
**Blocks landing credibility:** if landing v2 Hero says "Run a Free Agent" and the only no-signup path is a broken playground, the promise fails on click.

**Two paths:**

- **Fix:** Create `/api/public/run/[slug]/route.ts` with server-side rate limiting (3 runs per IP per 24h). Playground calls public endpoint. Works without auth. Effort: 1.5 days.
- **Remove:** Delete `/playground` entirely. Landing hero CTA routes to signup instead. Effort: 2 hours.

**Recommendation:** Fix. A working no-signup demo is the single highest-converting element on an agent-platform landing. Do not remove.

### T1-E — Customer-facing failed-run UX

**Status:** partial (infra elite, UX zero)
**Blocks landing:** landing v2 promises "every run guaranteed or the run doesn't count." If a run fails and user gets no refund / retry UI, the promise breaks at the first failure.

**Files to modify:**

- `src/app/dashboard/playbooks/runs/[id]/page.tsx` — add "Run failed" state with:
  - Human-readable failure reason (pulled from run's error log)
  - "Credits refunded — $X.XX returned to your balance" confirmation (actually refund via `releaseHold` if not already)
  - Retry button → calls existing resume endpoint
  - "Report this" link → prefilled support email
- `src/app/api/playbooks/runs/[id]/resume/route.ts` — already exists, no change needed
- `src/lib/credits.ts` — ensure refund path triggers on playbook-run failure (likely already does, verify and unit test)

**Effort:** 2 days.

### T1-F — `/cookies` page

**Status:** missing
**Blocks landing:** footer gap for GDPR compliance. Not strictly a link-target blocker (no explicit landing link yet) but required before cutover to have a complete footer.

**File to create:** `src/app/cookies/page.tsx` — cookie policy covering: essential cookies (Clerk session, CSRF), analytics (PostHog), preferences (theme). Opt-out instructions. No banner for v1 (essential-only by default); add banner in Tier 2 if we adopt analytics cookies requiring consent.

**Effort:** 0.5 day (content is standard, wording must be accurate to actual cookie usage).

### T1-G — Webhook signing improvements

**Status:** partial
**Blocks landing:** not directly — but enterprise customers (the $499 tier) will ask during eval.

**File to modify:** `src/lib/webhook-dispatcher.ts`

**Additions:**

1. Retry with exponential backoff (3 retries: 1m, 5m, 30m).
2. Idempotency keys in header (`X-Webhook-Id: uuid`).
3. Move registry from in-memory to DB-backed (new table `webhook_targets` + `webhook_deliveries`).
4. Delivery log endpoint `/api/webhooks/deliveries` for customers to inspect.

**Effort:** 3 days.

### T1-H — Sub-processor list visibility

**Status:** elite (exists inside `/dpa`), but not directly linked from footer
**Blocks landing:** footer link expected per v2 spec.

**File to modify:** landing v2 Footer component — add link to `/dpa#sub-processors` (anchor already inside the DPA page).

**Effort:** 5 minutes (trivial, ships with landing v2).

---

## 3. Tier 2 Gaps — World-Class Parity (2-Week Post-Cutover Window)

Close these within 2 weeks of landing v2 going live.

| # | Item | Status | Effort | Why |
|---|---|---|---|---|
| T2-1 | API docs live playground | partial | M (3d) | Stripe/Supabase/Resend standard. Every endpoint has inline Try-it-now with user's API key. |
| T2-2 | Mobile dashboard audit | thin | L (5d) | Individual dashboard pages desktop-first. Mobile is 2026's default; this is overdue. |
| T2-3 | SAML SSO wiring | thin (claimed, not built) | M (3d) | Enterprise tier ($499) claims it. Deals stall without. |
| T2-4 | E2E test for signup→run→pay | partial | M (2d) | Playwright exists but skips the critical conversion flow. |
| T2-5 | Dedicated `/api/public/run/[slug]` | missing | S (1.5d) | Needed for fixed playground (T1-D if we do the "fix" path — roll into Tier 2 if deferred). |
| T2-6 | Real-time cost/usage dashboard | missing | M (3d) | User sees token spend live per-agent. Stripe + Vercel both do this. |
| T2-7 | WCAG 2.2 AA audit + fixes | unknown | M (3d) | Landing v2 must pass. Dashboard follows. |
| T2-8 | Public creator profiles | missing | S (2d) | `agentReviews` + `agentMetadata.creatorHandle` data exists. Need `/creators/[handle]` page. |
| T2-9 | Agent reviews UI (show review bodies) | partial | S (1d) | Review bodies stored but not displayed on agent detail pages. |
| T2-10 | Execution audit — customer-facing polish | elite | S (1d) | Trail exists at `/dashboard/audit-trail`. Surface a compact summary per run (not just aggregate). |

---

## 4. Prioritized Close Order — What Gets Closed When

### Week 1 (landing v2 Week 1)

1. T1-A `/api/public/*` endpoints (3 days) — **landing blocker**
2. T1-B `/agents/[slug]` thickening (4 days) — **landing blocker**
3. T1-H Sub-processor footer link (5 min) — **ships with landing**

### Week 2 (landing v2 Week 2)

4. T1-C `/platform` palette conversion (2 days) — **landing visual continuity**
5. T1-D `/playground` fix via `/api/public/run/[slug]` (1.5 days) — **landing credibility**
6. T1-F `/cookies` page (0.5 day) — **landing footer completeness**

### Week 3 (landing v2 Week 3 + cutover)

7. T1-E Customer-facing failed-run UX (2 days) — **landing promise fidelity**
8. T1-G Webhook signing improvements (3 days) — **enterprise sale readiness**

### Weeks 4–5 (post-cutover Tier 2 wave)

9. T2-3 SAML SSO wiring
10. T2-4 E2E test for signup→pay
11. T2-7 WCAG 2.2 AA audit
12. T2-2 Mobile dashboard audit (starts; continues into week 5)

### Week 6 (Tier 2 completion)

13. T2-1 API docs playground
14. T2-6 Real-time cost/usage dashboard
15. T2-9 Agent reviews UI + T2-10 per-run audit summary
16. T2-8 Creator profiles

---

## 5. Timeline Mapping — Landing v2 + Gap Closure Unified

This is the full 6-week unified plan. Landing v2 + Tier 1 run in parallel within the same worktree.

| Week | Landing v2 | Tier 1 Gaps | Tier 2 Gaps |
|---|---|---|---|
| **W1** | Spec written + approved (Day 1); implementation plan (Day 2); Hero built (Days 3–5) | T1-A endpoints, T1-H footer link | — |
| **W2** | Atlas (Day 6), Live demos 03–05 (Days 7–9), Profiles (Day 10) | T1-B `/agents/[slug]`, T1-C `/platform` palette, T1-D `/playground` fix, T1-F `/cookies` | — |
| **W3** | Pricing+Founders (Day 11), CTA+Footer (Day 12), QA (Day 13), **cutover (Day 14)**, monitor (Day 15) | T1-E failed-run UX, T1-G webhook signing | — |
| **W4** | Post-cutover hotfix buffer | — | T2-3 SAML, T2-4 E2E signup→pay, T2-7 a11y audit |
| **W5** | — | — | T2-2 Mobile dashboard, T2-1 API playground |
| **W6** | — | — | T2-6 cost dashboard, T2-9/10/8 reviews + creator profiles |

**By end of W6:** landing v2 shipped, all Tier 1 gaps closed, all Tier 2 gaps closed. Tier 3 (multi-agent chain builder, i18n, light mode, community, etc.) begins W7 as a separate sprint.

---

## 6. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `/agents/[slug]` data migration breaks existing agent pages | Medium | Migration is additive (new columns nullable); existing pages keep working with null use-cases/FAQ fallbacks; gradual backfill |
| Public demo endpoints get abused / scraped | Medium | Strict IP rate limits (5/hour for expensive pipelines), server-side per-endpoint caps, monitoring alerts on spike |
| `/platform` palette conversion breaks internal state | Low | Layout unchanged — only colors + type sizes. Visual regression only. |
| `/playground` fix reveals security hole | Low | Server-side IP rate limit, content filter before execution, zero-cost models only for free tier |
| Customer-facing failed-run UX surfaces real errors poorly | Medium | All error messages run through a user-facing "humanizer" step (map internal error codes to plain-English explanations) |
| SAML wiring has Clerk config gotchas | High (T2 item) | Defer to T2 — not landing-critical. Allocate full 3 days. |
| Mobile dashboard audit uncovers 40+ issues | Medium (T2 item) | Scope to "usable on mobile" (not "optimized") for the first pass; iteration continues |

---

## 7. Definition of Done

### End of Week 3 (cutover):

- [ ] All 5 `/api/public/*` endpoints live, rate-limited, tested
- [ ] `/agents/[slug]` pages show use cases, sample output, FAQ, Run-it-now for top 20 flagship agents
- [ ] `/platform` palette decision resolved (convert or keep) and executed
- [ ] `/playground` either fixed (runs without signup via public endpoint) or removed
- [ ] `/cookies` page live
- [ ] Failed-run UX in `/dashboard/playbooks/runs/[id]` shows reason + refund + retry
- [ ] Webhook dispatcher has retry + idempotency keys + DB-backed registry
- [ ] Sub-processor link live in landing v2 footer
- [ ] Zero new Sentry error classes in 24h post-cutover

### End of Week 6 (Tier 2 complete):

- [ ] SAML SSO configurable and documented
- [ ] E2E test for signup → run → pay passes in CI
- [ ] WCAG 2.2 AA pass on landing + top 10 dashboard pages
- [ ] Mobile dashboard audit complete with priority issues shipped
- [ ] API docs have working Try-it-now playground
- [ ] `/dashboard/usage` shows real-time token/cost per agent
- [ ] `/creators/[handle]` pages live for agents with `creatorHandle`
- [ ] Review bodies display on agent detail pages
- [ ] Per-run audit summary surfaced in run detail view

---

## 8. Relationship to Month 1 Sprint

`docs/superpowers/specs/2026-04-21-month-1-sprint.md` had W2–W4 tasks pending. This gap audit **absorbs those tasks** into the Tier 1 + Tier 2 structure:

| Month 1 Sprint Task | Absorbed Into |
|---|---|
| W1 T6 Stripe sub-lifecycle audit | Already in progress — ships independently, not blocked by landing v2 |
| W1 T7 Full test-suite audit | Ships before cutover (Day 13 QA pass) |
| W2 Slop Hunt + Copy Pass | Absorbed into Section 06 Profiles copy + general v2 copy discipline |
| W2 Icon system consolidation | Tier 3 (deferred) |
| W2 Empty state pass | Partially addressed via landing fallbacks; remainder Tier 3 |
| W3 UX + Onboarding | Partially T1-B (Run-it-now) + T2-2 (mobile dashboard) |
| W3 First users | Separate go-to-market track, not engineering |
| W4 Hardening + Launch | Aligned with cutover (W3 of this plan) |

**Net effect:** the Month 1 Sprint plan is upgraded and reorganized, not replaced.

---

## 9. Sign-off Required Before Implementation

Before we write the implementation plan (via the writing-plans skill), user must confirm:

1. ✅ Approve this gap audit.
2. ✅ Approve the companion landing v2 design spec.
3. ✅ Resolve open questions in landing v2 spec §21 (palette decision, headline, character names, profile art, demo tenant).

Once all three are checked, writing-plans skill produces a day-by-day implementation plan covering all 6 weeks.

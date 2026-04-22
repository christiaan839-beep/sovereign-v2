# Month 1 — "Finish Everything" Sprint

**Mandate:** Finish the platform in 4 weeks. Reliable. No AI slop.
Elite-tier quality on every line.

**Principle:** One task at a time. Full quality gate between each.
Don't start task N+1 until task N is committed, tested, documented,
and lint-clean.

**Starting state:** 1587 tests, 11 session commits, 3 parallel tracks
merged, landing redesign shipped, ready-to-deploy but not deployed.

---

## Part I — Full Gap Inventory (from audit)

### 🔴 Critical (must close before deploy-day)

| # | Gap | Evidence from audit |
|---|---|---|
| 1 | **Rate limiting sparse** | 11 of 350 routes have rate limit. User-facing endpoints vulnerable to abuse. |
| 2 | **Account deletion missing** | Only team-member deletion exists. GDPR right-to-erasure failure. |
| 3 | **spawnAgent uses old primitive** | Documented TODO — uses `a2e.ts` instead of `credits.ts` holds. Nested billing doesn't surface properly. |
| 4 | **In-memory state at scale cliff** | Rate-limit counters, A2E spend map, browser-session store all in-memory. Multi-region fails. |
| 5 | **Legal docs thin** | Terms 67 lines, Privacy 161 lines. Not enterprise-ready, not GDPR-article-13-complete. |
| 6 | **75 env vars, none validated at startup** | Platform can boot with missing `CLERK_SECRET_KEY` and fail at first request. |
| 7 | **Pre-existing stale tests like the voice-session one** | Unknown how many others. Full test suite audit needed. |
| 8 | **Stripe sub-lifecycle gaps** | Multiple payment processors (Stripe+Yoco+PayFast+Paystack). Refund path + failed-payment retry not fully tested. |

### 🟠 High (slop + reliability polish)

| # | Gap | Evidence |
|---|---|---|
| 9 | **"AI-powered" slop across marketing surfaces** | Found in terms.tsx, docs.tsx, marketplace, platform page. Generic, replaceable copy. |
| 10 | **Agent descriptions may be repetitive** | 137 agents — probability they fall into templates is high. |
| 11 | **Non-dashboard pages not mobile-audited** | login, signup, world, portal — audit proxy flagged. |
| 12 | **Empty states inconsistent** | Track C fixed 3. How many other pages have a blank-data branch that's ugly or missing? |
| 13 | **Error messages generic** | Many catch blocks return "Something went wrong" — no user action, no support reference. |
| 14 | **10 TODO/FIXME markers** | Need triage — which are real bugs, which are notes, which are dead. |
| 15 | **Receipt page missing** (`/runs/[id]/receipt`) | M2 W8 item pulled into M1 per "finish everything." Enterprise trust artifact. |
| 16 | **Onboarding depth** | Signup → first-successful-run journey not walked through. Probably has friction. |
| 17 | **Accessibility WCAG 2.1 AA pass** | Never formally done. Focus rings, aria-labels, contrast, keyboard traps. |

### 🟡 Medium (polish + launch readiness)

| # | Gap | Evidence |
|---|---|---|
| 18 | **E2E tests** | Playwright configured but unknown coverage. Unit tests cover units; user journeys don't. |
| 19 | **Load test results** | Never run. Don't know where it breaks. |
| 20 | **Circuit breaker coverage** | `with-timeout.ts` + `agent-circuit-breaker.ts` exist. Coverage across external calls unknown. |
| 21 | **Secrets rotation plan** | CRON_SECRET, VOICE_SESSION_SECRET. No doc on how to rotate. |
| 22 | **Operational dashboard for founder** | `/admin/eval-health`, `/admin/cost` exist. Is there one view showing SYSTEM state? |
| 23 | **Alerting beyond Sentry** | Does the cron-didn't-run alerting work? Only noticed because we tested manually. |
| 24 | **Mobile drawer swipe-to-dismiss** | Today's ship-note TODO. Nice-to-have. |
| 25 | **Computer Use Phase 2** | Tasks 4-14 of the plan. Spec'd, not built. Mostly M2 — not blocking. |
| 26 | **Voice v2 per-sentence playback** | M2 W6 in the roadmap. Drops latency 40%. |

### 🟢 Low (stretch — nice if time)

| # | Gap |
|---|---|
| 27 | A2E spawn-tree UI visualization |
| 28 | Voice cloning (Chatterbox) |
| 29 | iOS/Android app |
| 30 | Reseller white-label mode |

---

## Part II — 4-Week Sequence (one task at a time)

### WEEK 1 — Reliability Foundation (7 tasks)

**Goal:** deploy-blockers closed. Platform can go to production without
embarrassment or legal liability.

| Day | Task | Est | Fixes gap |
|---|---|---|---|
| Mon-1 | **Migrate `spawnAgent` to credits.ts holds** | 45min | #3 |
| Mon-2 | **Env-var validator at startup** (`src/lib/env.ts` — Zod schema, fail-fast) | 1.5h | #6 |
| Tue-1 | **Rate-limit pass on all auth'd routes** (middleware-level) | 3h | #1 |
| Tue-2 | **Account deletion endpoint + UI** (/dashboard/settings/delete-account) | 2h | #2 |
| Wed | **Legal docs rewrite** (Terms → 400 lines, Privacy → 500 lines, GDPR Article 13 compliant) | 3h | #5 |
| Thu-1 | **Stripe sub-lifecycle audit** (refund path, failed payment retry, webhook idempotency) | 2h | #8 |
| Thu-2 | **Full test-suite audit** (find stale mocks like voice-session-route, fix all) | 1.5h | #7 |
| Fri | **DEPLOY** — Week-1 master runbook. Real production. | 90min | — |

**W1 total: 15 hours across 5 days. Shippable Friday.**

### WEEK 2 — Slop Hunt + Copy Pass (8 tasks)

**Goal:** zero AI-generic copy anywhere. Every line sounds like a human
wrote it for this specific product.

| Day | Task | Est | Fixes gap |
|---|---|---|---|
| Mon | **Slop audit across all pages** (grep pass + manual review, build a fix-list) | 2h | #9 |
| Tue | **Rewrite landing copy** (already redesigned — but is every line distinct?) | 2h | #9 |
| Wed-1 | **Rewrite 137 agent descriptions** — check for template-sounding repetition, rewrite weakest 20 | 3h | #10 |
| Wed-2 | **Meta descriptions + OG titles** — every page unique, keyword-stuffed ones rewritten | 1h | #9 |
| Thu-1 | **Error message polish** — every catch block returns a specific, actionable message | 2h | #13 |
| Thu-2 | **Empty-state sweep** — audit every page, not just dashboard, for blank-data branches | 2h | #12 |
| Fri-1 | **TODO/FIXME triage** — 10 markers, close or convert to tracked issues | 1h | #14 |
| Fri-2 | **Help page / FAQ content polish** — make every answer specific to us, not templated | 1h | #9 |

**W2 total: 14 hours. Qualitative. No new code — just better code.**

### WEEK 3 — UX + Onboarding Depth (7 tasks)

**Goal:** a brand-new user, from signup to first successful agent run,
has zero friction. Mobile works. Everything accessible.

| Day | Task | Est | Fixes gap |
|---|---|---|---|
| Mon-1 | **Receipt page** `/runs/[id]/receipt` + HMAC-signed public URL + OG preview | 3h | #15 |
| Mon-2 | **Onboarding walkthrough** — signup → first-run ceremony + "your first playbook" guide | 2h | #16 |
| Tue | **Mobile pass on non-dashboard pages** (login, signup, world, portal, marketplace detail) | 3h | #11 |
| Wed-1 | **Accessibility WCAG 2.1 AA pass** — automated via axe + manual keyboard traversal | 3h | #17 |
| Wed-2 | **Focus-ring + aria-label sweep** | 1h | #17 |
| Thu | **First 10 founder-program outreach emails drafted + sent** | 2h | — |
| Fri | **Founder-program dashboard + live-monitor admin view** (see all active sessions) | 3h | #22 |

**W3 total: 17 hours. First real users hit production.**

### WEEK 4 — Hardening + Launch (7 tasks)

**Goal:** Production has been live 1 week. Hardening pass catches whatever
real traffic surfaced. Then formal launch.

| Day | Task | Est | Fixes gap |
|---|---|---|---|
| Mon-1 | **Polish-from-signal** — fix top 3 user-reported friction points from W3 | 3h | — |
| Mon-2 | **E2E test suite** (Playwright) — signup → run → bill → receipt happy path | 3h | #18 |
| Tue | **Circuit breaker coverage extension** — every external-API call wrapped | 2h | #20 |
| Wed-1 | **Redis migration** — move in-memory rate limits + A2E spend cap to Upstash | 2h | #4 |
| Wed-2 | **Secrets rotation runbook** | 30min | #21 |
| Thu | **Load test + fix top 3 bottlenecks** | 3h | #19 |
| Fri | **Formal launch** — HN + product-hunt + founder tweet + retrospective | 3h | — |

**W4 total: 16.5 hours. Platform battle-tested and launched.**

---

## Part III — Non-negotiable quality gates (every task)

Before the "this is done" checkbox gets checked, all five must be green:

1. **Tests** — new test coverage for new logic. Full suite still passing.
2. **TypeScript** — `npx tsc --noEmit` zero errors.
3. **Lint** — `npx eslint <changed files>` zero errors.
4. **Slop scan** — no generic marketing phrases (I'll maintain a blocklist).
5. **Commit message** — atomic, descriptive, follows existing conventions.

---

## Part IV — "No AI slop" blocklist (grep fails build)

Add to a pre-commit hook. Any PR containing these strings blocks:

- `AI-powered` (too generic — say what it actually does)
- `revolutionize` / `revolutionary`
- `seamlessly`
- `cutting-edge` / `state-of-the-art`
- `in today's fast-paced world`
- `harness the power of`
- `unlock the potential`
- `game-changing` / `game changer`
- `leverage` (when used as a verb — "leverage AI" = slop)
- `world-class` (unless followed by specific evidence)
- `next-generation`
- `Lorem ipsum` (self-explanatory)
- `[insert X here]` (placeholder leak)

A script at `scripts/slop-check.mjs` will scan all `src/**/*.tsx` files
and exit 1 if any match. Wire into husky pre-commit.

---

## Part V — What I'm NOT building in M1

Explicit no-list so focus stays tight:

- Computer Use Phase 2 beyond what's shipped (Tasks 4-14 stay M2)
- Voice v2 per-sentence playback (M2)
- Mobile app / React Native (M3)
- Enterprise SSO (M3)
- Reseller white-label (M3)
- A2E spawn-tree UI visualization
- Voice cloning (Chatterbox)
- Any new agents beyond the 137 already shipped
- Any new pricing tier changes
- Any landing-page redesign beyond what's shipped

If any of these feel urgent mid-sprint, they go to backlog — not into M1.

---

## Part VI — Success definition (end of Month 1)

- ✅ Platform live in production for 3 weeks
- ✅ ≥ 10 paying founder-program users, each with ≥ 3 runs
- ✅ 0 critical bugs outstanding
- ✅ 0 TypeScript errors
- ✅ 0 lint errors
- ✅ 0 slop-check violations
- ✅ 1700+ tests (currently 1587 — add ~100 new)
- ✅ GDPR article 13 + CCPA compliant (legal docs + account deletion + data export)
- ✅ WCAG 2.1 AA accessibility pass
- ✅ E2E test coverage for the signup → run → receipt journey
- ✅ Load-tested to 100 concurrent users on the hottest endpoints

If 10 of 10 hit → M2 (Moat) starts on schedule.
If 8-9 of 10 hit → M2 starts; failing items pull into M2 W5.
If < 8 of 10 → stop and reassess. Probably means the gap-closing plan
was wrong, not that execution was slow.

---

## Part VII — Execution rule

**One task. Full quality gate. Commit. Move on.**

No "I'll come back to this." No "good enough for now." No parallel sprints.

The rhythm is: pick next task → open its files → write the code → run
the five gates → commit with an atomic message → check off the task →
pick the next one.

If I'm blocked, I say so immediately and we decide together. No
silent stalls.

---

## Start now

Task 1: **Migrate `spawnAgent` to credits.ts holds.** 45 min.

Beginning in the next message.

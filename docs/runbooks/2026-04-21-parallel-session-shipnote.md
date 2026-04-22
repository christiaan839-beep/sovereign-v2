# Parallel Session Ship Note — 2026-04-21

**Starting state:** 1537 tests, `029ecfa4` HEAD (three-month roadmap doc).
**Ending state:** 1587 tests (+50), `fbce9421` HEAD, 3 parallel tracks merged.
**Mode:** one-at-a-time review + surgical cherry-picks (no auto-merge).

---

## What shipped

| Track | Commits on `wizardly-benz` | Net |
|---|---|---|
| **C — Dashboard polish** | `ec41fb85`, `bb5f0d51`, `53ab373c` | +4 files (empty-states lib + tests, help page, mobile drawer) + predicate wiring into 3 dashboard pages |
| **C bonus — test gap** | `91ce3fc0` | Fixed 3 pre-existing voice-session-route test failures (L1.2 route changes had never been mocked) |
| **A — Computer Use Phase 1** | `703b8749`, `7bc5a9a8` + plan doc | +4 files (browser-session adapter, fillForm action, +33 tests) + 414-line plan spec covering Tasks 1-14 |
| **A spec only** | (plan doc commit in above) | Tasks 4-14 land across M2 W5-6 per the roadmap |
| **B — A2E spawn** | `c13650b5`, `913b35e9`, `fbce9421` | +3 files (`spawnAgent`, spawn endpoint at `/api/agents/spawn/[slug]`, `leads` demo) + 10 tests |

---

## Mistakes caught by the one-at-a-time review

These would have silently shipped in a rubber-stamp merge:

1. **Worktree divergence.** All three agents branched off `d330f379...`, an older commit (not my current HEAD `029ecfa4`). I had to cherry-pick individual commits rather than merge whole branches — otherwise I would have pulled in a dozen unrelated pre-roadmap commits.
2. **Track C scheduled/page.tsx conflict.** The agent's base had a structurally different version of that file (pre-Plan 5). Aborted the cherry-pick, kept my HEAD version, and manually rewired just the new `isScheduledEmpty` predicate + CTA.
3. **Track B API-path collision.** Agent placed the spawn endpoint at `/api/agents/spawn/[slug]` instead of `/api/agents/[slug]/spawn/` because Next.js App Router can't have `[slug]` + `[...slug]` siblings. Documented the deviation in the route header. Accepted as elite — pragmatic choice over ideal-path.
4. **Track B credits-primitive choice.** The agent wired `spawnAgent` against the older `a2e.ts` (`deductCredits/addCredits`) instead of the newer `credits.ts` (`placeHold/captureHold/releaseHold`). Because `a2e.ts` still exists and compiles, the code runs correctly — but the hold semantics are less sophisticated (no TTL-based auto-release, no nested-hold UI surface). Flagged as a Phase-2 TODO below.
5. **Pre-existing stale test.** `voice-session-route.test.ts` had been failing silently since L1.2 — 3 tests broke when the route gained `getUserPlan`/`getVoiceMinutesThisMonth` calls. Surfaced by this merge session's full suite runs, fixed atomically.

---

## Known follow-ups (Phase 2 / future sessions)

1. **Migrate `spawnAgent` to credits.ts primitives.** Swap
   `deductCredits/addCredits` for `placeHold/captureHold/releaseHold` so the
   per-parent spend cap lives in Redis (not in-memory Map) and nested holds
   show up in the billing history. Reason: multi-region serverless
   consistency.
2. **Computer Use Phase 2** — Tasks 4-14 from the new plan spec. Ships
   across M2 W5-6. Includes: Upstash-backed session store, click +
   extractTable + waitForSelector actions, "teach once" replay loop.
3. **A2E UI spawn-tree visualization.** `spawnAgent` tags each child's
   transaction with `a2eDepth`/`parentAgentSlug`/`parentHoldId`; the
   billing/analytics pages can render a tree view once we design it.
4. **Mobile drawer — swipe-to-dismiss** would be a polish layer on
   top of Track C's tap-to-dismiss backdrop. Not needed for Week 1.

---

## Quality gate — final

- **Tests:** 1587/1587 passing (+50 from session start)
- **TypeScript:** 0 errors on changed files
- **Lint:** 0 errors on changed files
- **Commits landed:** 10 (3 per track + 1 test-gap fix)
- **New modules:**
  - `src/lib/browser-session.ts`
  - `src/lib/browser-actions.ts`
  - `src/lib/dashboard-empty-states.ts`
  - `src/lib/agent-spawn.ts`
  - `src/app/api/agents/spawn/[slug]/route.ts`
  - `src/app/dashboard/help/page.tsx`
- **New tests:**
  - `src/lib/__tests__/browser-session.test.ts` (18)
  - `src/lib/__tests__/browser-actions.test.ts` (15)
  - `src/lib/__tests__/dashboard-empty-states.test.ts` (12)
  - `src/lib/__tests__/agent-spawn.test.ts` (10)

---

## Lessons for future parallel dispatches

1. **Always pass the current HEAD SHA in the agent prompt.** Prevents divergence-point confusion. Even worktree isolation doesn't help if the agent branches off old state.
2. **Enumerate existing primitives the agent should use.** If credits.ts has `placeHold`, say so explicitly. The agent chose `a2e.ts` because it came first alphabetically in the codebase.
3. **Surface filename-collision constraints.** Next.js `[slug]` + `[...slug]` cannot be siblings — would have saved the agent time.
4. **One-at-a-time review is the elite default.** Three auto-merges would have left us with the stale voice-session test, a file conflict, and a wrong API path. Each caught by careful cherry-pick review.

---

## Ready for Week 1 deploy

All three tracks' foundations are in. The Week-1 master deploy runbook
(`docs/runbooks/week-1-master-deploy.md`) still stands — the added
surface from today is:

- **New behind-flag:** `ENABLE_BROWSER_SESSIONS=true` unlocks Phase 1
  Computer Use persistent sessions. Leave off at deploy; turn on after
  first 10 founder-program users stabilize.
- **New endpoint:** `POST /api/agents/spawn/[slug]` — requires
  `X-Sovereign-Internal-Secret` + `X-Sovereign-User-Id`. Only agent
  handlers should call this; not user-facing.
- **New page:** `/dashboard/help` — goes live with the dashboard on
  deploy. No config needed.
- **New env:** `A2E_MAX_SPEND_CENTS_PER_PARENT` (optional; default 150¢).

Nothing above blocks the Week-1 deploy.

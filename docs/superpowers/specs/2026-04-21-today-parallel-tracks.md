# Today — Three Parallel Build Tracks

**Scope:** Ship foundations for the three highest-leverage items from
the post-redesign backlog, in parallel, using isolated agent worktrees.

**Baseline (end of previous session):** `claude/wizardly-benz` carries
~180 commits, 1537 tests passing, 0 TS errors. Lane 1 + Lane 2
(landing redesign) are both shipped. Week 1 deploy is pending user
hands.

---

## Why parallel

The three tracks touch different parts of the codebase:

| Track | Primary files | Mergeable with others? |
|---|---|---|
| A — Computer Use | `src/lib/browser-session*`, `src/app/api/agents/computer-use-persistent/**`, `docs/superpowers/plans/2026-04-21-computer-use-expansion.md` | Yes — no overlap |
| B — A2E spawn | `src/app/api/agents/[slug]/spawn/**`, `src/lib/agent-spawn.ts`, small additions to `credits.ts` + `agent-factory.ts` | Yes — small credits.ts touch |
| C — Dashboard polish | `src/app/dashboard/**/empty-state*`, `src/app/dashboard/help/page.tsx`, mobile-responsive CSS classes | Yes — dashboard subtree only |

Worktree isolation per agent → atomic branches → sequenced merge back
into `claude/wizardly-benz`.

---

## Track A — Computer Use Expansion

**Assigned to:** parallel agent with isolation=worktree
**Theme:** The biggest competitive moat. Persistent browser sessions
per user, typed actions, "teach once" replay.

**Deliverables (this session):**
- Full plan spec at `docs/superpowers/plans/2026-04-21-computer-use-expansion.md`.
  14+ tasks, TDD-formatted, ready for sequential execution.
- **Phase 1 only** of the plan shipped in code:
  - `src/lib/browser-session.ts` — adapter interface + Playwright
    implementation (primary) + Browserbase stub.
  - Session lifecycle: `startSession`, `resumeSession`, `endSession`.
  - At least one typed action: `fillForm` (with `name + value` pairs).
  - Tests.
- Leave remaining 13 tasks (typed action expansion, teach-once
  replay, persistent-agent endpoint) as spec only — they ship across
  M2 W5/6.

**Non-goals:**
- Do NOT set up Browserbase billing / real browser cloud — use local
  Playwright for Phase 1. Browserbase adapter is a stub that throws
  "not configured" unless env is set.
- Do NOT touch existing `/api/agents/computer-use` (the one-shot
  variant). New work goes under `computer-use-persistent`.

---

## Track B — A2E Spawn API

**Assigned to:** parallel agent with isolation=worktree
**Theme:** Agents hire agents. Required for the "A2E economy"
marketing claim to be literal truth.

**Deliverables (this session):**
- `src/app/api/agents/[slug]/spawn/route.ts` — POST endpoint,
  Clerk-required, validates parent-run relationship.
- `src/lib/agent-spawn.ts` — `spawnAgent(slug, inputs, { parentRunId })`
  helper callable from agent handlers. Returns the child's output.
- **Safety:** per-parent A2E hard cap (default $1.50, env-configurable).
  Recursion guard (max 3 levels deep).
- **Ledger attribution:** child's credit hold carries
  `extraMetadata.parentHoldId` + `parentAgentSlug` so the rollup can
  surface spawn trees in `/dashboard/runs/[id]`.
- Update ONE existing agent to demo the pattern: `lead-blitz` spawns
  `contact-enrichment` per prospect.
- Tests: unauth, parent-not-found, cap exceeded, recursion exceeded,
  happy path with nested ledger entries.

**Non-goals:**
- No UI changes this session. Spawn-tree visualization is a follow-up.
- No new credit primitives — reuse `placeHold` with `extraMetadata`.
  Nested semantics come for free via the parent/child links in metadata.

---

## Track C — Dashboard Polish

**Assigned to:** parallel agent with isolation=worktree
**Theme:** Pre-emptive "things users will ask about in Week 3."

**Deliverables (this session):**
- Empty-state polish for 3 pages:
  - `/dashboard/analytics` — when no runs exist, show "Run your first
    playbook to see data here" with CTA.
  - `/dashboard/scheduled` — when no schedules, show "Schedule a
    playbook to automate. Try: daily lead scan." with CTA.
  - `/dashboard/reports` — when no reports, show "Reports populate
    after your first 5 runs."
- New `/dashboard/help` page — lightweight FAQ + contact form pointing
  at founder email. 10 bullets: common errors, how to top up, how to
  invite team, what the 5-layer verification does.
- Mobile-responsive pass on `/dashboard/layout.tsx` — the sidebar
  collapses into a hamburger on <768px (currently breaks).
- Tests where trivially applicable.

**Non-goals:**
- No dashboard redesign. Just empty states + mobile + help page.
- No new content for the help page beyond the 10 bullets.

---

## Merge strategy

1. Wait for all 3 agents to complete (they run in parallel — total
   wall time = max of the three, not sum).
2. Merge order (riskiest last so we catch conflicts early):
   a. Track C first (isolated to `src/app/dashboard/**`).
   b. Track B next (touches `credits.ts` + `agent-factory.ts`).
   c. Track A last (new files mostly, low collision risk).
3. After each merge:
   - `npx tsc --noEmit`
   - `npx vitest run`
   - Resolve any conflict → commit the merge → move on.
4. Final: full quality gate + a summary commit noting all three
   tracks landed.

---

## Today — Definition of Done

- ✅ 3 parallel agent branches merged back to `claude/wizardly-benz`.
- ✅ Computer Use expansion plan spec committed (14+ tasks).
- ✅ Computer Use Phase 1 shipped (session lifecycle + fillForm + tests).
- ✅ A2E spawn endpoint + example chain live.
- ✅ 3 empty states + help page + mobile pass shipped.
- ✅ Tests: 1537 → 1537 + N new (N ≥ 15).
- ✅ TypeScript: 0 errors.
- ✅ Lint: 0 errors on new/changed files.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Agents collide on `credits.ts` or `agent-factory.ts` | Track B gets ownership; Track A + C don't touch them. |
| Playwright in the Vercel bundle — adds ~15MB | Gate the import behind `process.env.ENABLE_BROWSER_SESSIONS`. Never auto-loads. |
| A2E infinite recursion gets past the guard | Hard cap at 3 levels. Test this specifically. |
| One agent's branch is empty (no meaningful changes) | Worktree auto-cleans up — no-op is safe. |

---

## What I (the orchestrator) am doing while agents run

- Not writing code on the main branch (would cause merge collisions).
- Reviewing agent output as they stream back, ensuring each hits its
  scope.
- Preparing the merge commit messages + final quality-gate doc.

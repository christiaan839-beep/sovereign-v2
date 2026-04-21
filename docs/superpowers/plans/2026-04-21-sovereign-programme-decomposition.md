# Sovereign Programme — Plan Decomposition (April 2026)

> One programme, five independent plans. Each one ships working, testable
> software on its own. Each has its own `YYYY-MM-DD-<name>.md` plan file.
> This index tracks scope + sequencing.

## Dependency graph

```
Plan 1 (Revenue Engine) ──► Plan 2 (Sovereign World)
                       └──► Plan 3 (Voice Agent — pay-per-minute needs holds)

Plan 4 (Observability)  — independent, run anytime
Plan 5 (Scheduled)       — independent, run anytime
```

## The five plans

### Plan 1 — Revenue Engine
**File:** `2026-04-21-revenue-engine.md`
**Goal:** Wire credits through every billing surface so agent runs deduct credits, Stripe top-ups add credits, and users see their balance.
**Unlocks:** Usage-based tier, marketplace creator payouts, voice-minute billing.

### Plan 2 — Sovereign World
**File:** `2026-04-21-sovereign-world.md` (to be written)
**Goal:** Agent universe. Constellation `/world` page, marketplace upgrade, `/developers/submit` flow, `/agents/[slug]` SEO pages, `/leaderboard`.
**Data:** Four new tables (`agent_metadata`, `agent_installs`, `agent_reviews`, `agent_stats_daily`).
**Depends on:** Plan 1 (for paid-agent install flow).

### Plan 3 — Voice Agent
**File:** `2026-04-21-voice-agent.md` (to be written)
**Goal:** Real-time WebSocket voice loop with sub-1s perceived latency. Parakeet streaming ASR → NIM LLM → Magpie TTS with per-sentence streaming. VAD auto-turn, barge-in interruption, 5 personas.
**Depends on:** Plan 1 (for pay-per-minute billing).

### Plan 4 — Observability + Continuous Evals
**File:** `2026-04-21-observability-evals.md` (to be written)
**Goal:** Sentry DSN live, PostHog wired, golden-set evals run every 6h via cron with drift alerts, per-agent cost dashboard.
**Depends on:** nothing.

### Plan 5 — Recurring Playbooks
**File:** `2026-04-21-scheduled-playbooks.md` (to be written)
**Goal:** `scheduled_playbooks` table + cron-expression UI + dispatcher that enqueues runs at the right time. Leverages Plan 2.1's queue architecture.
**Depends on:** nothing (queue already exists from Phase 2.1).

## Suggested sequencing

- **This week:** Plan 1 + Plan 4 (both are enabling work; run in parallel)
- **Next week:** Plan 5 (quick win, compounds retention) + start Plan 2
- **Weeks 3-4:** Plan 2 (biggest feature) + Plan 3 (voice)

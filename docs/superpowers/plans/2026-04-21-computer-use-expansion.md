# Computer Use Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing one-shot `/api/agents/computer-use` endpoint into a full **persistent browser session** platform. Agents get a long-lived browser (minutes to hours, not a single request), run typed actions against it, and replay recorded flows via a "teach once" interface. This is the biggest competitive moat: Clay/Manus/Lindy can call a browser API but none of them let the user own the session and its learned artifacts.

**Architecture:**

```
 ┌──────────────────────────┐     ┌──────────────────────────────────┐
 │  Agent handler / UI      │ ──▶ │ /api/agents/computer-use-        │
 │  (spawns a typed action) │     │   persistent/* (Clerk-gated)     │
 └──────────────────────────┘     └────────────────┬─────────────────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  src/lib/browser-session.ts │
                                    │  (adapter layer)            │
                                    └──────────────┬──────────────┘
                        ┌──────────────┬───────────┼──────────────────┐
                        ▼              ▼           ▼                  ▼
                ┌───────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐
                │ playwright    │ │ browser  │ │ hyper    │ │ replay engine  │
                │ (local dev)   │ │  base    │ │ browser  │ │ (teach-once)   │
                │ primary       │ │ (stub)   │ │ (stub)   │ │ src/lib/...    │
                └───────────────┘ └──────────┘ └──────────┘ └────────────────┘
```

The three runtime backends are pin-compatible behind one interface. Phase 1 ships Playwright locally; Phase 2 wires Browserbase/Hyperbrowser with zero handler changes. The replay engine records a user's actions once, then agents execute the recording against the live DOM — Manus's best trick, brought inside our tenant boundary.

**Tech Stack:** Playwright 1.59 (dynamic import, flag-gated) · Browserbase + Hyperbrowser cloud adapters (stubs) · Upstash Redis for session affinity (Phase 2) · Zod for typed action validation · existing `createAgentRoute` factory + `credits.ts` hold/capture for per-minute metering.

**Depends on:** none directly. Per-minute billing (Task 10) reuses the same hold primitives the voice agent uses (Plan 1 — Revenue Engine).

**Non-goals:**
- Do NOT touch the existing `/api/agents/computer-use` one-shot endpoint. That Claude-native variant (bash + text_editor + screenshot tools) stays. The new routes live under `/api/agents/computer-use-persistent/*`.
- Do NOT bundle Playwright into the serverless build. Everything Playwright-flavoured is behind `process.env.ENABLE_BROWSER_SESSIONS === "true"`. When the flag is off (default on Vercel), `startSession` throws a clear error and Playwright is never imported.
- Do NOT set up Browserbase billing this plan. Adapter stubs throw `BROWSERBASE_API_KEY not set` so we can ship the interface contract without real cloud usage.

---

## File Structure

### Library (Phase 1 — Tasks 1-3)
- `src/lib/browser-session.ts` — adapter interface + in-memory session store + Playwright/Browserbase/Hyperbrowser backends
- `src/lib/browser-actions.ts` — typed action primitives (`fillForm` first; click/extract/wait come in Phase 2)

### Library (Phase 2 — Tasks 4-10)
- `src/lib/browser-session-store.ts` — Upstash-backed session registry (replaces in-memory map for multi-instance deploys)
- `src/lib/browser-replay.ts` — record/replay engine (teach-once)
- `src/lib/browser-billing.ts` — per-minute metering, tied into `credits.ts`
- `src/lib/browser-events.ts` — typed event log (every action persisted, useful for audit + replay)

### API routes (Phase 2 — Tasks 11-13)
- `src/app/api/agents/computer-use-persistent/start/route.ts` — POST, starts a session, returns sessionId + ttl
- `src/app/api/agents/computer-use-persistent/action/route.ts` — POST, runs a typed action against an existing session
- `src/app/api/agents/computer-use-persistent/end/route.ts` — POST, settles billing and tears down
- `src/app/api/agents/computer-use-persistent/health/route.ts` — GET, returns session status for liveness polling

### UI (Phase 2 — Task 14)
- `src/app/dashboard/computer-use/page.tsx` — live session list + teach-once recorder + replay button

### Tests
- `src/lib/__tests__/browser-session.test.ts` — Phase 1
- `src/lib/__tests__/browser-actions.test.ts` — Phase 1
- `src/lib/__tests__/browser-session-store.test.ts` — Phase 2
- `src/lib/__tests__/browser-replay.test.ts` — Phase 2
- `src/lib/__tests__/browser-billing.test.ts` — Phase 2
- `src/lib/__tests__/computer-use-persistent-routes.test.ts` — Phase 2

---

## Task 1: Adapter interface + Playwright backend + in-memory store

**Files:**
- Create: `src/lib/browser-session.ts`
- Test: `src/lib/__tests__/browser-session.test.ts`

The foundational layer. Defines `BrowserSessionAdapter` (pin-compatible across all backends), wires a Playwright implementation behind the feature flag, and stubs Browserbase + Hyperbrowser so future tasks swap them in without refactoring.

**Interface (exported):**
```ts
export interface BrowserSessionAdapter {
  startSession(opts: StartOpts): Promise<string>;       // returns sessionId
  resumeSession(sessionId: string): Promise<BrowserContext>;
  endSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): SessionMeta | null;    // for health checks
}

export interface StartOpts {
  userId: string;
  ttlMs?: number;                                       // default 10 minutes
  backend?: "playwright" | "browserbase" | "hyperbrowser";
}
```

**Design choices (documented in the file header):**
- In-memory Map keyed by sessionId. Works only in single-instance deploys — Vercel/Railway single region is fine; the Upstash-backed store lands in Phase 2 (Task 4).
- TTL cleanup uses `setTimeout` on session start. On resume, the timer is reset (sliding TTL).
- Playwright is loaded via `await import("playwright")` inside a `try/catch`. If the package isn't installed (e.g. Vercel), the catch throws a helpful message instead of a cryptic `MODULE_NOT_FOUND`.
- The `ENABLE_BROWSER_SESSIONS` env flag gates everything: if unset or not `"true"`, `startSession` throws before any dynamic import runs. This keeps cold starts fast on production where the flag is off.

- [ ] **Step 1: Failing tests**
  - `startSession` throws when `ENABLE_BROWSER_SESSIONS !== "true"`
  - `startSession` returns a non-empty sessionId when flag is on
  - `getSession` returns `null` for unknown id
  - `getSession` returns metadata (`userId`, `createdAt`, `ttlMs`, `backend`) for a real id
  - `endSession` is idempotent (calling twice is safe; returns without throwing)
  - TTL cleanup: after `ttlMs + 10ms` the session is auto-removed (`getSession` → null)
  - `resumeSession` throws for expired/unknown id with a recognizable error message
  - Browserbase adapter throws `BROWSERBASE_API_KEY not set` when selected without env
  - Hyperbrowser adapter throws `HYPERBROWSER_API_KEY not set` when selected without env

- [ ] **Step 2: Run — FAIL** (file not yet created)

- [ ] **Step 3: Implement**

Export the interface, a module-level `Map<string, SessionMeta>`, a `randomUUID`-based id generator, and three backend factories. Playwright's `chromium.launch({ headless: true })` runs inside a try/catch with a dynamic import. Mock-friendly: never do side effects at import time.

Session meta shape (persisted in the Map):
```ts
interface SessionMeta {
  sessionId: string;
  userId: string;
  backend: "playwright" | "browserbase" | "hyperbrowser";
  createdAt: number;
  expiresAt: number;
  ttlMs: number;
  _handle?: unknown;      // backend-specific; opaque to callers
  _cleanupTimer?: NodeJS.Timeout;
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — `feat(browser): browser-session adapter + playwright backend (Track A)`

---

## Task 2: fillForm typed action + action-registry skeleton

**Files:**
- Create: `src/lib/browser-actions.ts`
- Test: `src/lib/__tests__/browser-actions.test.ts`

Typed actions are how agent code interacts with a session. Each action validates its inputs with Zod, calls the backend-agnostic page API (Playwright and Browserbase both expose a Playwright-flavoured `page.fill(selector, value)`), and returns a structured result. Phase 1 ships only `fillForm` but the scaffold must accept click/extractTable/waitForSelector without refactoring.

**Design choices:**
- Actions never import `playwright` directly. They accept a `BrowserContext`-shaped object (resolved via `resumeSession`) so the same call works against Browserbase/Hyperbrowser.
- `fillForm(session, fields)` takes an array of `{ selector, value }` pairs. Validation rejects empty selectors, non-string values, and empty arrays. The page is asked to fill each field in order — we do not parallelize to keep the DOM state deterministic.
- Future actions follow the same pattern: a Zod schema for inputs, a pure function, a typed return.

- [ ] **Step 1: Failing tests**
  - `fillForm` validates `fields` is a non-empty array → throws on `[]`
  - rejects fields with empty selector strings
  - rejects fields whose value is not a string
  - calls `page.fill(selector, value)` in the given order (verified via mock call order)
  - returns `{ success: true, filled: <count> }` on happy path
  - returns `{ success: false, error: <msg>, filled: <count> }` when `page.fill` throws partway — reports how many fields completed before the failure

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Create a Zod schema `FillFormInput`, the `fillForm` function, and a typed `BrowserAction<In, Out>` helper that later actions will reuse. Export an `ACTION_REGISTRY` object mapping action names to their functions — placeholder for the Phase-2 action router.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — `feat(browser): browser-actions — fillForm + tests (Track A)`

---

## Task 3: Phase 1 verification pass

**Files:**
- None — this is a quality-gate task.

Run the full gate on new files before declaring Phase 1 done:

- [ ] `npx tsc --noEmit` — 0 errors across the repo
- [ ] `npx eslint src/lib/browser-session.ts src/lib/browser-actions.ts src/lib/__tests__/browser-session.test.ts src/lib/__tests__/browser-actions.test.ts` — 0 errors
- [ ] `npx vitest run src/lib/__tests__/browser-session.test.ts src/lib/__tests__/browser-actions.test.ts` — all pass
- [ ] Manual smoke: set `ENABLE_BROWSER_SESSIONS=true`, call `startSession` from a node REPL, call `getSession` — verify TTL fires at the configured ms.

Commit the fixes (if any) as `chore(browser): phase-1 quality gate fixes`.

---

## Task 4: Upstash-backed session store

**Files:**
- Create: `src/lib/browser-session-store.ts`
- Test: `src/lib/__tests__/browser-session-store.test.ts`

Replaces the in-memory Map with Upstash Redis so sessions survive cold starts and scale horizontally. The adapter's `getSession`/`setSession`/`deleteSession` delegate to this store when `UPSTASH_REDIS_REST_URL` is set; otherwise they fall back to the in-memory path from Task 1.

**Design choices:**
- Key schema: `bsession:{sessionId}` with the serialized SessionMeta (minus the live `_handle`, which is per-instance).
- Sliding TTL via `SET ... EX ttlSec`. No separate cleanup timer — Redis handles expiry.
- Session affinity: the store records which runtime instance owns the live browser handle (`instanceId`). A second instance resuming the session gets routed back to the owner via a short-lived affinity key (`bsession:affinity:{sessionId}`).

- [ ] Failing tests: set/get roundtrip, TTL expiry, affinity routing, graceful no-Upstash fallback.
- [ ] Implement, wire into `browser-session.ts` via a thin `StoreBackend` strategy.
- [ ] Commit — `feat(browser): upstash session store + affinity (Track A phase 2)`

---

## Task 5: Click + waitForSelector + extractTable actions

**Files:**
- Modify: `src/lib/browser-actions.ts`
- Test: `src/lib/__tests__/browser-actions.test.ts` (append)

Three more typed actions in the same pattern as `fillForm`:
- `click(session, { selector, timeout? })` — returns `{ success, clicked: boolean }`
- `waitForSelector(session, { selector, timeoutMs?, state? })` — state = `attached` | `visible` | `hidden`; default `visible`
- `extractTable(session, { selector })` — returns `{ headers: string[], rows: string[][] }`, parses any `<table>` or CSS-grid-like container via `page.$$eval`

**Each action:**
- [ ] Failing test (selector validation, happy path, failure path)
- [ ] Implement
- [ ] Register in `ACTION_REGISTRY`
- [ ] Commit per action — `feat(browser): click action (Track A phase 2)`, etc.

---

## Task 6: Typed event log

**Files:**
- Create: `src/lib/browser-events.ts`
- Test: `src/lib/__tests__/browser-events.test.ts`

Every action a session executes emits a `BrowserEvent` — append-only, queryable, durable via the same Upstash store. Later this feeds the teach-once replay engine (Task 7) and the audit log.

Event shape:
```ts
interface BrowserEvent {
  sessionId: string;
  userId: string;
  ts: number;
  action: string;                  // e.g. "fillForm"
  input: unknown;                  // validated payload
  output: unknown;                 // action return value
  durationMs: number;
}
```

- [ ] Failing tests: append, list-by-session, TTL, tenancy guard (a user can't list another user's session events).
- [ ] Implement, hook into `browser-actions.ts` so every registered action auto-logs.
- [ ] Commit — `feat(browser): typed event log per session (Track A phase 2)`

---

## Task 7: Teach-once replay engine

**Files:**
- Create: `src/lib/browser-replay.ts`
- Test: `src/lib/__tests__/browser-replay.test.ts`

Users hit "record" in the dashboard, click through a workflow once, then hit "stop." The replay engine serializes those events into a named **Flow**, which agents can run verbatim against a fresh session. This is the "teach once" feature.

**Key primitives:**
- `startRecording(sessionId)` — opens a recording window; subsequent events are tagged with a `recordingId`
- `stopRecording(sessionId)` → `Flow` — snapshots the event sequence, strips ephemeral data (timestamps collapse to relative), persists to DB
- `replayFlow(flow, sessionId, vars?)` — re-executes each step, substituting placeholder values from `vars` (e.g. `{url: "https://..."}` gets injected into a `fillForm`)

**Design choices:**
- Flows are addressable (`flow_abc123`), shareable within a tenant, and executable by any agent.
- Replay is best-effort with retries: if a selector drifts, the engine tries the next event; if three consecutive steps fail, it aborts and reports the failing step so the user can re-record.
- Flows are versioned — re-recording creates v2, v3, etc. Agents can pin to a version or float to latest.

- [ ] Failing tests: record→stop produces ordered event list; replay injects vars; replay halts on drift; pinning works.
- [ ] Implement.
- [ ] Commit — `feat(browser): teach-once flow recording + replay (Track A phase 2)`

---

## Task 8: Browserbase backend — real implementation

**Files:**
- Modify: `src/lib/browser-session.ts`
- Test: `src/lib/__tests__/browser-session.test.ts` (append integration tests, still mocking the HTTP layer)

Promotes the Browserbase stub to a real adapter. Hits `api.browserbase.com/v1/sessions` to start, returns a `BrowserContext` connected via CDP.

- [ ] Failing tests: env-gated start, CDP connection mocked, session list round-trips, error surfacing on 4xx/5xx.
- [ ] Implement, keep the stub path in place when env is missing.
- [ ] Commit — `feat(browser): browserbase backend (Track A phase 2)`

Same pattern for **Hyperbrowser** as a follow-up commit — same test shape, different endpoint.

---

## Task 9: Per-minute billing

**Files:**
- Create: `src/lib/browser-billing.ts`
- Test: `src/lib/__tests__/browser-billing.test.ts`

Each session start places a credit hold (`estimatedMinutes * 25¢` for local/Browserbase, tiered by backend). On `endSession`, compute actual elapsed minutes, capture the correct amount, release the rest. Matches the `voice-billing.ts` pattern so the math is easy to audit.

Pricing tiers (initial):
- `playwright` (local): 10¢/minute (compute only)
- `browserbase`: 30¢/minute (cloud browser + residential proxy)
- `hyperbrowser`: 25¢/minute (cloud browser)

Free tier: 5 minutes/month. Growth+: metered.

- [ ] Failing tests: hold placement, capture on normal close, release on error, tier selection.
- [ ] Implement.
- [ ] Commit — `feat(browser): per-minute billing across backends (Track A phase 2)`

---

## Task 10: HITL approval gate for risky actions

**Files:**
- Modify: `src/lib/browser-actions.ts`, reuse `src/lib/hitl-approval.ts`
- Test: `src/lib/__tests__/browser-actions.test.ts` (append)

Any action that could commit a side effect off-platform (submit forms on third-party sites, press a "Buy" button, confirm a delete) runs through `requestApproval` first when the session's trust level is below `autonomous`. Follows the existing HITL pattern the rest of the platform uses.

Actions flagged by default: `fillForm` on URLs matching a configurable pattern (`*/checkout`, `*/confirm`, `*/pay`), `click` on buttons whose text matches a safety regex.

- [ ] Failing tests: flag triggers, approval blocks execution, denial returns a structured error, approved runs proceed.
- [ ] Implement as a wrapper around every ACTION_REGISTRY call.
- [ ] Commit — `feat(browser): HITL approval for risky actions (Track A phase 2)`

---

## Task 11: POST /api/agents/computer-use-persistent/start

**Files:**
- Create: `src/app/api/agents/computer-use-persistent/start/route.ts`
- Test: `src/lib/__tests__/computer-use-persistent-routes.test.ts`

POST endpoint, Clerk-required, validates body `{ backend?, ttlMs? }`, calls `startSession`, returns `{ sessionId, expiresAt }`. Uses `createAgentRoute` so tenant + billing are handled consistently.

- [ ] Failing tests: unauth → 401, invalid backend → 400, happy path returns sessionId, rate-limit enforcement.
- [ ] Implement.
- [ ] Commit — `feat(browser): start session endpoint (Track A phase 2)`

---

## Task 12: POST /api/agents/computer-use-persistent/action

**Files:**
- Create: `src/app/api/agents/computer-use-persistent/action/route.ts`
- Test: `src/lib/__tests__/computer-use-persistent-routes.test.ts` (append)

Routes `{ sessionId, action, input }` through the ACTION_REGISTRY. Clerk-gated, verifies `sessionId` belongs to the authed user, logs to `browser-events`, returns the action's return value.

- [ ] Failing tests: unauth, cross-tenant session access (IDOR guard), unknown action, invalid input, happy path.
- [ ] Implement.
- [ ] Commit — `feat(browser): typed action endpoint (Track A phase 2)`

---

## Task 13: POST /api/agents/computer-use-persistent/end + GET /health

**Files:**
- Create: `src/app/api/agents/computer-use-persistent/end/route.ts`
- Create: `src/app/api/agents/computer-use-persistent/health/route.ts`
- Test: same file as Task 12

- [ ] Failing tests: end settles billing, health returns `{ alive, expiresAt, actionCount }`, cross-tenant 403.
- [ ] Implement.
- [ ] Commit — `feat(browser): end + health endpoints (Track A phase 2)`

---

## Task 14: Dashboard UI — live sessions + teach-once recorder

**Files:**
- Create: `src/app/dashboard/computer-use/page.tsx`
- Create: `src/components/browser/SessionList.tsx`, `RecorderControls.tsx`, `FlowLibrary.tsx`

Glassmorphism dark theme per CLAUDE.md conventions. Three panels:
1. **Live sessions** — list + end button
2. **Recorder** — start/stop, name your flow
3. **Flows** — saved flows with run/edit/share/delete

Animated with `framer-motion` enter/exit states.

- [ ] Wire each panel to its route.
- [ ] Real-time updates via polling `/health` every 2s when a session is live.
- [ ] Commit — `feat(browser): computer-use dashboard page (Track A phase 2)`

---

## Quality Gate

- [ ] `startSession` throws when `ENABLE_BROWSER_SESSIONS` is off (no Playwright import)
- [ ] Three backends interchangeable via `backend` option — same test suite passes for each
- [ ] TTL cleanup verified (in-memory + Upstash)
- [ ] `fillForm` + `click` + `waitForSelector` + `extractTable` typed + Zod-validated
- [ ] Event log captures every action with timing
- [ ] Teach-once replay: record → stop → replay with vars works end-to-end
- [ ] Per-minute billing integrates with existing `credits.ts`
- [ ] HITL approval fires on risky actions below trust threshold
- [ ] All four routes Clerk-gated and tenant-scoped
- [ ] Dashboard page shows live sessions + lets users record/replay
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all new tests pass (≥ 40 new tests across phases 1 + 2)
- [ ] `npx eslint` — 0 errors on all new files

---

## Open Questions

- **Vercel vs Railway deployment.** Playwright binaries are ~150MB and Vercel's 250MB function size cap is tight. Option A: deploy the persistent endpoints to a Railway service with a dedicated Playwright image; option B: Browserbase-only in production (Vercel) with Playwright for local dev. Recommendation: ship Browserbase as the production default once Task 8 lands; Playwright stays for local development and self-hosted users.
- **Session concurrency caps.** How many concurrent browsers per user? Per tenant? Probably tier-gated (free = 0, Growth = 1, Node = 5, Enterprise = 25). Decide during Task 11.
- **Flow sharing across tenants.** Should flows be marketplace items? Could be a revenue line — "download a pre-built LinkedIn prospecting flow for $2." Out of scope for this plan; bookmark for a follow-up.
- **Browserbase vs Hyperbrowser ordering.** Browserbase has better developer UX; Hyperbrowser is cheaper and has stealth mode built in. Ship both adapters; let the caller choose via `backend`. Default ordering: Hyperbrowser → Browserbase → Playwright (fallback chain).
- **Replay drift heuristics.** Selectors drift fast in modern SPAs. Is three-strike abort correct, or should we retry with a semantic fallback (e.g. ask an LLM "click the button that says Submit" when the original CSS selector fails)? The semantic fallback is the long-term answer — prototype in a separate plan.

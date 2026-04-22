/**
 * SOVEREIGN MATRIX — Persistent Browser Session Adapter
 *
 * Phase 1 of the Computer Use Expansion plan
 * (docs/superpowers/plans/2026-04-21-computer-use-expansion.md).
 *
 * This module is the single seam through which the rest of the platform
 * talks to a long-lived headless browser. Three backends sit behind one
 * pin-compatible interface:
 *
 *   • playwright    — local default; dynamic import, gated behind the
 *                     ENABLE_BROWSER_SESSIONS env flag so Playwright is
 *                     NEVER loaded on Vercel cold starts.
 *   • browserbase   — cloud stub. Throws if BROWSERBASE_API_KEY is unset.
 *                     Becomes a real adapter in Phase 2 (Task 8).
 *   • hyperbrowser  — cloud stub. Same pattern as Browserbase.
 *
 * ── Design choices ──
 *
 * 1. **In-memory session store, keyed by sessionId.**
 *    This works cleanly on single-instance deploys (Railway, local dev,
 *    Vercel when sticky per-region). Multi-instance production needs an
 *    Upstash-backed store — that's Phase 2 / Task 4. The tradeoff is
 *    documented here so reviewers can verify the scope boundary.
 *
 * 2. **Dynamic playwright import inside try/catch.**
 *    We can't statically `import "playwright"` because the package is a
 *    devDependency (~150MB with browser binaries) that may not exist in
 *    the runtime image. The try/catch translates a bare MODULE_NOT_FOUND
 *    into a user-friendly "playwright not installed" message.
 *
 * 3. **ENABLE_BROWSER_SESSIONS flag is checked FIRST.**
 *    Before any dynamic import, before touching the session map, we
 *    reject cleanly if the flag is not literally "true". Keeps cold
 *    starts fast in production (flag off → never reach the dynamic
 *    import; bundler has no reason to bring Playwright in).
 *
 * 4. **TTL cleanup via setTimeout.**
 *    Simple, per-session timer. Fires once at `expiresAt`, closes the
 *    backend handle, removes the map entry. Sliding TTL (reset on
 *    resume) is intentionally not in Phase 1 — will ship with the
 *    Upstash store so it's consistent across backends.
 *
 * 5. **Adapter shape mirrors Playwright's BrowserContext.**
 *    Because Browserbase and Hyperbrowser both expose Playwright-
 *    compatible APIs over CDP, keeping the shape identical means
 *    browser-actions.ts never branches on backend — it just calls
 *    `page.fill(selector, value)` and trusts the adapter.
 */

/**
 * The three backends. Exported so callers (and tests) can narrow.
 */
export type BrowserBackend = "playwright" | "browserbase" | "hyperbrowser";

const ALLOWED_BACKENDS: readonly BrowserBackend[] = [
  "playwright",
  "browserbase",
  "hyperbrowser",
];

export interface StartOpts {
  userId: string;
  /** Session time-to-live in ms. Default: 10 minutes. */
  ttlMs?: number;
  /** Which backend to use. Default: "playwright". */
  backend?: BrowserBackend;
}

/**
 * Metadata we keep about each live session. `_handle` is backend-specific
 * and opaque to callers — never serialize it across processes. `_timer`
 * is the TTL cleanup handle so we can clear it on explicit endSession.
 */
export interface SessionMeta {
  sessionId: string;
  userId: string;
  backend: BrowserBackend;
  createdAt: number;
  expiresAt: number;
  ttlMs: number;
  _handle?: unknown;
  _timer?: ReturnType<typeof setTimeout>;
}

/**
 * The pin-compatible interface every backend fulfils. We don't use a
 * class per backend to keep the surface small; module functions branch
 * on `backend` and call the matching helper below.
 */
export interface BrowserSessionAdapter {
  startSession(opts: StartOpts): Promise<string>;
  resumeSession(sessionId: string): Promise<BrowserContextLike>;
  endSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): SessionMeta | null;
}

/**
 * Minimal shape we need from a BrowserContext. Matches Playwright's
 * BrowserContext well enough that Browserbase's CDP-connected context
 * slots in without a shim. Intentionally narrow — we only expose what
 * typed actions actually use.
 */
export interface BrowserContextLike {
  newPage: () => Promise<PageLike>;
  close?: () => Promise<void>;
}

export interface PageLike {
  fill: (selector: string, value: string) => Promise<void>;
  click?: (selector: string, opts?: { timeout?: number }) => Promise<void>;
  waitForSelector?: (
    selector: string,
    opts?: { timeout?: number; state?: "attached" | "visible" | "hidden" },
  ) => Promise<unknown>;
  close?: () => Promise<void>;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

// ── The in-memory session store ─────────────────────────────────────────
// Educational note: we use a module-scoped Map so that every call site in
// the same Node process sees the same sessions. This is fine for a single
// instance. In multi-instance deploys the Map is per-replica, which breaks
// affinity — Phase 2 introduces an Upstash-backed store that keeps a
// pointer to which replica owns the live handle.
const sessions = new Map<string, SessionMeta>();

function newSessionId(): string {
  // Avoid pulling in node:crypto conditionally — randomUUID is on globalThis
  // in all supported Node versions (>=18). Cheap & predictable.
  return `sess_${globalThis.crypto.randomUUID()}`;
}

function assertFlagOn(): void {
  if (process.env.ENABLE_BROWSER_SESSIONS !== "true") {
    throw new Error(
      "Browser sessions are disabled. Set ENABLE_BROWSER_SESSIONS=true to enable. " +
        "This flag keeps Playwright (~150MB) out of the production bundle by default.",
    );
  }
}

function assertKnownBackend(backend: BrowserBackend): void {
  if (!ALLOWED_BACKENDS.includes(backend)) {
    throw new Error(
      `Unknown backend "${backend}". Allowed: ${ALLOWED_BACKENDS.join(", ")}.`,
    );
  }
}

/**
 * Dynamic import of playwright. If the package isn't installed we rethrow
 * with a more useful message than MODULE_NOT_FOUND.
 */
async function loadPlaywright(): Promise<{
  chromium: { launch: (opts?: { headless?: boolean }) => Promise<unknown> };
}> {
  try {
    // Educational note: the bare string "playwright" is intentional — both
    // to defer bundling until runtime AND to let Node's resolver report a
    // clean MODULE_NOT_FOUND when the package is absent (which we then
    // translate below). If types aren't installed either, the `as` cast
    // below bridges the shape without an @ts-ignore.
    const modulePath = "playwright";
    const mod: unknown = await import(modulePath);
    return mod as {
      chromium: {
        launch: (opts?: { headless?: boolean }) => Promise<unknown>;
      };
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `playwright package not installed or failed to load. ${detail}. ` +
        "Install with `npm install playwright` or switch to backend='browserbase' / 'hyperbrowser'.",
    );
  }
}

async function startPlaywrightSession(sessionId: string): Promise<unknown> {
  const pw = await loadPlaywright();
  const browser = (await pw.chromium.launch({ headless: true })) as {
    newContext: () => Promise<BrowserContextLike>;
    close: () => Promise<void>;
  };
  // We keep the browser handle (not the context) because closing the browser
  // also closes every context and page. One session = one browser = one
  // context in Phase 1. If we ever multiplex contexts per session, move the
  // context handle in here too.
  return { browser, _sessionId: sessionId };
}

async function closePlaywrightSession(handle: unknown): Promise<void> {
  const h = handle as { browser?: { close?: () => Promise<void> } };
  if (h?.browser?.close) {
    try {
      await h.browser.close();
    } catch {
      // Closing an already-closed browser is a no-op at best, a noisy error
      // at worst. Swallow — the caller just wants the session gone.
    }
  }
}

async function startBrowserbaseSession(_opts: StartOpts): Promise<unknown> {
  if (!process.env.BROWSERBASE_API_KEY) {
    throw new Error(
      "BROWSERBASE_API_KEY not set. Add the key to your environment or " +
        "use backend='playwright' (local) / backend='hyperbrowser'.",
    );
  }
  // Phase 2 (Task 8) wires the real fetch to api.browserbase.com/v1/sessions.
  throw new Error(
    "Browserbase backend is a Phase-1 stub. Real implementation lands in Phase 2 " +
      "(see docs/superpowers/plans/2026-04-21-computer-use-expansion.md Task 8).",
  );
}

async function startHyperbrowserSession(_opts: StartOpts): Promise<unknown> {
  if (!process.env.HYPERBROWSER_API_KEY) {
    throw new Error(
      "HYPERBROWSER_API_KEY not set. Add the key to your environment or " +
        "use backend='playwright' (local) / backend='browserbase'.",
    );
  }
  throw new Error(
    "Hyperbrowser backend is a Phase-1 stub. Real implementation lands in Phase 2.",
  );
}

// ── Public API ──────────────────────────────────────────────────────────

export async function startSession(opts: StartOpts): Promise<string> {
  assertFlagOn();
  const backend: BrowserBackend = opts.backend ?? "playwright";
  assertKnownBackend(backend);

  const sessionId = newSessionId();
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  let handle: unknown;
  if (backend === "playwright") {
    handle = await startPlaywrightSession(sessionId);
  } else if (backend === "browserbase") {
    handle = await startBrowserbaseSession(opts);
  } else {
    handle = await startHyperbrowserSession(opts);
  }

  const meta: SessionMeta = {
    sessionId,
    userId: opts.userId,
    backend,
    createdAt: now,
    expiresAt: now + ttlMs,
    ttlMs,
    _handle: handle,
  };

  // Arm the TTL cleanup. We store the timer handle so explicit endSession
  // can cancel it — otherwise the timer would fire on an already-closed
  // session and we'd double-close the backend handle.
  meta._timer = setTimeout(() => {
    // Fire-and-forget is fine: TTL cleanup has no caller to report back to.
    void endSession(sessionId).catch(() => {
      // Swallow — logging here would noise tests; real observability
      // comes in Phase 2 via the event log (Task 6).
    });
  }, ttlMs);
  // Don't keep the Node event loop alive just for session cleanup.
  if (typeof meta._timer.unref === "function") {
    meta._timer.unref();
  }

  sessions.set(sessionId, meta);
  return sessionId;
}

export async function resumeSession(
  sessionId: string,
): Promise<BrowserContextLike> {
  const meta = sessions.get(sessionId);
  if (!meta) {
    throw new Error(`Browser session not found: ${sessionId}`);
  }
  if (meta.backend === "playwright") {
    const handle = meta._handle as {
      browser: { newContext: () => Promise<BrowserContextLike> };
    };
    return handle.browser.newContext();
  }
  // Cloud backends won't reach here in Phase 1 (startSession would have
  // thrown), but the branch keeps the contract explicit for reviewers.
  throw new Error(
    `resumeSession for backend=${meta.backend} is a Phase-1 stub.`,
  );
}

export async function endSession(sessionId: string): Promise<void> {
  const meta = sessions.get(sessionId);
  if (!meta) {
    // Idempotent: calling endSession twice should not throw. The session
    // may already be gone via TTL cleanup or a previous explicit end.
    return;
  }
  sessions.delete(sessionId);
  if (meta._timer) {
    clearTimeout(meta._timer);
  }
  if (meta.backend === "playwright") {
    await closePlaywrightSession(meta._handle);
  }
  // Cloud backend teardown arrives in Phase 2 alongside startup.
}

export function getSession(sessionId: string): SessionMeta | null {
  return sessions.get(sessionId) ?? null;
}

/**
 * Test-only export: wipe the session map. Not part of the public adapter
 * surface, but useful when tests need a clean slate without tearing down
 * real browser handles.
 */
export function _resetSessionsForTests(): void {
  for (const meta of sessions.values()) {
    if (meta._timer) clearTimeout(meta._timer);
  }
  sessions.clear();
}

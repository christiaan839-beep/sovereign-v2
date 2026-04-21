/**
 * POSTHOG CLIENT — Typed event taxonomy + browser capture.
 *
 * Why a typed wrapper instead of calling `posthog.capture()` directly:
 * string-keyed events drift silently. We had `signup_completed` in
 * one file and `signupCompleted` in another — PostHog happily recorded
 * both as different events, splitting the funnel and hiding conversion.
 * Forcing every call through a discriminated-union type means the
 * compiler refuses to build if an event name or property shape is wrong.
 *
 * Server-side tracking lives in posthog-server.ts (separate because
 * the server client needs `distinctId` explicitly — the browser
 * client infers it from the cookie).
 */

/* ─── Event taxonomy — add new events here, never inline ───────── */

export type TrackedEvent =
  // Marketing / pre-signup
  | { name: "landing_cta_click"; properties: { cta: string; path: string } }
  | { name: "pricing_view"; properties: { plan_emphasized: string | null } }
  | { name: "pricing_cta_click"; properties: { plan: string } }

  // Auth
  | { name: "signup_started"; properties: { source: string } }
  | { name: "signup_completed"; properties: { source: string; plan: string } }
  | { name: "login_completed"; properties: Record<string, never> }

  // Agent / playbook flow
  | { name: "playbook_run_started"; properties: { playbook_id: string; via: "manual" | "scheduled" } }
  | { name: "playbook_run_completed"; properties: { playbook_id: string; status: "done" | "failed"; duration_ms: number } }
  | { name: "agent_run_blocked"; properties: { agent: string; reason: "paywall" | "credits" | "safety" | "rate_limit" } }
  | { name: "agent_installed"; properties: { agent_slug: string; pricing_cents: number } }

  // Voice (for future Plan 3)
  | { name: "voice_session_started"; properties: { persona: string } }
  | { name: "voice_session_completed"; properties: { persona: string; duration_seconds: number } }

  // Scheduling
  | { name: "schedule_created"; properties: { playbook_id: string; preset: string } }
  | { name: "schedule_paused"; properties: { schedule_id: string } }
  | { name: "schedule_deleted"; properties: { schedule_id: string } }

  // Billing / credits
  | { name: "upgrade_viewed"; properties: { from_plan: string; trigger: string } }
  | { name: "checkout_started"; properties: { plan: string; amount_cents: number } }
  | { name: "checkout_completed"; properties: { plan: string; amount_cents: number } }
  | { name: "credits_low_warning"; properties: { balance_cents: number } };

/* ─── Capture ─────────────────────────────────────────────────── */

declare global {
  interface Window {
    posthog?: {
      capture: (name: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, traits?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Fire a typed event. Safe to call in any component lifecycle —
 * silently no-ops when PostHog isn't loaded (dev without a key,
 * ad-blocked clients, pre-hydration SSR).
 */
export function track<T extends TrackedEvent>(event: T): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph) return;
  try {
    ph.capture(event.name, event.properties as Record<string, unknown>);
  } catch {
    // PostHog can throw on adblocked XHR — not our problem
  }
}

/** Link a Clerk user to a PostHog distinct_id. Call once on sign-in. */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph) return;
  try {
    ph.identify(userId, traits);
  } catch { /* ignore */ }
}

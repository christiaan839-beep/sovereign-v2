/**
 * Client-side CTA click tracking.
 *
 * Shared between FounderCTA, PrimaryCTA, the featured
 * playbook cards, and any other tracked surface. Posts to
 * /api/_misc/cta-click via sendBeacon (or fetch keepalive fallback)
 * so delivery survives the cross-page navigation that follows.
 *
 * Privacy:
 *   - Session ID is a browser-scoped UUID in localStorage. Not a
 *     cookie, never sent to third parties, never joined to PII on
 *     the server.
 *   - No click tracking when window/localStorage is unavailable
 *     (SSR, CSP-locked contexts).
 *   - Analytics failure MUST NEVER block the click — the caller's
 *     anchor/Link still navigates even if the beacon never leaves.
 */

const SESSION_KEY = "sovereign-session-v1";

/** Names allowed by the server route. Update both sides together. */
export type CtaName =
  | "founder-cta"
  | "primary-hero"
  | "primary-final"
  | "seat-claim"
  | "playbook-card"
  | "email-founder" // legacy — kept for backward analytics compat
  | "email-sales"
  | "final-cta"
  | "nav-run-free"
  | "mobile-nav-run-free"
  | "hero-marketplace"
  | "hero-pilot-bundle"
  | "pricing-teaser-full"
  | "footer-colophon";

/**
 * Return (creating if missing) a 36-char UUID unique to this browser.
 * Stored in localStorage, not a cookie — survives across logged-in
 * and logged-out states so pre-auth clicks can be stitched to the
 * eventual signup.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Fire-and-forget CTA click beacon. Safe to call during an anchor's
 * `onClick` — the navigation that follows will not cancel the beacon
 * because sendBeacon (or fetch with keepalive) is explicitly designed
 * for exactly this scenario.
 */
export function trackCtaClick(
  ctaName: CtaName,
  opts: { sourcePath?: string } = {},
): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    ctaName,
    sourcePath: opts.sourcePath ?? window.location.pathname,
    sessionId: getOrCreateSessionId(),
  });

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/_misc/cta-click",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
  } catch {
    /* sendBeacon can throw in sandboxed/CSP-locked contexts — fall through */
  }

  // keepalive:true tells the browser to complete the request even if
  // the document unloads (Fetch Standard §5.1.6). Same semantics as
  // sendBeacon, wider error telemetry surface.
  fetch("/api/_misc/cta-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* analytics failure MUST NEVER block the click */
  });
}

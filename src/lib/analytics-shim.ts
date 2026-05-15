/**
 * SOVEREIGN MATRIX — Third-party analytics shim (Cook 154).
 *
 * Provider-agnostic event tracking. Distinct from src/lib/analytics.ts
 * (the in-memory tracker for dashboard use). This shim forwards events
 * to a configured PostHog / Plausible / first-party ingest endpoint
 * when env keys are set; no-op when nothing is configured.
 *
 * Pure module: no side effects beyond the conditional fetch / global
 * call. SSR-safe — every browser-only call is guarded by the
 * typeof-window check.
 *
 * Caller pattern:
 *   import { trackEvent } from "@/lib/analytics-shim";
 *   trackEvent("starter_pack_clicked", { sku: "advisory-pack-1h" });
 */

// ── Public types ──────────────────────────────────────────────────────────

export type ShimEventProps = Record<string, string | number | boolean | null>;

export interface AnalyticsShimConfig {
  posthogKey?: string;
  posthogHost?: string;
  plausibleDomain?: string;
  /**
   * If set, events are also sent to this internal endpoint as JSON
   * POST body. Useful for first-party analytics without any
   * third-party SaaS.
   */
  ingestEndpoint?: string;
}

// ── Config resolution ────────────────────────────────────────────────────

let _cachedConfig: AnalyticsShimConfig | null = null;

export function getShimConfig(): AnalyticsShimConfig {
  if (_cachedConfig) return _cachedConfig;
  const cfg: AnalyticsShimConfig = {
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    posthogHost:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
    ingestEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_INGEST_PATH,
  };
  _cachedConfig = cfg;
  return cfg;
}

/** Reset the cached config — test helper. */
export function _resetShimConfigCache(): void {
  _cachedConfig = null;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Track a single event. Multi-provider: PostHog gets the full event
 * shape, Plausible only gets the event name (it's pageview-centric),
 * and ingestEndpoint gets the canonical payload. No-ops when no
 * provider is configured.
 */
export function trackEvent(event: string, props: ShimEventProps = {}): void {
  if (!event || typeof event !== "string") return;
  const cfg = getShimConfig();
  const enriched = enrichShim(props);

  // Browser-only: PostHog + Plausible JS SDKs.
  if (typeof window !== "undefined") {
    try {
      if (cfg.posthogKey) {
        const w = window as unknown as {
          posthog?: {
            capture: (e: string, p?: ShimEventProps) => void;
          };
        };
        w.posthog?.capture(event, enriched);
      }
      if (cfg.plausibleDomain) {
        const w = window as unknown as {
          plausible?: (e: string, opts?: { props?: ShimEventProps }) => void;
        };
        w.plausible?.(event, { props: enriched });
      }
    } catch {
      // Analytics must never break the app — swallow errors.
    }
  }

  // First-party ingest (server + client). Fire-and-forget.
  if (cfg.ingestEndpoint) {
    try {
      fetch(cfg.ingestEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event,
          props: enriched,
          ts: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {
        /* swallow */
      });
    } catch {
      /* swallow */
    }
  }
}

/**
 * Identify the current user. Some providers (PostHog) maintain a
 * separate identity store; others (Plausible) don't. SSR-safe.
 */
export function identifyShim(userId: string, props: ShimEventProps = {}): void {
  if (!userId) return;
  if (typeof window === "undefined") return;
  const cfg = getShimConfig();
  try {
    if (cfg.posthogKey) {
      const w = window as unknown as {
        posthog?: {
          identify: (id: string, p?: ShimEventProps) => void;
        };
      };
      w.posthog?.identify(userId, props);
    }
  } catch {
    /* swallow */
  }
}

/**
 * Page-view event. Most provider SDKs auto-track; this is for
 * single-page-app route changes the SDK might miss.
 */
export function pageviewShim(path: string): void {
  trackEvent("$pageview", { path });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function enrichShim(props: ShimEventProps): ShimEventProps {
  const out: ShimEventProps = { ...props };
  for (const k of Object.keys(out)) {
    if (out[k] === null || out[k] === "") delete out[k];
  }
  return out;
}

/**
 * Returns whether any analytics provider is configured. Lets
 * UI components conditionally render an opt-out banner only when
 * there's actually a provider to opt out of.
 */
export function isShimEnabled(): boolean {
  const cfg = getShimConfig();
  return Boolean(cfg.posthogKey || cfg.plausibleDomain || cfg.ingestEndpoint);
}

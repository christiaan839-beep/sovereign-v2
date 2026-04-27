"use client";

/**
 * UTMCapture — invisible component that captures channel-attribution
 * params on first landing and stashes them in localStorage. The values
 * persist across page navigations, sign-up, and onboarding so the FIRST
 * touch is what gets recorded against the tenant — not the last
 * (post-signup pageview where utm is gone).
 *
 * Mount once in the root layout. No props, no DOM.
 *
 * Stored under "sovereign_utm" as a JSON blob:
 *   { source, medium, campaign, referrer, capturedAt }
 *
 * Once captured, never overwritten — first-touch attribution wins.
 */
import { useEffect } from "react";

const STORAGE_KEY = "sovereign_utm";
const SAFE_RE = /^[A-Za-z0-9._\-/:?&=%# ]{1,200}$/;

function safe(s: string | null): string | undefined {
  if (!s) return undefined;
  return SAFE_RE.test(s) ? s : undefined;
}

export default function UTMCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // First-touch wins — never overwrite an existing capture.
      if (localStorage.getItem(STORAGE_KEY)) return;

      const params = new URLSearchParams(window.location.search);
      const source = safe(params.get("utm_source") || params.get("ref"));
      const medium = safe(params.get("utm_medium"));
      const campaign = safe(params.get("utm_campaign"));
      const referrerRaw = document.referrer || "";
      const referrer = safe(
        referrerRaw && !referrerRaw.includes(window.location.host)
          ? referrerRaw
          : "",
      );

      // Only store when SOMETHING is meaningful — empty captures are noise.
      if (!source && !medium && !campaign && !referrer) return;

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          source,
          medium,
          campaign,
          referrer,
          capturedAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* localStorage disabled (Safari private mode etc) — degrade silently */
    }
  }, []);

  return null;
}

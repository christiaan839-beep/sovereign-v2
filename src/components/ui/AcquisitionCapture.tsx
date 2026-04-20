"use client";

import { useEffect } from "react";

/**
 * ACQUISITION CAPTURE — mounts silently and fires ONCE per browser
 * to record UTM + referrer attribution at first post-auth page load.
 *
 * Mounted in the dashboard layout; no visual output. The
 * `localStorage` flag prevents firing repeatedly — first-touch wins,
 * we never overwrite.
 *
 * Why first-touch: in B2B SaaS, re-visits from different channels
 * (email, LinkedIn message, direct) happen frequently. Attributing
 * to the LAST touch inflates the vanity channel and undercounts the
 * channel that actually earned the signup.
 *
 * Server-side `recordAcquisition()` ALSO enforces first-write-wins
 * via SQL (`IS NULL` check), so a misbehaving client can't rewrite
 * attribution — this flag is just a performance optimization to
 * avoid unnecessary round-trips.
 */

const FIRED_FLAG = "sovereign-acq-captured-v1";

export function AcquisitionCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(FIRED_FLAG)) return;

    const url = new URL(window.location.href);
    const utmSource = url.searchParams.get("utm_source") ?? undefined;
    const utmMedium = url.searchParams.get("utm_medium") ?? undefined;
    const utmCampaign = url.searchParams.get("utm_campaign") ?? undefined;
    const referrer = document.referrer || undefined;

    // If the user has NO signal at all (no UTM, no referrer), it's
    // a direct visit. We still record that — it's useful data (every
    // channel's "direct" share is meaningful).

    fetch("/api/_misc/acquisition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        utmSource,
        utmMedium,
        utmCampaign,
        referrer,
      }),
    })
      .then((res) => {
        if (res.ok) {
          localStorage.setItem(FIRED_FLAG, "1");
        }
      })
      .catch(() => {
        // Non-critical; don't surface to the user. We try again on
        // next load if it failed.
      });
  }, []);

  return null;
}

"use client";

/**
 * ViewTracker — renders nothing, fires one POST /api/marketplace/view
 * after the component mounts. Placed inside SamAgentDetail so every
 * public agent page reports a view.
 *
 * Anonymous UUID is minted client-side and cached in localStorage
 * under "sm-anon". No cookies, no PII. If localStorage is unavailable
 * (Safari private mode, iframe, etc.) we fall back to a per-session
 * in-memory UUID that disappears on reload — degrades to "one view
 * per reload from this visitor" which is still useful data.
 */

import { useEffect, useRef } from "react";

const ANON_KEY = "sm-anon";

function randomId(): string {
  // Prefer crypto.randomUUID where available (all modern browsers).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback — 32 hex chars of Math.random. Good enough for an
  // anonymous bucket identifier; not a security primitive.
  return Array.from({ length: 8 })
    .map(() => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0"))
    .join("");
}

function readOrMintAnon(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const fresh = randomId();
    localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

function referrerHost(): string | null {
  if (typeof document === "undefined" || !document.referrer) return null;
  try {
    return new URL(document.referrer).host.toLowerCase();
  } catch {
    return null;
  }
}

interface Props {
  agentId: string;
  slug: string | null;
}

export function ViewTracker({ agentId, slug }: Props) {
  // Ref gate prevents double-fire under React strict-mode's
  // development double-render. Production gets one fire per mount.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const anonymousId = readOrMintAnon();
    const host = referrerHost();

    // fire-and-forget; never blocks UI. Errors are silent by design —
    // a tracking failure shouldn't log noise in the user's console.
    void fetch("/api/marketplace/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId,
        slug,
        anonymousId,
        referrerHost: host,
      }),
      // keepalive so the request survives a fast navigation away
      keepalive: true,
    }).catch(() => {
      // Swallow — tracking is not critical.
    });
  }, [agentId, slug]);

  return null;
}

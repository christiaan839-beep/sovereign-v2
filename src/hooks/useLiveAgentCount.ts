"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the live agent count from /api/health once on mount.
 * Falls back to a sensible static default so the UI never shows 0.
 *
 * No polling — agent count is effectively static per deploy and we
 * don't want to burn request budget on a cosmetic number.
 */
export function useLiveAgentCount(fallback = 130): number {
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const total = data?.agents?.totalAgents;
        if (typeof total === "number" && total > 0) setCount(total);
      })
      .catch(() => {
        // Swallow — fallback count is already set.
      });
  }, []);

  return count;
}

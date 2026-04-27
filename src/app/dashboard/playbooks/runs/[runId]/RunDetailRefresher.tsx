"use client";

/**
 * <RunDetailRefresher> — auto-refreshes the run detail server
 * component while the run is in flight.
 *
 * Lives inside the server-rendered detail page. When `status` is
 * "running" it calls router.refresh() every 2s, which re-renders the
 * server component with the latest DB row. As soon as the status
 * flips to completed/failed it stops refreshing.
 *
 * router.refresh() is the right tool here: it re-runs the server
 * component without a hard navigation (state preserved, scroll
 * preserved). The cost is one round-trip to the server every 2s,
 * which is acceptable for a forensic page that's intentionally
 * not high-traffic.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  status: "running" | "completed" | "failed";
}

const REFRESH_INTERVAL_MS = 2000;
// Hard cap: stop polling after 10 minutes regardless of state. A run
// that's still "running" after 10 minutes is either real work the
// user can come back to, OR an orphan that the future cleanup job
// will handle. Either way, the page shouldn't keep hitting the
// server.
const MAX_REFRESH_MS = 10 * 60 * 1000;

export function RunDetailRefresher({ status }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "running") return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt > MAX_REFRESH_MS) {
        window.clearInterval(interval);
        return;
      }
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [status, router]);

  // Renders nothing — the server component already shows the data.
  // This is a pure side-effect component.
  return null;
}

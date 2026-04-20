"use client";

import { useEffect, useState } from "react";

/**
 * Live platform health badge.
 *
 * Pulls /api/health/ping every 60s (Edge runtime, sub-20ms) and
 * renders a single line: "● All systems operational · 12ms".
 * The dot breathes (animate-pulse) when healthy, goes amber when
 * the request fails to reach the server, red when the server
 * responds unhealthy.
 *
 * This is the Vercel/Cloudflare/Supabase move — you know the site
 * cares about uptime when the footer tells you so live. First paint
 * uses an honest "checking..." state so the component never lies
 * about a status it hasn't verified yet.
 */

type Status = "checking" | "healthy" | "degraded" | "unhealthy";

interface PingResponse {
  status?: string;
  latency_ms?: number;
}

export function StatusIndicator() {
  const [state, setState] = useState<Status>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const controller = new AbortController();

    async function ping() {
      try {
        const start = performance.now();
        const res = await fetch("/api/health/ping", {
          cache: "no-store",
          signal: controller.signal,
        });
        const elapsed = Math.round(performance.now() - start);

        if (cancelled) return;

        if (!res.ok) {
          setState("unhealthy");
          setLatency(elapsed);
          return;
        }

        const data = (await res.json()) as PingResponse;
        if (cancelled) return;

        setState(data.status === "healthy" ? "healthy" : "unhealthy");
        setLatency(data.latency_ms ?? elapsed);
      } catch {
        if (cancelled) return;
        setState("degraded");
        setLatency(null);
      }
    }

    ping();
    const interval = setInterval(ping, 60_000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  // Pick the colors + label based on status
  const config = (() => {
    switch (state) {
      case "healthy":
        return {
          label: "All systems operational",
          dot: "bg-emerald-400",
          text: "text-neutral-500",
          pulse: true,
        };
      case "degraded":
        return {
          label: "Checking status",
          dot: "bg-amber-400",
          text: "text-neutral-500",
          pulse: true,
        };
      case "unhealthy":
        return {
          label: "Investigating degradation",
          dot: "bg-rose-400",
          text: "text-neutral-500",
          pulse: false,
        };
      case "checking":
      default:
        return {
          label: "Checking status",
          dot: "bg-neutral-500",
          text: "text-neutral-600",
          pulse: false,
        };
    }
  })();

  return (
    <a
      href="/status"
      className={`inline-flex items-center gap-2 text-[10px] font-mono tracking-tight hover:text-white transition-colors ${config.text}`}
      aria-label={`Platform status: ${config.label}`}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping ${config.dot}`}
          />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`}
        />
      </span>

      <span>{config.label}</span>

      {latency !== null && state === "healthy" && (
        <>
          <span aria-hidden="true" className="text-neutral-800">·</span>
          <span className="tabular-nums">{latency}ms</span>
        </>
      )}
    </a>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * LiveModelHealth — pings /api/health/deep and renders real provider status.
 *
 * Honesty rules enforced here:
 *  - No per-model random jitter. If a provider's status is "ok" we show
 *    the actual latency_ms the health endpoint reported. If the endpoint
 *    doesn't have a live latency (provider checked by key-presence only),
 *    we show "ready" instead of a fake number.
 *  - On fetch failure we show "—" per provider, not "offline" — because
 *    the failure means WE can't reach our own health endpoint, which
 *    isn't the same as the provider being down.
 */

type Check = {
  status: "ok" | "degraded" | "down";
  latency_ms: number;
  detail?: string;
};

type HealthPayload = {
  status: string;
  checks: Record<string, Check>;
};

const PROVIDERS: Array<{ key: string; label: string; color: string }> = [
  { key: "nvidia_nim", label: "NVIDIA NIM", color: "emerald" },
  { key: "anthropic",  label: "Claude",     color: "orange"  },
  { key: "gemini",     label: "Gemini",     color: "violet"  },
  { key: "database",   label: "Database",   color: "cyan"    },
];

export function LiveModelHealth() {
  const [checks, setChecks] = useState<Record<string, Check> | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function ping() {
      try {
        const res = await fetch("/api/health/deep", {
          method: "GET",
          signal: AbortSignal.timeout(6000),
          // Don't cache — we want fresh status every 30s
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as HealthPayload;
        if (!mounted) return;
        setChecks(data.checks);
        setFetchFailed(false);
      } catch {
        if (!mounted) return;
        setFetchFailed(true);
      }
    }

    ping();
    const iv = setInterval(ping, 30_000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PROVIDERS.map(({ key, label, color }) => {
        const c = checks?.[key];
        const isOk = c?.status === "ok";
        const isDegraded = c?.status === "degraded";
        const latencyLabel = fetchFailed
          ? "—"
          : !c
            ? "checking"
            : isOk && c.latency_ms > 0
              ? `${c.latency_ms}ms`
              : isOk
                ? "ready"
                : isDegraded
                  ? "slow"
                  : "down";

        // Color for the status dot
        const dotClass = fetchFailed || !c
          ? "bg-neutral-600"
          : isOk
            ? color === "orange"
              ? "bg-orange-400"
              : color === "violet"
                ? "bg-violet-400"
                : color === "cyan"
                  ? "bg-cyan-400"
                  : "bg-emerald-400"
            : isDegraded
              ? "bg-amber-400"
              : "bg-rose-400";

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] text-[10px]"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${isOk && c?.latency_ms === 0 ? "" : isOk ? "animate-pulse" : ""}`} />
            <span className="text-neutral-300 font-mono">{label}</span>
            <span className="text-neutral-500 font-mono tabular-nums">{latencyLabel}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

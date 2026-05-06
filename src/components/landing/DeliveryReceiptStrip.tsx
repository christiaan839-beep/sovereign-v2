"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * DeliveryReceiptStrip — client component, fetches /api/proof/stats.
 *
 * Sibling to LiveProofStrip (platform-shape: 137 agents, 39 models).
 * This one is delivery-shape: how many customers, how many leads
 * shipped, on-time rate over the last 4 Mondays. Different question,
 * different answer.
 *
 * The /api/proof/stats endpoint is already rate-limited (30/min/IP,
 * MEDIUM fix from the security audit) and CDN-cached for 5 minutes,
 * so the network hit is cheap and the worst-case fallback is the
 * "standing up" placeholder — never misleading zeros.
 *
 * Why client instead of server-render: the homepage at src/app/page.tsx
 * is `"use client"`, so an async server component can't be a child.
 * The 200ms-or-so flash is acceptable because the strip sits under
 * the hero — typical scroll distance is past the fold by the time
 * the request returns.
 */

interface ProofPayload {
  activeCustomers: number;
  totalDeliveriesShipped: number;
  leadsDelivered: number;
  thisWeekShipped: number;
  last4WeeksOnTimeRate: number;
  migrationsApplied: boolean;
  generatedAt: string;
}

const FALLBACK: ProofPayload = {
  activeCustomers: 0,
  totalDeliveriesShipped: 0,
  leadsDelivered: 0,
  thisWeekShipped: 0,
  last4WeeksOnTimeRate: 0,
  migrationsApplied: false,
  generatedAt: new Date().toISOString(),
};

export function DeliveryReceiptStrip() {
  const [stats, setStats] = useState<ProofPayload>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/proof/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ProofPayload) => {
        if (!cancelled && data) {
          setStats(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready =
    loaded &&
    stats.migrationsApplied &&
    (stats.totalDeliveriesShipped > 0 || stats.activeCustomers > 0);

  if (!ready) {
    return (
      <section
        aria-label="Delivery proof"
        className="relative w-full border-y border-white/5 bg-white/[0.015] py-6"
      >
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">
            Standing up the proof feed
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Numbers go live the moment the first Monday delivery ships. See{" "}
            <Link
              href="/standards"
              className="text-emerald-400/80 hover:text-emerald-400 transition"
            >
              Standards &rarr;
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const items: Array<{ value: string; label: string; accent?: boolean }> = [
    {
      value: stats.activeCustomers.toString(),
      label: "active customers",
    },
    {
      value: stats.totalDeliveriesShipped.toLocaleString(),
      label: "deliveries shipped",
    },
    {
      value: stats.leadsDelivered.toLocaleString(),
      label: "leads in customer hands",
    },
    {
      value: `${Math.round(stats.last4WeeksOnTimeRate * 100)}%`,
      label: "on-time (last 4 Mondays)",
      accent: true,
    },
  ];

  return (
    <section
      aria-label="Delivery proof"
      className="relative w-full border-y border-white/5 bg-gradient-to-r from-emerald-500/[0.02] via-white/[0.015] to-emerald-500/[0.02] py-7"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-400/80">
          Live delivery receipt &middot;{" "}
          <Link
            href="/proof"
            className="underline decoration-dotted decoration-1 hover:decoration-solid hover:text-emerald-400 transition"
          >
            verify on /proof
          </Link>
        </p>
        <div className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  item.accent ? "text-emerald-400" : "text-white"
                }`}
              >
                {item.value}
              </span>
              <span className="text-xs text-neutral-500">{item.label}</span>
              {i < items.length - 1 && (
                <span
                  aria-hidden
                  className="ml-6 inline-block h-1 w-1 rounded-full bg-neutral-700"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Loader2, AlertTriangle, TrendingUp } from "lucide-react";

interface Channel {
  source: string;
  medium: string | null;
  signups: number;
  paid: number;
  conversionPct: number;
  estMonthlyRevenueUsd: string;
}

interface ChannelsPayload {
  windowDays: number;
  totalSignups: number;
  totalPaid: number;
  channels: Channel[];
}

const WINDOWS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function ChannelsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ChannelsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/_admin/channels?days=${days}`)
      .then(async (r) => {
        if (r.status === 404)
          throw new Error(
            "Admin access required. Add your Clerk userId to ADMIN_USER_IDS.",
          );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ChannelsPayload) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 px-4 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] uppercase tracking-widest text-emerald-400/80 mb-4">
              <Compass className="w-3 h-3" /> Admin · Channel attribution
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mb-3">
              Acquisition Channels
            </h1>
            <p className="text-sm text-neutral-500 max-w-2xl">
              First-touch UTM attribution captured at landing. Shows which
              source actually drives paying conversions, not just signup volume.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={() => setDays(w.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  days === w.days
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div className="flex items-center gap-3 text-neutral-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Computing window…
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-200">{error}</div>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <PlatformStat
                label={`Signups · ${data.windowDays}d`}
                value={String(data.totalSignups)}
                accent="text-white"
              />
              <PlatformStat
                label="Paid conversions"
                value={String(data.totalPaid)}
                accent="text-emerald-400"
              />
              <PlatformStat
                label="Blended conversion"
                value={
                  data.totalSignups > 0
                    ? `${Math.round((data.totalPaid / data.totalSignups) * 1000) / 10}%`
                    : "—"
                }
                accent="text-cyan-400"
              />
            </div>

            <div className="rounded-2xl border border-white/[0.05] overflow-hidden bg-white/[0.02]">
              <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.6fr_0.7fr_0.9fr] px-5 py-3 text-[10px] uppercase tracking-widest text-neutral-600 border-b border-white/[0.05]">
                <div>Source</div>
                <div>Medium</div>
                <div className="text-right">Signups</div>
                <div className="text-right">Paid</div>
                <div className="text-right">Conv %</div>
                <div className="text-right">Est MRR</div>
              </div>

              {data.channels.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-neutral-600">
                  No signups in the last {data.windowDays} days.
                </div>
              ) : (
                data.channels.map((c, idx) => (
                  <motion.div
                    key={`${c.source}-${c.medium ?? "x"}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="grid grid-cols-[1.2fr_1fr_0.6fr_0.6fr_0.7fr_0.9fr] px-5 py-4 text-xs border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="text-neutral-200 font-semibold">
                      {c.source}
                    </div>
                    <div className="text-neutral-500">{c.medium ?? "—"}</div>
                    <div className="text-right text-neutral-300">
                      {c.signups}
                    </div>
                    <div className="text-right text-emerald-400">{c.paid}</div>
                    <div
                      className={`text-right font-semibold ${
                        c.conversionPct > 5
                          ? "text-emerald-400"
                          : c.conversionPct > 1
                            ? "text-amber-400"
                            : "text-neutral-500"
                      }`}
                    >
                      {c.conversionPct}%
                    </div>
                    <div className="text-right text-cyan-400">
                      {c.estMonthlyRevenueUsd}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-widest">
              <TrendingUp className="w-3 h-3" /> Capture:
              src/components/UTMCapture.tsx · First-touch attribution wins.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
        {label}
      </div>
      <div className={`text-2xl font-black tracking-tight ${accent}`}>
        {value}
      </div>
    </div>
  );
}

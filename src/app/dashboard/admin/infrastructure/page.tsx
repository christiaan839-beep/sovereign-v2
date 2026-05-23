"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/infrastructure (Wave 133).
 *
 * Operator-facing dashboard for the self-host / managed split. Shows:
 *   - OSS inference endpoint (vLLM / NIM Microservices / Triton)
 *   - NIM managed fallback
 *   - NeMo Retriever (embed + rerank)
 *   - BigQuery export pipeline
 *   - Riva voice
 *
 * Each row tells the operator: which env vars enable self-hosting,
 * what's currently configured, latest probe latency, and the savings
 * note for switching modes.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  Crown,
  Database,
  Mic,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import { motion } from "framer-motion";

interface InfraEntry {
  id: string;
  label: string;
  description: string;
  mode: "self-hosted" | "managed" | "not-configured";
  envVars: string[];
  endpoint?: string;
  probe?: { ok: boolean; latencyMs: number; error?: string };
  savingsNote?: string;
}

interface InfraResponse {
  generatedAt: string;
  entries: InfraEntry[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "oss-inference": Cpu,
  "nim-managed": Server,
  "nemo-retriever": Search,
  "bigquery-export": Database,
  "riva-voice": Mic,
};

function modeStyle(mode: InfraEntry["mode"]) {
  if (mode === "self-hosted") {
    return {
      label: "Self-hosted",
      cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
    };
  }
  if (mode === "managed") {
    return {
      label: "Managed",
      cls: "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300",
    };
  }
  return {
    label: "Not configured",
    cls: "border-neutral-500/30 bg-neutral-500/[0.08] text-neutral-400",
  };
}

export default function AdminInfrastructurePage() {
  const [data, setData] = useState<InfraResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfra = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infrastructure", {
        cache: "no-store",
      });
      if (res.status === 403) {
        setError("Admin-only — your Clerk session is not authorised.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: InfraResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInfra();
  }, [fetchInfra]);

  return (
    <main className="relative min-h-screen bg-[#030303] text-neutral-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <Link
            href="/dashboard/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" /> back to admin
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                <Crown className="h-3 w-3" />
                Admin-only · infrastructure map
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                Self-hosted vs managed
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Each row shows whether the underlying capability is wired to
                your own infrastructure (vLLM, Riva, BigQuery, NeMo Retriever)
                or routed through the managed fallback (NIM, Twilio, NeMo hosted
                endpoints). Set the listed env vars to flip.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchInfra}
              disabled={loading}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 text-neutral-400 backdrop-blur-xl transition hover:text-neutral-200 disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && !error && (
          <div className="grid gap-4">
            {data.entries.map((entry) => {
              const Icon = ICONS[entry.id] ?? Cpu;
              const mode = modeStyle(entry.mode);
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                        <Icon className="h-4 w-4 text-cyan-300" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          {entry.label}
                        </h2>
                        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-neutral-400">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${mode.cls}`}
                    >
                      {mode.label}
                    </span>
                  </div>

                  {(entry.endpoint || entry.probe) && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 text-[11px] text-neutral-400">
                      {entry.endpoint && (
                        <div>
                          <span className="text-neutral-600">endpoint:</span>{" "}
                          <span className="font-mono text-neutral-300">
                            {entry.endpoint}
                          </span>
                        </div>
                      )}
                      {entry.probe && (
                        <div>
                          <span className="text-neutral-600">probe:</span>{" "}
                          <span
                            className={`font-mono ${
                              entry.probe.ok
                                ? "text-emerald-300"
                                : "text-red-300"
                            }`}
                          >
                            {entry.probe.ok
                              ? "ok"
                              : (entry.probe.error ?? "fail")}{" "}
                            · {entry.probe.latencyMs}ms
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {entry.envVars.length > 0 && (
                    <div className="mt-4 text-[11px]">
                      <div className="mb-1 text-neutral-600">
                        Env vars to flip:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {entry.envVars.map((v) => (
                          <code
                            key={v}
                            className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 font-mono text-[10px] text-neutral-300"
                          >
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.savingsNote && (
                    <div className="mt-3 rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-2 text-[11px] leading-relaxed text-cyan-300/90">
                      {entry.savingsNote}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {data
              ? `updated ${new Date(data.generatedAt).toLocaleTimeString()}`
              : "loading…"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/admin/infrastructure"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw JSON
            </Link>
            <Link
              href="/dashboard/admin/sessions"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              sessions →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

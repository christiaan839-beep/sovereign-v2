"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/memories (Wave 143).
 *
 * Operator-facing memory browser. Cross-user, cross-agent search
 * over the entire vector memory pool. Lets the operator curate the
 * platform's brain — delete stale entries, audit what was stored,
 * filter by agent.
 *
 * State previews may contain sensitive content — operator-only.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Crown,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";

interface MemoryRow {
  id: string;
  userId: string;
  agentName: string;
  preview: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface MemoryResponse {
  generatedAt: string;
  count: number;
  filters: {
    userId: string | null;
    agentName: string | null;
    search: string | null;
    limit: number;
    sort: string;
  };
  memories: MemoryRow[];
  warning?: string;
}

function short(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (
      d.getUTCFullYear() === today.getUTCFullYear() &&
      d.getUTCMonth() === today.getUTCMonth() &&
      d.getUTCDate() === today.getUTCDate()
    ) {
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
    }
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function truncate(s: string, max: number): string {
  return s && s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function AdminMemoriesPage() {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (agentFilter.trim()) params.set("agent", agentFilter.trim());
      if (userFilter.trim()) params.set("userId", userFilter.trim());
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      const res = await fetch(`/api/admin/memories?${params.toString()}`);
      if (res.status === 403) {
        setError("Admin-only — your Clerk session is not authorised.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MemoryResponse = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [agentFilter, userFilter, searchQuery]);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  async function deleteMemory(id: string) {
    if (!confirm(`Delete memory ${id}? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/admin/memories?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        alert(`Delete failed: HTTP ${res.status}`);
        return;
      }
      void fetchMemories();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "err"}`);
    }
  }

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

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <Link
            href="/dashboard/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" /> back to admin
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300">
                <Crown className="h-3 w-3" />
                Admin-only · memory browser
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                The platform&apos;s brain
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Every vector-memory entry, cross-user + cross-agent. Filter,
                inspect, curate, delete. Use to audit what was stored, prune
                stale entries, and ground future agent runs in clean context.
                Content may include sensitive data — operator-only.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchMemories}
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

        {data?.warning && !error && (
          <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-300">
            {data.warning}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search content…"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            />
          </div>
          <input
            type="text"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="filter by agent name…"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
          />
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="filter by user id…"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
          />
        </div>

        {data && !error && (
          <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
            <div className="border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              {data.count} memories
            </div>
            {data.memories.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-neutral-500">
                No memories match these filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                      {["Agent", "User", "Kind", "Preview", "Created", ""].map(
                        (c) => (
                          <th
                            key={c}
                            className="px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500"
                          >
                            {c}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.memories.map((m) => {
                      const kind =
                        typeof m.metadata?.kind === "string"
                          ? m.metadata.kind
                          : "—";
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-3 font-mono text-white">
                            <Brain className="mr-1 inline h-3 w-3 text-violet-300" />
                            {m.agentName}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-300">
                            {truncate(m.userId, 18)}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-400">
                            {kind}
                          </td>
                          <td
                            className="max-w-[480px] px-5 py-3 text-neutral-300"
                            title={m.preview}
                          >
                            {m.preview}
                          </td>
                          <td className="px-5 py-3 font-mono text-neutral-500">
                            {short(m.createdAt)}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => deleteMemory(m.id)}
                              className="rounded-md border border-red-500/20 bg-red-500/[0.04] p-1 text-red-300 transition hover:border-red-500/40 hover:bg-red-500/[0.10]"
                              aria-label={`Delete memory ${m.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {data
              ? `updated ${new Date(data.generatedAt).toLocaleTimeString()}`
              : "loading…"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/admin/memories"
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

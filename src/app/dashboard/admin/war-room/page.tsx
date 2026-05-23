"use client";

/**
 * SOVEREIGN MATRIX — /dashboard/admin/war-room (Wave 152).
 *
 * Real-time agent activity stream consumed via EventSource from
 * /api/admin/activity-stream. Every signed run lands here within
 * sub-second of the receipt being written.
 *
 * UX:
 *   - 4-tile stats row (total / approved / blocked / needs-approval)
 *   - Optional agent filter input (live re-subscribes)
 *   - Scrolling tick feed (newest first, capped at 200 rows)
 *   - Connection-status badge (connecting / live / closed)
 *
 * The page is operator-only and gated by the same admin email
 * allowlist as the SSE route — non-admins see a 403 message.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Activity,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

interface ActivityTick {
  id: string;
  agentName: string;
  modelUsed: string;
  userId: string | null;
  status: "auto-approved" | "needs-approval" | "blocked";
  durationMs: number;
  at: string;
  banditPick?: string;
}

interface ActivityStats {
  bufferSize: number;
  subscriberCount: number;
  total: number;
  approved: number;
  blocked: number;
  needsApproval: number;
}

type Conn = "connecting" | "live" | "closed" | "forbidden" | "error";

function short(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function truncate(s: string, max: number): string {
  return s && s.length > max ? `${s.slice(0, max)}…` : s;
}

const STATUS_STYLE: Record<
  ActivityTick["status"],
  { cls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "auto-approved": {
    cls: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },
  blocked: {
    cls: "border-red-500/30 bg-red-500/[0.08] text-red-300",
    icon: XCircle,
  },
  "needs-approval": {
    cls: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300",
    icon: AlertTriangle,
  },
};

export default function AdminWarRoomPage() {
  const [agentFilter, setAgentFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [conn, setConn] = useState<Conn>("connecting");
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [ticks, setTicks] = useState<ActivityTick[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();
    setConn("connecting");
    const url = agentFilter.trim()
      ? `/api/admin/activity-stream?agent=${encodeURIComponent(agentFilter.trim())}`
      : "/api/admin/activity-stream";
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("hello", () => setConn("live"));
    es.addEventListener("stats", (e: MessageEvent) => {
      try {
        setStats(JSON.parse(e.data) as ActivityStats);
      } catch {
        /* ignore parse error */
      }
    });
    es.addEventListener("tick", (e: MessageEvent) => {
      if (paused) return;
      try {
        const tick = JSON.parse(e.data) as ActivityTick;
        setTicks((prev) => {
          const next = [tick, ...prev];
          return next.slice(0, 200);
        });
      } catch {
        /* ignore parse error */
      }
    });
    es.addEventListener("bye", () => {
      setConn("closed");
      es.close();
    });
    es.onerror = () => {
      // EventSource auto-reconnects on transient — but our 403 + 401
      // never recover, so flip a state once if readyState=CLOSED.
      if (es.readyState === EventSource.CLOSED) {
        setConn((prev) =>
          prev === "live" || prev === "connecting" ? "error" : prev,
        );
      }
    };
  }, [agentFilter, paused]);

  // Probe admin auth once before opening the stream — gives a
  // clean forbidden state instead of a silent connection error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/activity-stream", {
          method: "HEAD",
        });
        if (cancelled) return;
        if (res.status === 403) {
          setConn("forbidden");
          return;
        }
      } catch {
        /* ignore — connect will surface errors */
      }
      if (!cancelled) connect();
    })();
    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [connect]);

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

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <Link
            href="/dashboard/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-neutral-300"
          >
            <ArrowLeft className="h-3 w-3" /> back to admin
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-300">
                <Crown className="h-3 w-3" />
                Admin-only · live war room
              </div>
              <h1 className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white">
                Real-time agent activity
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-400">
                Every signed receipt streams here within sub-second of being
                written. Filter by agent, pause to inspect, or watch the global
                ticker. Connection auto-recycles every 10 minutes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ConnBadge conn={conn} />
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${
                  paused
                    ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-300"
                    : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:text-white"
                }`}
              >
                {paused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
                {paused ? "Resume" : "Pause"}
              </button>
            </div>
          </div>
        </div>

        {conn === "forbidden" && (
          <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-300">
            Admin-only — your Clerk session is not authorised.
          </div>
        )}

        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total"
              value={stats.total.toLocaleString()}
              accent="cyan"
              icon={<Activity className="h-4 w-4" />}
            />
            <StatTile
              label="Approved"
              value={stats.approved.toLocaleString()}
              accent="emerald"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatTile
              label="Needs approval"
              value={stats.needsApproval.toLocaleString()}
              accent="amber"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatTile
              label="Blocked"
              value={stats.blocked.toLocaleString()}
              accent="red"
              icon={<XCircle className="h-4 w-4" />}
            />
          </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="filter by exact agent name (leave empty for all)…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            <span>Tick feed ({ticks.length})</span>
            <span className="font-mono text-neutral-600">
              {paused ? "paused" : "live"}
            </span>
          </div>
          {ticks.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-neutral-500">
              Waiting for the next signed receipt…
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {ticks.map((t) => {
                const style = STATUS_STYLE[t.status];
                const Icon = style.icon;
                return (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[12px] transition hover:bg-white/[0.02]"
                  >
                    <span className="font-mono text-neutral-500">
                      {short(t.at)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${style.cls}`}
                    >
                      <Icon className="h-3 w-3" />
                      {t.status}
                    </span>
                    <span className="font-mono text-white">{t.agentName}</span>
                    <span className="font-mono text-neutral-400">
                      {truncate(t.modelUsed, 28)}
                    </span>
                    <span className="font-mono text-neutral-500">
                      {t.durationMs}ms
                    </span>
                    {t.userId && (
                      <span
                        className="font-mono text-neutral-600"
                        title={t.userId}
                      >
                        {truncate(t.userId, 14)}
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="mt-16 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {stats
              ? `buffer ${stats.bufferSize}/200 · ${stats.subscriberCount} subscriber${stats.subscriberCount === 1 ? "" : "s"}`
              : "—"}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/api/admin/activity-stream"
              className="text-neutral-400 underline-offset-4 hover:text-cyan-300 hover:underline"
            >
              raw SSE
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

function ConnBadge({ conn }: { conn: Conn }) {
  const style =
    conn === "live"
      ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300"
      : conn === "connecting"
        ? "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300"
        : conn === "forbidden"
          ? "border-red-500/30 bg-red-500/[0.08] text-red-300"
          : "border-amber-500/30 bg-amber-500/[0.08] text-amber-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${style}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          conn === "live"
            ? "bg-emerald-400 animate-pulse"
            : conn === "connecting"
              ? "bg-cyan-400 animate-pulse"
              : "bg-neutral-600"
        }`}
      />
      {conn}
    </span>
  );
}

function StatTile({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: "cyan" | "emerald" | "red" | "amber";
  icon: React.ReactNode;
}) {
  const text =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : accent === "red"
          ? "text-red-300"
          : "text-amber-300";
  const bg =
    accent === "cyan"
      ? "from-cyan-500/[0.08] via-cyan-500/[0.02] to-transparent"
      : accent === "emerald"
        ? "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent"
        : accent === "red"
          ? "from-red-500/[0.08] via-red-500/[0.02] to-transparent"
          : "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${bg} p-5 backdrop-blur-xl`}
    >
      <div className={`mb-3 inline-flex items-center gap-1.5 ${text}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="font-mono text-2xl font-bold leading-none text-white">
        {value}
      </div>
    </motion.div>
  );
}

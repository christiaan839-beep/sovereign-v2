"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TrendingUp,
  Zap,
  Target,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Cpu,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Bot,
  Layers,
  Sparkles,
} from "lucide-react";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface PlaybookRun {
  id: string;
  playbookId: string;
  playbookName: string;
  status: string;
  stepCount: number;
  stepsSucceeded: number;
  stepsFailed: number;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  steps: {
    stepIndex: number;
    agentName: string;
    status: string;
    durationMs: number | null;
  }[];
}

interface RecentActivity {
  agentId: string;
  model: string;
  tokens: number;
  createdAt: string;
}

interface _DashboardStats {
  stats: {
    agentExecutions: number;
    totalTokens: number;
    leadsGenerated: number;
    bookings: number;
    contentGenerated: number;
  };
  recentActivity: RecentActivity[];
}

interface PlatformMetrics {
  agentExecutions: number;
  totalTokens: number;
  leadsGenerated: number;
  contentGenerated: number;
  bookings: number;
  playbooks: {
    total: number;
    succeeded: number;
    failed: number;
    avgDurationMs: number;
  };
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Generate last N days as date keys */
function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getDateKey(d.toISOString()));
  }
  return days;
}

/* ──────────────────────────────────────────────
   Stat Card
   ────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: "up" | "down" | "flat";
  delay?: number;
}) {
  const colorMap: Record<string, { border: string; bg: string; icon: string }> =
    {
      emerald: {
        border: "border-emerald-500/10",
        bg: "bg-emerald-500/[0.03]",
        icon: "text-emerald-400",
      },
      cyan: {
        border: "border-cyan-500/10",
        bg: "bg-cyan-500/[0.03]",
        icon: "text-cyan-400",
      },
      violet: {
        border: "border-violet-500/10",
        bg: "bg-violet-500/[0.03]",
        icon: "text-violet-400",
      },
      amber: {
        border: "border-amber-500/10",
        bg: "bg-amber-500/[0.03]",
        icon: "text-amber-400",
      },
      red: {
        border: "border-red-500/10",
        bg: "bg-red-500/[0.03]",
        icon: "text-red-400",
      },
    };
  const c = colorMap[color] || colorMap.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`p-5 rounded-2xl border ${c.border} ${c.bg} backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        {trend && (
          <div
            className={`flex items-center gap-0.5 text-[10px] ${
              trend === "up"
                ? "text-emerald-400"
                : trend === "down"
                  ? "text-red-400"
                  : "text-neutral-500"
            }`}
          >
            {trend === "up" && <ArrowUp className="w-3 h-3" />}
            {trend === "down" && <ArrowDown className="w-3 h-3" />}
            {trend === "flat" && <Minus className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div className="text-2xl font-black text-white mb-0.5">{value}</div>
      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
        {label}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Skeleton Loader
   ────────────────────────────────────────────── */

// Stable deterministic heights so the skeleton renders the same on every
// pass (react-hooks/purity wants pure render; Math.random() during render
// is impure). Pattern echoes a real chart silhouette without the impurity.
const SKELETON_HEIGHTS = [
  42, 58, 36, 71, 49, 64, 31, 55, 68, 44, 39, 62, 51, 47,
];

function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={`${height} rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse flex items-end gap-2 p-6`}
    >
      {SKELETON_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 bg-white/[0.04] rounded-t"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────
   CSS Bar Chart — Runs Over Time (14 days)
   ────────────────────────────────────────────── */

function RunsOverTimeChart({ runs }: { runs: PlaybookRun[] }) {
  const days = lastNDays(14);

  const buckets = useMemo(() => {
    const map: Record<
      string,
      { done: number; failed: number; running: number }
    > = {};
    for (const d of days) map[d] = { done: 0, failed: 0, running: 0 };
    for (const run of runs) {
      const key = getDateKey(run.createdAt);
      if (!map[key]) continue;
      if (run.status === "done" || run.status === "succeeded") map[key].done++;
      else if (run.status === "failed") map[key].failed++;
      else map[key].running++;
    }
    return days.map((d) => ({ day: d, ...map[d] }));
  }, [runs, days]);

  const maxVal = Math.max(
    1,
    ...buckets.map((b) => b.done + b.failed + b.running),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Runs Over Time</h3>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Playbook executions — last 14 days
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-neutral-500">Done</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-neutral-500">Failed</span>
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5 h-48">
        {buckets.map((b, i) => {
          const total = b.done + b.failed + b.running;
          const donePct = (b.done / maxVal) * 100;
          const failedPct = (b.failed / maxVal) * 100;
          return (
            <motion.div
              key={b.day}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
              style={{ originY: 1 }}
              className="flex-1 flex flex-col justify-end h-full group relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-800 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {getDayLabel(b.day)}: {total} run{total !== 1 ? "s" : ""}
              </div>
              {/* Failed segment */}
              {failedPct > 0 && (
                <div
                  className="w-full bg-red-500/60 rounded-t transition-all duration-300"
                  style={{
                    height: `${failedPct}%`,
                    minHeight: failedPct > 0 ? 2 : 0,
                  }}
                />
              )}
              {/* Done segment */}
              <div
                className="w-full bg-emerald-500/70 rounded-t transition-all duration-300"
                style={{
                  height: `${donePct}%`,
                  minHeight: total > 0 ? 3 : 0,
                  borderRadius: failedPct > 0 ? 0 : undefined,
                }}
              />
              {/* Day label */}
              <div className="text-[8px] text-neutral-600 text-center mt-2 truncate">
                {getDayLabel(b.day).split(" ")[1]}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty state overlay */}
      {runs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-neutral-600">No runs recorded yet</p>
        </div>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Horizontal Bar Chart — Model Usage Breakdown
   ────────────────────────────────────────────── */

function ModelUsageChart({ activity }: { activity: RecentActivity[] }) {
  const modelCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of activity) {
      const name = a.model || "unknown";
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [activity]);

  const maxCount = Math.max(1, ...modelCounts.map(([, c]) => c));

  const colors = [
    "bg-emerald-400",
    "bg-cyan-400",
    "bg-violet-400",
    "bg-amber-400",
    "bg-rose-400",
    "bg-teal-400",
    "bg-indigo-400",
    "bg-orange-400",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
    >
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white">Model Usage</h3>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          Which AI models are handling your tasks
        </p>
      </div>

      {modelCounts.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <Cpu className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
            <p className="text-xs text-neutral-600">No model usage data yet</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {modelCounts.map(([model, count], i) => {
            const pct = (count / maxCount) * 100;
            // Clean up model name for display
            const displayName = model.split("/").pop() || model;
            return (
              <motion.div
                key={model}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-neutral-300 truncate max-w-[65%] font-mono">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-neutral-500 tabular-nums">
                    {count} call{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.6,
                      delay: 0.1 + 0.05 * i,
                      ease: "easeOut",
                    }}
                    className={`h-full rounded-full ${colors[i % colors.length]} opacity-80`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Top Agents — Ranked list
   ────────────────────────────────────────────── */

function TopAgentsChart({ runs }: { runs: PlaybookRun[] }) {
  const agentStats = useMemo(() => {
    const map: Record<string, { total: number; succeeded: number }> = {};
    for (const run of runs) {
      for (const step of run.steps) {
        const name = step.agentName;
        if (!map[name]) map[name] = { total: 0, succeeded: 0 };
        map[name].total++;
        if (step.status === "done" || step.status === "succeeded")
          map[name].succeeded++;
      }
    }
    return Object.entries(map)
      .map(([name, s]) => ({
        name,
        total: s.total,
        succeeded: s.succeeded,
        rate: s.total > 0 ? Math.round((s.succeeded / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [runs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
    >
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white">Top Agents</h3>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          Most-used agents by step execution count
        </p>
      </div>

      {agentStats.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-center">
            <Bot className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
            <p className="text-xs text-neutral-600">No agent data yet</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {agentStats.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.04 * i }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
            >
              {/* Rank */}
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                  i === 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : i === 1
                      ? "bg-cyan-500/20 text-cyan-400"
                      : i === 2
                        ? "bg-violet-500/20 text-violet-400"
                        : "bg-white/[0.05] text-neutral-500"
                }`}
              >
                {i + 1}
              </div>
              {/* Name + runs */}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-neutral-200 font-medium truncate">
                  {agent.name}
                </div>
                <div className="text-[9px] text-neutral-600">
                  {agent.total} execution{agent.total !== 1 ? "s" : ""}
                </div>
              </div>
              {/* Success rate badge */}
              <div
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  agent.rate >= 90
                    ? "bg-emerald-500/15 text-emerald-400"
                    : agent.rate >= 70
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400"
                }`}
              >
                {agent.rate}%
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   SVG Line Chart — Success Rate Trend
   ────────────────────────────────────────────── */

function SuccessRateTrend({ runs }: { runs: PlaybookRun[] }) {
  const days = lastNDays(14);

  const points = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const d of days) map[d] = { done: 0, total: 0 };
    for (const run of runs) {
      const key = getDateKey(run.createdAt);
      if (!map[key]) continue;
      map[key].total++;
      if (run.status === "done" || run.status === "succeeded") map[key].done++;
    }
    return days.map((d) => ({
      day: d,
      rate:
        map[d].total > 0
          ? Math.round((map[d].done / map[d].total) * 100)
          : null,
    }));
  }, [runs, days]);

  // SVG dimensions
  const width = 500;
  const height = 160;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build path from non-null points
  const validPoints = points
    .map((p, i) => (p.rate !== null ? { i, rate: p.rate } : null))
    .filter(Boolean) as { i: number; rate: number }[];

  const pathD = validPoints
    .map((p, idx) => {
      const x = padding.left + (p.i / (points.length - 1)) * chartW;
      const y = padding.top + chartH - (p.rate / 100) * chartH;
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Gradient area path
  const areaD =
    validPoints.length > 1
      ? pathD +
        ` L ${padding.left + (validPoints[validPoints.length - 1].i / (points.length - 1)) * chartW} ${padding.top + chartH}` +
        ` L ${padding.left + (validPoints[0].i / (points.length - 1)) * chartW} ${padding.top + chartH} Z`
      : "";

  const overallRate = useMemo(() => {
    const done = runs.filter(
      (r) => r.status === "done" || r.status === "succeeded",
    ).length;
    return runs.length > 0 ? Math.round((done / runs.length) * 100) : null;
  }, [runs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Success Rate Trend
          </h3>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            Done vs failed ratio — last 14 days
          </p>
        </div>
        {overallRate !== null && (
          <div
            className={`text-xl font-black ${
              overallRate >= 90
                ? "text-emerald-400"
                : overallRate >= 70
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {overallRate}%
          </div>
        )}
      </div>

      {validPoints.length < 2 ? (
        <div className="h-40 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
            <p className="text-xs text-neutral-600">
              Need at least 2 days of data
            </p>
          </div>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = padding.top + chartH - (pct / 100) * chartH;
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="white"
                  strokeOpacity={0.04}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#525252"
                  fontSize="8"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* X-axis labels (every other day) */}
          {points.map((p, i) => {
            if (i % 2 !== 0) return null;
            const x = padding.left + (i / (points.length - 1)) * chartW;
            return (
              <text
                key={p.day}
                x={x}
                y={height - 4}
                textAnchor="middle"
                fill="#525252"
                fontSize="8"
              >
                {getDayLabel(p.day).split(" ")[1]}
              </text>
            );
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* Line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
          />

          {/* Dots */}
          {validPoints.map((p, idx) => {
            const x = padding.left + (p.i / (points.length - 1)) * chartW;
            const y = padding.top + chartH - (p.rate / 100) * chartH;
            return (
              <motion.circle
                key={p.i}
                cx={x}
                cy={y}
                r="3"
                fill="#030303"
                stroke="#10b981"
                strokeWidth="1.5"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + idx * 0.06 }}
              />
            );
          })}
        </svg>
      )}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [runs, setRuns] = useState<PlaybookRun[]>([]);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [statsRes, runsRes] = await Promise.all([
        fetch("/api/agents/dashboard-stats").then((r) =>
          r.ok ? r.json() : { stats: {} },
        ),
        fetch("/api/playbooks/runs").then((r) =>
          r.ok ? r.json() : { runs: [] },
        ),
      ]);

      const stats = statsRes.stats ?? statsRes;
      const allRuns: PlaybookRun[] = runsRes.runs || [];

      const succeeded = allRuns.filter(
        (r) => r.status === "done" || r.status === "succeeded",
      );
      const failed = allRuns.filter((r) => r.status === "failed");
      const durations = allRuns
        .filter((r) => r.durationMs)
        .map((r) => r.durationMs!);

      setMetrics({
        agentExecutions: stats.agentExecutions || 0,
        totalTokens: stats.totalTokens || 0,
        leadsGenerated: stats.leadsGenerated || 0,
        contentGenerated: stats.contentGenerated || 0,
        bookings: stats.bookings || 0,
        playbooks: {
          total: allRuns.length,
          succeeded: succeeded.length,
          failed: failed.length,
          avgDurationMs:
            durations.length > 0
              ? Math.round(
                  durations.reduce((s, d) => s + d, 0) / durations.length,
                )
              : 0,
        },
      });

      setRuns(allRuns);
      setActivity(statsRes.recentActivity || []);
      setLastUpdated(new Date());
    } catch {
      // Silent fail — keep existing data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const iv = setInterval(() => fetchMetrics(true), 60000);
    return () => clearInterval(iv);
  }, [fetchMetrics]);

  const hasData =
    metrics && (metrics.agentExecutions > 0 || metrics.playbooks.total > 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <BarChart3 className="w-3 h-3" /> Analytics
          </div>
          <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {hasData
              ? "Real-time metrics from your agent executions and playbook runs."
              : "Run your first playbook to see analytics here."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {lastUpdated && (
            <p className="text-[10px] text-neutral-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={() => fetchMetrics()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Skeleton stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
                >
                  <div className="h-3 w-8 bg-white/[0.04] rounded mb-3" />
                  <div className="h-6 w-14 bg-white/[0.04] rounded mb-2" />
                  <div className="h-2 w-20 bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
            {/* Skeleton charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="loaded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* ── Summary Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Agent Executions"
                value={metrics?.agentExecutions?.toLocaleString() || "0"}
                icon={Zap}
                color="emerald"
                trend={hasData ? "up" : "flat"}
                delay={0}
              />
              <StatCard
                label="Leads Generated"
                value={metrics?.leadsGenerated?.toLocaleString() || "0"}
                icon={Target}
                color="cyan"
                trend={hasData ? "up" : "flat"}
                delay={0.05}
              />
              <StatCard
                label="Content Created"
                value={metrics?.contentGenerated?.toLocaleString() || "0"}
                icon={FileText}
                color="violet"
                trend={hasData ? "up" : "flat"}
                delay={0.1}
              />
              <StatCard
                label="Meetings Booked"
                value={metrics?.bookings?.toLocaleString() || "0"}
                icon={CheckCircle2}
                color="amber"
                trend={hasData ? "up" : "flat"}
                delay={0.15}
              />
            </div>

            {/* ── Playbook Summary Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Playbook Runs"
                value={metrics?.playbooks.total.toString() || "0"}
                icon={Layers}
                color="emerald"
                delay={0.2}
              />
              <StatCard
                label="Succeeded"
                value={metrics?.playbooks.succeeded.toString() || "0"}
                icon={CheckCircle2}
                color="emerald"
                delay={0.25}
              />
              <StatCard
                label="Failed"
                value={metrics?.playbooks.failed.toString() || "0"}
                icon={XCircle}
                color="red"
                delay={0.3}
              />
              <StatCard
                label="Avg Duration"
                value={
                  metrics?.playbooks.avgDurationMs
                    ? formatDuration(metrics.playbooks.avgDurationMs)
                    : "--"
                }
                icon={Clock}
                color="cyan"
                delay={0.35}
              />
            </div>

            {/* ── Charts Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 1. Runs Over Time */}
              <RunsOverTimeChart runs={runs} />

              {/* 2. Model Usage Breakdown */}
              <ModelUsageChart activity={activity} />

              {/* 3. Success Rate Trend */}
              <SuccessRateTrend runs={runs} />

              {/* 4. Top Agents */}
              <TopAgentsChart runs={runs} />
            </div>

            {/* ── Infrastructure Strip ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
            >
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
                <Cpu className="w-4 h-4 text-emerald-400 mb-2" />
                <div className="text-lg font-bold text-white">39+</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Models available
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
                <Activity className="w-4 h-4 text-cyan-400 mb-2" />
                <div className="text-lg font-bold text-white">130</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Agents deployed
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
                <Sparkles className="w-4 h-4 text-violet-400 mb-2" />
                <div className="text-lg font-bold text-white">
                  {metrics?.totalTokens
                    ? (metrics.totalTokens / 1000).toFixed(0) + "K"
                    : "--"}
                </div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Total tokens used
                </div>
              </div>
            </motion.div>

            {/* ── Empty state CTA ── */}
            {!hasData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="p-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] backdrop-blur-xl text-center"
              >
                <Zap className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">
                  No data yet
                </h3>
                <p className="text-sm text-neutral-400 mb-4 max-w-md mx-auto">
                  Run your first playbook or agent to start seeing real
                  analytics. Every execution is tracked and visualized here.
                </p>
                <a
                  href="/dashboard/playbooks"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-semibold rounded-xl text-sm hover:bg-emerald-400 transition-colors"
                >
                  Run a Playbook
                </a>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

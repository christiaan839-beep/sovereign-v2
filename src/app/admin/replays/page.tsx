/**
 * /admin/replays — recent agent execution traces (admin view).
 *
 * Server-rendered list of replay traces stored in the in-memory
 * replay index (src/lib/agent-replay.ts). Each trace shows:
 *
 *   - agent name, duration, status
 *   - timestamp, number of steps
 *   - a link to /admin/replays/[id] for the step-by-step drilldown
 *
 * By default shows the admin's own replays. Admins can filter to a
 * specific user via ?userId=... (intentional narrow scope — even
 * admins don't get a firehose of all users' data without picking one).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { getUserReplays } from "@/lib/agent-replay";

type SP = Promise<{ userId?: string }>;

export const metadata = {
  title: "Replays — Admin",
  robots: { index: false, follow: false },
};

function fmtDuration(ms: number | undefined): string {
  if (typeof ms !== "number") return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { userId: adminUserId } = await auth();
  if (!isAdmin(adminUserId)) notFound();

  const sp = await searchParams;
  const filterUserId = sp.userId ?? adminUserId ?? "";
  const traces = getUserReplays(filterUserId, 100);

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Admin
          </p>
          <h1 className="ed-display text-5xl mb-3" style={{ color: "var(--ed-ink)" }}>
            Replays
          </h1>
          <p className="ed-body max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Step-by-step execution traces for recent agent runs. Debug,
            audit, or rerun any recorded invocation. Scope:{" "}
            <span className="ed-mono">{filterUserId || "(none)"}</span>.
          </p>
        </header>

        {traces.length === 0 ? (
          <EmptyState filterUserId={filterUserId} />
        ) : (
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <div
              className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>Started</span>
              <span>Agent</span>
              <span>Status</span>
              <span>Duration</span>
              <span className="text-right">Steps</span>
            </div>
            {traces.map((t) => (
              <Link
                key={t.id}
                href={`/admin/replays/${t.id}${filterUserId ? `?userId=${encodeURIComponent(filterUserId)}` : ""}`}
                className="grid grid-cols-[1.5fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-baseline transition-colors hover:bg-[var(--ed-bg-raised)]"
                style={{ borderBottom: "1px solid var(--ed-rule)" }}
              >
                <span className="ed-mono text-xs" style={{ color: "var(--ed-ink-soft)" }}>
                  {fmtDate(t.startedAt)}
                </span>
                <span className="ed-body text-sm" style={{ color: "var(--ed-ink)" }}>
                  {t.agentName}
                </span>
                <span
                  className="ed-mono text-xs"
                  style={{
                    color:
                      t.status === "complete"
                        ? "var(--ed-ink)"
                        : t.status === "failed"
                        ? "var(--ed-copper)"
                        : "var(--ed-ink-soft)",
                  }}
                >
                  {t.status}
                </span>
                <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
                  {fmtDuration(t.totalDurationMs)}
                </span>
                <span className="ed-mono text-sm text-right" style={{ color: "var(--ed-copper)" }}>
                  {t.steps.length}
                </span>
              </Link>
            ))}
          </div>
        )}

        <footer
          className="mt-10 pt-6 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link href="/admin/metrics" className="transition-colors hover:text-[var(--ed-copper)]">
            ← Metrics
          </Link>
          <Link href="/admin/creator-submissions" className="transition-colors hover:text-[var(--ed-copper)]">
            Review queue
          </Link>
          <span>
            Replays are stored in-memory per instance. Persistence ships
            in a later migration.
          </span>
        </footer>
      </div>
    </div>
  );
}

function EmptyState({ filterUserId }: { filterUserId: string }) {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        color: "var(--ed-ink-soft)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-body mb-3">
        No replays for <span className="ed-mono">{filterUserId || "(no user)"}</span>.
      </p>
      <p className="ed-caption">
        Replays are captured when a user runs agents via the factory route
        handler. Each Vercel instance keeps its own in-memory buffer.
      </p>
    </div>
  );
}

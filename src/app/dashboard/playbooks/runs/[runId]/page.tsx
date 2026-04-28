/**
 * /dashboard/playbooks/runs/[runId] — single-run forensic detail.
 *
 * Server component. Hits getDagRun() directly (no HTTP hop) and renders
 * a static read-only view of:
 *
 *   - Run metadata (status, total duration, started_at, failed_at)
 *   - The frozen DAG snapshot (read-only) — the SHAPE that ran, not
 *     the live DAG which may have been edited since
 *   - Per-node results: status / duration / output / error / confidence
 *     and tokenBudget pills extracted from _meta when present
 *
 * Why server-rendered: this is a forensic / audit view. The data is
 * static (a row in playbook_dag_runs), the user is authenticated (we
 * use auth() server-side), and there's no interactivity beyond
 * "expand the JSON output" — which a single client component handles.
 *
 * The page deliberately mirrors the editor's results panel so users
 * see the same shape they saw at run time. Same ConfidenceBadge,
 * same TokenBudgetMeter — just rendered from stored data instead of
 * fresh fetch.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getDagRun } from "@/lib/playbook-dag-store";
import { ConfidenceBadge } from "@/components/agent/ConfidenceBadge";
import { TokenBudgetMeter } from "@/components/agent/TokenBudgetMeter";
import { extractConfidence, extractTokenBudget } from "@/lib/agent-meta";
import { computeRunCostBreakdown } from "@/lib/run-cost-actual";
import { formatCents } from "@/lib/agent-pricing-estimate";
import { RunOutputDetail } from "./RunOutputDetail";
import { RunDetailRefresher } from "./RunDetailRefresher";
import { RunShareManager } from "./RunShareManager";

interface PageProps {
  params: Promise<{ runId: string }>;
}

export const dynamic = "force-dynamic"; // userId-scoped; never cache

export default async function RunDetailPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const { runId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    notFound();
  }

  const run = await getDagRun({ id: runId, userId });
  if (!run) notFound();

  const succeeded = run.status === "completed";
  const inFlight = run.status === "running";
  const startedAt = new Date(run.createdAt);
  const completedNodes = run.results.filter((r) => r.status === "completed").length;
  const failedNodes = run.results.filter((r) => r.status === "failed").length;
  const skippedNodes = run.results.filter((r) => r.status === "skipped").length;

  // Round 16 — cost breakdown derived from stored _meta.tokenBudget.
  // "actual" = every node had real telemetry; "estimated" = none did
  // (rare for AI agents); "mixed" = some did, some didn't.
  const costBreakdown = inFlight
    ? null
    : computeRunCostBreakdown({
        results: run.results,
        dagSnapshot: run.dagSnapshot,
      });

  // Status display config — three terminal states + one in-flight.
  // Centralizing these constants here keeps the render below clean.
  const statusGlyph = inFlight ? "⟳" : succeeded ? "✓" : "✗";
  const statusColor = inFlight
    ? "text-amber-300"
    : succeeded
      ? "text-emerald-300"
      : "text-rose-300";
  const statusBadgeColor = inFlight
    ? "text-amber-400"
    : succeeded
      ? "text-emerald-400"
      : "text-rose-400";

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-neutral-200">
      {/*
        Auto-refresh while running. The component renders nothing —
        it's a pure side-effect island that calls router.refresh()
        every 2s when status='running' and otherwise stays inert.
      */}
      <RunDetailRefresher status={run.status} />

      <header className="mb-6">
        <div className="flex items-baseline gap-3 text-xs">
          <Link
            href={run.dagId ? `/dashboard/playbooks/edit/${run.dagId}` : "/dashboard/playbooks"}
            className="text-neutral-500 hover:text-neutral-300"
          >
            ← {run.dagId ? "Back to playbook" : "Playbooks"}
          </Link>
          <span className="text-neutral-600 font-mono">{runId.slice(0, 8)}</span>
        </div>

        <h1 className="mt-3 flex items-baseline gap-3 text-2xl font-bold">
          <span
            className={`${statusColor} ${inFlight ? "animate-pulse" : ""}`}
            aria-label={run.status}
          >
            {statusGlyph}
          </span>
          <span>Playbook run</span>
          <span className={`text-xs uppercase tracking-wider ${statusBadgeColor}`}>
            {run.status}
          </span>
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          {inFlight ? (
            <>
              {run.progressNodesCompleted} of {run.nodeCount} nodes complete
              {" — "}
              <span className="text-amber-400">in flight</span>
            </>
          ) : (
            <>
              {run.nodeCount} node{run.nodeCount === 1 ? "" : "s"}
              {", "}
              {run.edgeCount} edge{run.edgeCount === 1 ? "" : "s"}
              {" — "}
              {formatDuration(run.totalDurationMs)} total
              {run.failedAt === "__orphaned__" ? (
                // Orphan-cleanup sentinel from /api/cron/dag-orphan-cleanup.
                // Distinguished from real node failures so support /
                // procurement understands "infra ate the function" vs
                // "agent threw" — different SLO categories.
                <>
                  {" — "}
                  <span className="text-amber-400">
                    orphaned (worker timeout)
                  </span>
                </>
              ) : (
                run.failedAt && (
                  <>
                    {" — "}
                    <span className="text-rose-400">
                      failed at node {run.failedAt}
                    </span>
                  </>
                )
              )}
            </>
          )}
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Started <time dateTime={run.createdAt}>{startedAt.toLocaleString()}</time>
          {inFlight && (
            <span className="ml-2 text-amber-400">
              · auto-refreshing every 2s
            </span>
          )}
        </p>
      </header>

      {/*
        Quick stats row. Each card shows one dimension so the eye
        gets a status read in 200ms before scrolling into per-node
        detail. Cost card appears for non-running runs.
      */}
      <section
        className={`grid gap-3 mb-6 ${costBreakdown ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}
      >
        <StatCard
          label="Completed"
          value={completedNodes}
          tone={completedNodes > 0 ? "emerald" : "neutral"}
        />
        <StatCard
          label="Failed"
          value={failedNodes}
          tone={failedNodes > 0 ? "rose" : "neutral"}
        />
        <StatCard
          label="Skipped"
          value={skippedNodes}
          tone={skippedNodes > 0 ? "amber" : "neutral"}
        />
        {costBreakdown && (
          <CostCard
            label={
              costBreakdown.kind === "actual"
                ? "Cost (actual)"
                : costBreakdown.kind === "estimated"
                  ? "Cost (estimated)"
                  : "Cost (mixed)"
            }
            cents={costBreakdown.totalCents}
            sublabel={
              costBreakdown.kind === "mixed"
                ? `${costBreakdown.actualNodeCount} actual · ${costBreakdown.estimatedNodeCount} estimated`
                : costBreakdown.kind === "estimated"
                  ? "from declared providers"
                  : "from telemetry"
            }
          />
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <header className="flex items-baseline justify-between border-b border-white/5 pb-3">
          <h2 className="text-sm font-semibold text-neutral-200">Per-node results</h2>
          <span className="text-xs text-neutral-500">
            in topological execution order
          </span>
        </header>

        <ol className="mt-4 space-y-2">
          {run.results.map((r) => {
            const isTruncated = isTruncatedOutput(r.output);
            return (
              <li
                key={r.nodeId}
                className="flex items-start gap-3 rounded border border-white/5 bg-white/[0.01] p-3"
              >
                <span
                  className={`text-xs font-mono shrink-0 ${
                    r.status === "completed"
                      ? "text-emerald-400"
                      : r.status === "failed"
                        ? "text-rose-400"
                        : "text-neutral-500"
                  }`}
                  aria-label={r.status}
                >
                  {r.status === "completed" ? "✓" : r.status === "failed" ? "✗" : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-300">{r.nodeId}</span>
                    <span className="text-xs text-neutral-500">{r.agent}</span>
                    <ConfidenceBadge confidence={extractConfidence(r.output)} compact />
                    <TokenBudgetMeter budget={extractTokenBudget(r.output)} compact />
                    <span className="text-xs text-neutral-600 font-mono ml-auto">
                      {formatDuration(r.durationMs)}
                    </span>
                  </div>
                  {r.error && (
                    <p className="mt-1 text-xs text-rose-300 break-words">{r.error}</p>
                  )}
                  {r.output !== undefined && (
                    <RunOutputDetail output={r.output} truncated={isTruncated} />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/*
        DAG snapshot section. We render the JSON of the frozen DAG
        (not the live one) — this is the audit property: "what shape
        actually executed?". A future iteration can render this as a
        read-only React Flow canvas; for now the JSON view is correct
        and explicit.
      */}
      <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <header className="border-b border-white/5 pb-3">
          <h2 className="text-sm font-semibold text-neutral-200">DAG snapshot</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            The frozen shape that ran — not the live playbook (which may have
            been edited since this execution).
          </p>
        </header>
        <details className="mt-3">
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">
            View {run.dagSnapshot.nodes.length} nodes / {run.dagSnapshot.edges.length} edges
          </summary>
          <pre className="mt-3 overflow-auto rounded bg-black/40 p-3 text-[11px] text-neutral-300 max-h-96">
            {JSON.stringify(run.dagSnapshot, null, 2)}
          </pre>
        </details>
      </section>

      {/*
        Appeal CTA — only when the run failed. Successful runs don't
        usually need to be appealed. Deep-links the appeals page with
        the run prefilled. Closes FMTI's user-appeal subdomain on the
        SURFACE side: the path from "this is wrong" to "I have filed
        a request" is one click.
      */}
      {!inFlight && !succeeded && (
        <section className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
                Think this run was wrongly blocked or failed?
              </h3>
              <p className="mt-1 text-xs text-amber-300/80">
                File an appeal — a human reviewer responds within 5 business days.
              </p>
            </div>
            <Link
              href={`/dashboard/appeals?targetKind=run&targetId=${runId}`}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400"
            >
              Request review →
            </Link>
          </div>
        </section>
      )}

      {/*
        Round 23 — compare with another run. Helps the regression-
        diagnosis workflow ("what changed between this run and the
        last good one"). Only meaningful for terminal-state runs +
        runs that belong to a saved DAG (the comparison aligns nodes
        by ID, which requires a stable parent).
      */}
      {!inFlight && run.dagId && (
        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">
                Compare with another run
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Diff per-node results to spot regressions, recoveries,
                and slowdowns.
              </p>
            </div>
            <Link
              href={`/dashboard/playbooks/runs?dagId=${run.dagId}`}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline"
            >
              Pick another run →
            </Link>
          </div>
        </section>
      )}

      {/*
        Round 15 — share management. Only render once the run is no
        longer in flight; sharing a still-running run produces a
        moving target that's confusing for the recipient.
      */}
      {!inFlight && <RunShareManager runId={runId} />}

      {/*
        Footer linking back to the parent DAG (if it still exists) AND
        a hint about archive behavior. The dagId can be NULL after the
        parent is archived; the snapshot above still tells the full
        story.
      */}
      <footer className="mt-8 text-xs text-neutral-500">
        {run.dagId ? (
          <p>
            Source playbook:{" "}
            <Link
              href={`/dashboard/playbooks/edit/${run.dagId}`}
              className="text-neutral-300 hover:underline"
            >
              {run.dagId.slice(0, 8)}…
            </Link>
          </p>
        ) : (
          <p>
            Source playbook is archived or was never saved. The snapshot above is
            the authoritative record of what executed.
          </p>
        )}
        <p className="mt-2">
          Audit-chain row hash:{" "}
          <code className="text-neutral-400">tracked in audit_logs</code>{" "}
          <Link href="/trust/audit" className="hover:underline">
            (verify chain →)
          </Link>
        </p>
      </footer>
    </main>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
}

function isTruncatedOutput(output: unknown): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    (output as { __truncated?: boolean }).__truncated === true
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "amber" | "neutral";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    neutral: "text-neutral-400",
  }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

/**
 * Cost variant of StatCard. Distinct enough from a counter that we
 * give it its own component — formats the value via formatCents and
 * adds a sublabel for the source ("from telemetry" / "estimated").
 */
function CostCard({
  label,
  cents,
  sublabel,
}: {
  label: string;
  cents: number;
  sublabel: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-sky-300">
        {formatCents(cents)}
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">{sublabel}</div>
    </div>
  );
}

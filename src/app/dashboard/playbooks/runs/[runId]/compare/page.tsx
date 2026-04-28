/**
 * /dashboard/playbooks/runs/[runId]/compare?with=<otherRunId>
 *
 * Side-by-side diff of two runs of the same DAG. Answers the
 * single most-asked question after a regression: "what changed
 * between when this worked and when it broke?"
 *
 * Server component — pure read-side, no interactivity needed.
 *
 * Both runs must:
 *   - Be owned by the requesting user (tenant isolation)
 *   - Belong to the same parent DAG (otherwise the comparison is
 *     meaningless — different DAGs have different node sets)
 *   - Have status='completed' or 'failed' (running runs would
 *     produce a moving target)
 *
 * The diff aligns nodes by `nodeId` from the dagSnapshot. Per node:
 *   - Status (completed → failed = regression flag)
 *   - Duration delta (% change, color-coded)
 *   - Output diff (collapsed JSON, expandable)
 *   - Error if either side errored
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getDagRun } from "@/lib/playbook-dag-store";

interface PageProps {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ with?: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Compare runs — Sovereign Matrix",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompareRunsPage({ params, searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { runId } = await params;
  const { with: otherRunIdRaw } = await searchParams;
  if (!UUID_RE.test(runId)) notFound();
  if (!otherRunIdRaw || !UUID_RE.test(otherRunIdRaw)) {
    return <MissingTargetView runId={runId} />;
  }

  const [a, b] = await Promise.all([
    getDagRun({ id: runId, userId }),
    getDagRun({ id: otherRunIdRaw, userId }),
  ]);
  if (!a || !b) notFound();

  // Same DAG only — different DAGs have different node sets and the
  // comparison is meaningless.
  if (a.dagId !== b.dagId) {
    return <DifferentDagView a={a.id} b={b.id} />;
  }

  // Order by createdAt — left = older, right = newer (typical
  // regression view: "what worked yesterday vs what broke today").
  const earlier = new Date(a.createdAt) <= new Date(b.createdAt) ? a : b;
  const later = earlier === a ? b : a;

  // Build a node-by-node diff.
  const nodeIds = Array.from(
    new Set([
      ...earlier.dagSnapshot.nodes.map((n) => n.id),
      ...later.dagSnapshot.nodes.map((n) => n.id),
    ]),
  );

  const rowsByNodeId = new Map<
    string,
    {
      agent: string;
      earlier: ReturnType<typeof findResult>;
      later: ReturnType<typeof findResult>;
    }
  >();
  for (const id of nodeIds) {
    const earlierResult = findResult(earlier.results, id);
    const laterResult = findResult(later.results, id);
    const agent =
      earlier.dagSnapshot.nodes.find((n) => n.id === id)?.agent ??
      later.dagSnapshot.nodes.find((n) => n.id === id)?.agent ??
      "(unknown)";
    rowsByNodeId.set(id, { agent, earlier: earlierResult, later: laterResult });
  }

  const regressions = Array.from(rowsByNodeId.entries()).filter(
    ([, row]) =>
      row.earlier?.status === "completed" && row.later?.status === "failed",
  );
  const recoveries = Array.from(rowsByNodeId.entries()).filter(
    ([, row]) =>
      row.earlier?.status === "failed" && row.later?.status === "completed",
  );
  const slowdowns = Array.from(rowsByNodeId.entries()).filter(([, row]) => {
    if (!row.earlier?.durationMs || !row.later?.durationMs) return false;
    if (row.earlier.durationMs < 100) return false; // ignore noise on fast nodes
    return row.later.durationMs > row.earlier.durationMs * 1.5;
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-neutral-200">
      <header className="mb-6">
        <Link
          href={`/dashboard/playbooks/runs/${later.id}`}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← Back to run
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Compare runs</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {earlier.id.slice(0, 8)}… ({new Date(earlier.createdAt).toLocaleString()})
          {" → "}
          {later.id.slice(0, 8)}… ({new Date(later.createdAt).toLocaleString()})
        </p>
      </header>

      {/* ─── Summary cards ─── */}
      <section className="grid grid-cols-3 gap-3 mb-8">
        <SummaryCard
          label="Regressions"
          count={regressions.length}
          tone={regressions.length > 0 ? "rose" : "neutral"}
          sublabel="completed → failed"
        />
        <SummaryCard
          label="Recoveries"
          count={recoveries.length}
          tone={recoveries.length > 0 ? "emerald" : "neutral"}
          sublabel="failed → completed"
        />
        <SummaryCard
          label="Slowdowns ≥1.5×"
          count={slowdowns.length}
          tone={slowdowns.length > 0 ? "amber" : "neutral"}
          sublabel="duration regressed"
        />
      </section>

      {/* ─── Per-node side-by-side ─── */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <header className="border-b border-white/5 pb-3">
          <h2 className="text-sm font-semibold text-neutral-200">
            Per-node comparison
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Earlier run on the left, later run on the right.
            Regressions are highlighted rose; recoveries emerald; slowdowns
            amber.
          </p>
        </header>

        <ol className="mt-4 space-y-2">
          {Array.from(rowsByNodeId.entries()).map(([nodeId, row]) => {
            const isRegression =
              row.earlier?.status === "completed" && row.later?.status === "failed";
            const isRecovery =
              row.earlier?.status === "failed" && row.later?.status === "completed";
            const isSlowdown =
              !!row.earlier?.durationMs &&
              !!row.later?.durationMs &&
              row.earlier.durationMs >= 100 &&
              row.later.durationMs > row.earlier.durationMs * 1.5;

            const ringClass = isRegression
              ? "ring-1 ring-rose-500/30 bg-rose-500/[0.04]"
              : isRecovery
                ? "ring-1 ring-emerald-500/30 bg-emerald-500/[0.04]"
                : isSlowdown
                  ? "ring-1 ring-amber-500/30 bg-amber-500/[0.04]"
                  : "border border-white/5";

            return (
              <li
                key={nodeId}
                className={`rounded p-3 ${ringClass}`}
              >
                <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-xs text-neutral-300">
                    {nodeId}
                  </span>
                  <span className="text-xs text-neutral-500">{row.agent}</span>
                  {isRegression && (
                    <span className="ml-auto text-xs text-rose-400 uppercase tracking-wider">
                      regression
                    </span>
                  )}
                  {isRecovery && (
                    <span className="ml-auto text-xs text-emerald-400 uppercase tracking-wider">
                      recovery
                    </span>
                  )}
                  {isSlowdown && !isRegression && (
                    <span className="ml-auto text-xs text-amber-400 uppercase tracking-wider">
                      slowdown {((row.later!.durationMs / row.earlier!.durationMs - 1) * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NodeCell label="earlier" result={row.earlier} />
                  <NodeCell label="later" result={row.later} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function findResult(
  results: Array<{
    nodeId: string;
    agent: string;
    status: "completed" | "failed" | "skipped";
    output?: unknown;
    durationMs: number;
    error?: string;
  }>,
  nodeId: string,
) {
  return results.find((r) => r.nodeId === nodeId) ?? null;
}

function NodeCell({
  label,
  result,
}: {
  label: string;
  result: ReturnType<typeof findResult>;
}) {
  if (!result) {
    return (
      <div className="rounded border border-white/5 bg-white/[0.02] p-3 text-xs text-neutral-600 italic">
        {label}: node not present
      </div>
    );
  }
  const statusColor =
    result.status === "completed"
      ? "text-emerald-400"
      : result.status === "failed"
        ? "text-rose-400"
        : "text-neutral-500";
  return (
    <div className="rounded border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <span className={`text-xs ${statusColor}`}>
          {result.status === "completed" ? "✓" : result.status === "failed" ? "✗" : "—"}{" "}
          {result.status}
        </span>
      </div>
      <div className="text-xs text-neutral-400 font-mono">
        {result.durationMs}ms
      </div>
      {result.error && (
        <p className="mt-2 text-xs text-rose-300 break-words">{result.error}</p>
      )}
      {result.output !== undefined && (
        <details className="mt-2">
          <summary className="text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-300">
            output
          </summary>
          <pre className="mt-1 overflow-auto rounded bg-black/40 p-2 text-[10px] text-neutral-300 max-h-32">
            {JSON.stringify(result.output, null, 2).slice(0, 1500)}
          </pre>
        </details>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  tone,
  sublabel,
}: {
  label: string;
  count: number;
  tone: "rose" | "emerald" | "amber" | "neutral";
  sublabel: string;
}) {
  const toneClass = {
    rose: "text-rose-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    neutral: "text-neutral-400",
  }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{count}</div>
      <div className="text-[10px] text-neutral-600">{sublabel}</div>
    </div>
  );
}

// ─── Edge-case views ────────────────────────────────────────────────

function MissingTargetView({ runId }: { runId: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-200 text-center">
      <h1 className="text-xl font-bold mb-3">Pick a run to compare</h1>
      <p className="text-sm text-neutral-400">
        Append <code>?with=&lt;runId&gt;</code> to the URL — the runId of the
        other run you want to diff against this one.
      </p>
      <Link
        href={`/dashboard/playbooks/runs/${runId}`}
        className="mt-6 inline-block text-xs text-neutral-500 hover:text-neutral-300"
      >
        ← Back to run detail
      </Link>
    </main>
  );
}

function DifferentDagView({ a, b }: { a: string; b: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-200 text-center">
      <h1 className="text-xl font-bold mb-3">Cross-DAG comparison not supported</h1>
      <p className="text-sm text-neutral-400">
        Runs <code className="text-xs">{a.slice(0, 8)}…</code> and{" "}
        <code className="text-xs">{b.slice(0, 8)}…</code> belong to different
        playbooks. The diff view aligns nodes by ID, which only makes sense
        within a single DAG.
      </p>
    </main>
  );
}

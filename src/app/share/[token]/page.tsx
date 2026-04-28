/**
 * /share/[token] — public read-only forensic view of a DAG run.
 *
 * NO AUTH REQUIRED. The token in the URL is the secret; the resolver
 * verifies it's not revoked + not expired before rendering.
 *
 * What's rendered:
 *   - Run status, duration, started_at
 *   - Per-node results (status, duration, error, output)
 *   - DAG snapshot (the frozen shape that ran)
 *   - Owner's optional label ("Lawyer review", "Q3 audit")
 *   - Share metadata: expiry, "made on …"
 *
 * What's NOT rendered:
 *   - Any owner-internal data (userId, dagId — even though they're
 *     in the SavedDagRun, we strip them in the response shape)
 *   - The owner's other runs / DAGs
 *   - Any controls (no Run button, no Clone, no edit)
 *   - The audit-chain row hash (internal forensics, not for sharing)
 *
 * The page is intentionally austere. Procurement teams want to know
 * "did this run actually do what the vendor claims?" — they don't
 * need glamour.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveShareToken } from "@/lib/share-token-store";
import { getDagRun } from "@/lib/playbook-dag-store";
import { ConfidenceBadge } from "@/components/agent/ConfidenceBadge";
import { extractConfidence } from "@/lib/agent-meta";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic"; // never cache; resolver bumps counters
export const revalidate = 0;

export const metadata = {
  // Don't index share URLs. They're scoped to a recipient, not the
  // public web. Robots.txt + this meta tag together keep search
  // engines from caching the content.
  robots: { index: false, follow: false, nocache: true },
  title: "Shared playbook run — Sovereign Matrix",
};

export default async function SharedRunPage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolveShareToken({ token });
  if (!resolved) {
    // Generic 404 — never distinguish "expired" from "revoked" from
    // "doesn't exist". Information leak via differential 404 messages
    // would let an attacker enumerate which tokens were valid.
    notFound();
  }

  const run = await getDagRun({
    id: resolved.runId,
    userId: resolved.ownerUserId,
  });
  if (!run) {
    // Edge case: share exists but the run was hard-deleted (cascade
    // didn't fire for some reason). 404 is correct.
    notFound();
  }

  const succeeded = run.status === "completed";
  const inFlight = run.status === "running";
  const completedNodes = run.results.filter(
    (r) => r.status === "completed",
  ).length;
  const failedNodes = run.results.filter((r) => r.status === "failed").length;

  const expiresAt = new Date(resolved.expiresAt);
  const expiresInDays = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000),
  );

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* ─── Public-share banner ─── */}
        <div className="mb-8 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                Shared playbook run · Read-only
              </h2>
              <p className="mt-1 text-xs text-amber-300/70">
                {resolved.label
                  ? `Labeled "${resolved.label}". `
                  : ""}
                Link expires in {expiresInDays} day
                {expiresInDays === 1 ? "" : "s"}.
              </p>
            </div>
            <Link
              href="/"
              className="text-[11px] text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline"
            >
              ↗ Sovereign Matrix
            </Link>
          </div>
        </div>

        {/* ─── Run header ─── */}
        <header className="mb-8">
          <h1 className="flex items-baseline gap-3 text-2xl font-bold">
            <span
              className={
                inFlight
                  ? "text-amber-300 animate-pulse"
                  : succeeded
                    ? "text-emerald-300"
                    : "text-rose-300"
              }
              aria-label={run.status}
            >
              {inFlight ? "⟳" : succeeded ? "✓" : "✗"}
            </span>
            <span>Playbook run</span>
            <span
              className={`text-xs uppercase tracking-wider ${
                inFlight
                  ? "text-amber-400"
                  : succeeded
                    ? "text-emerald-400"
                    : "text-rose-400"
              }`}
            >
              {run.status}
            </span>
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {run.nodeCount} nodes, {run.edgeCount} edges
            {run.totalDurationMs > 0 &&
              ` — ${formatDuration(run.totalDurationMs)} total`}
            {run.failedAt === "__orphaned__" ? (
              <>
                {" — "}
                <span className="text-amber-400">orphaned</span>
              </>
            ) : run.failedAt ? (
              <>
                {" — "}
                <span className="text-rose-400">failed at {run.failedAt}</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Started{" "}
            <time dateTime={run.createdAt}>
              {new Date(run.createdAt).toLocaleString()}
            </time>
          </p>
        </header>

        {/* ─── Stat row ─── */}
        <section className="mb-8 grid grid-cols-3 gap-3">
          <PublicStatCard
            label="Completed"
            value={completedNodes}
            tone={completedNodes > 0 ? "emerald" : "neutral"}
          />
          <PublicStatCard
            label="Failed"
            value={failedNodes}
            tone={failedNodes > 0 ? "rose" : "neutral"}
          />
          <PublicStatCard
            label="Total nodes"
            value={run.nodeCount}
            tone="neutral"
          />
        </section>

        {/* ─── Per-node results ─── */}
        <section className="rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-neutral-200 border-b border-white/5 pb-3">
            Per-node results (topological order)
          </h2>
          <ol className="mt-4 space-y-2">
            {run.results.map((r) => (
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
                >
                  {r.status === "completed"
                    ? "✓"
                    : r.status === "failed"
                      ? "✗"
                      : "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-300">
                      {r.nodeId}
                    </span>
                    <span className="text-xs text-neutral-500">{r.agent}</span>
                    <ConfidenceBadge
                      confidence={extractConfidence(r.output)}
                      compact
                    />
                    <span className="text-xs text-neutral-600 font-mono ml-auto">
                      {formatDuration(r.durationMs)}
                    </span>
                  </div>
                  {r.error && (
                    <p className="mt-1 text-xs text-rose-300 break-words">
                      {r.error}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── DAG snapshot (collapsed) ─── */}
        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-neutral-200 border-b border-white/5 pb-3">
            DAG snapshot
          </h2>
          <p className="mt-2 text-xs text-neutral-500">
            The frozen shape that actually ran. Live playbooks can be
            edited; this snapshot is the authoritative record of what
            executed.
          </p>
          <details className="mt-3">
            <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-300">
              View {run.dagSnapshot.nodes.length} nodes /{" "}
              {run.dagSnapshot.edges.length} edges
            </summary>
            <pre className="mt-3 overflow-auto rounded bg-black/40 p-3 text-[11px] text-neutral-300 max-h-96">
              {JSON.stringify(run.dagSnapshot, null, 2)}
            </pre>
          </details>
        </section>

        {/* ─── Footer ─── */}
        <footer className="mt-12 border-t border-white/10 pt-8 text-xs text-neutral-500">
          <p>
            This is a read-only public link. The owner can revoke it at any
            time, and it auto-expires in {expiresInDays} day
            {expiresInDays === 1 ? "" : "s"}.
          </p>
          <p className="mt-3">
            Want your own platform with verifiable agent runs?{" "}
            <Link
              href="/"
              className="text-[#B5532C] hover:underline underline-offset-2"
            >
              Sovereign Matrix
            </Link>
            .
          </p>
        </footer>
      </div>
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

function PublicStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose" | "neutral";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    neutral: "text-neutral-400",
  }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

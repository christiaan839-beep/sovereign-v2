/**
 * /r/[id]/diff/[other] — side-by-side comparison of two receipts.
 *
 * Primary use: replay-vs-original visual diff. The "regression test
 * for AI" feature — show what changed when the same input was re-run.
 * Differences are highlighted at the field level (input, output,
 * safety, latency).
 *
 * Server-rendered. Visibility gating: BOTH receipts must be either
 * public/unlisted OR owned by the caller. We deliberately do NOT
 * mix visibility levels — comparing a public receipt against a
 * private one would leak which agents the caller has run privately.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Cpu,
  Clock,
  Shield,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { getRun } from "@/lib/agent-runs";
import { auth } from "@clerk/nextjs/server";

interface DiffPageProps {
  params: Promise<{ id: string; other: string }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Receipt diff | Sovereign Matrix",
};

function isUuid(s: string): boolean {
  return /^[0-9a-f-]{32,40}$/i.test(s);
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

interface FieldRow {
  label: string;
  left: string;
  right: string;
  changed: boolean;
}

function diffRow(label: string, left: unknown, right: unknown): FieldRow {
  const a = formatJson(left);
  const b = formatJson(right);
  return { label, left: a, right: b, changed: a !== b };
}

export default async function DiffPage({ params }: DiffPageProps) {
  const { id, other } = await params;
  if (!isUuid(id) || !isUuid(other)) notFound();
  if (id === other) notFound(); // diffing a receipt against itself is a tell

  const [a, b] = await Promise.all([getRun(id), getRun(other)]);
  if (!a || !b) notFound();

  const { userId: callerId } = await auth();
  const requireOwnership = (visibility: string, ownerId: string | null) =>
    visibility === "private" && callerId !== ownerId;

  if (
    requireOwnership(a.visibility, a.userId) ||
    requireOwnership(b.visibility, b.userId)
  ) {
    notFound();
  }

  // Cross-tenant visibility: even if both receipts are public,
  // we surface ownership as part of the metadata so a viewer
  // can tell whether they're comparing within or across tenants.
  const sameTenant = a.userId === b.userId && a.userId !== null;

  const rows: FieldRow[] = [
    diffRow("agent", a.agentName, b.agentName),
    diffRow("model", a.modelUsed, b.modelUsed),
    diffRow("input", a.input, b.input),
    diffRow("output", a.output, b.output),
    diffRow("safetyResult", a.safetyResult, b.safetyResult),
    diffRow("durationMs", a.durationMs, b.durationMs),
    diffRow("trustDecision", a.trustDecision, b.trustDecision),
  ];

  const changedCount = rows.filter((r) => r.changed).length;

  // Detect the "this is a replay" pattern from the input field.
  const aReplayedFrom =
    typeof a.input === "object" && a.input !== null
      ? ((a.input as Record<string, unknown>)._replayedFrom as
          | string
          | undefined)
      : undefined;
  const bReplayedFrom =
    typeof b.input === "object" && b.input !== null
      ? ((b.input as Record<string, unknown>)._replayedFrom as
          | string
          | undefined)
      : undefined;
  const isReplayPair = aReplayedFrom === b.id || bReplayedFrom === a.id;

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href={`/r/${a.id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to receipt
        </Link>

        <header className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-300" />
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300/80">
              Receipt diff{isReplayPair ? " · replay vs original" : ""}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {a.agentName === b.agentName
              ? a.agentName
              : `${a.agentName} ↔ ${b.agentName}`}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            <span
              className={
                changedCount === 0
                  ? "text-emerald-300"
                  : changedCount <= 2
                    ? "text-amber-300"
                    : "text-rose-300"
              }
            >
              {changedCount === 0
                ? "Identical receipts"
                : `${changedCount} field${changedCount === 1 ? "" : "s"} changed`}
            </span>
            {!sameTenant && (
              <span className="ml-3 text-amber-300">
                · cross-tenant comparison
              </span>
            )}
          </p>
        </header>

        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReceiptCard label="Receipt A" run={a} />
          <ReceiptCard label="Receipt B" run={b} />
        </div>

        {/* Field-level diff */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="border-b border-white/[0.06] px-6 py-4">
            <h2 className="text-sm font-medium text-white">Field-by-field</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {rows.map((row) => (
              <div key={row.label} className="px-6 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <code className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    {row.label}
                  </code>
                  {row.changed ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                      changed
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                      identical
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <pre
                    className={`max-h-96 overflow-auto rounded-lg border bg-black/40 p-3 font-mono text-[11px] leading-relaxed ${
                      row.changed
                        ? "border-rose-500/20 text-rose-100"
                        : "border-white/5 text-neutral-400"
                    }`}
                  >
                    {row.left}
                  </pre>
                  <pre
                    className={`max-h-96 overflow-auto rounded-lg border bg-black/40 p-3 font-mono text-[11px] leading-relaxed ${
                      row.changed
                        ? "border-emerald-500/20 text-emerald-100"
                        : "border-white/5 text-neutral-400"
                    }`}
                  >
                    {row.right}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex items-center justify-between">
          <Link
            href={`/r/${a.id}`}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Receipt A
          </Link>
          <Link
            href={`/r/${b.id}`}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-cyan-300"
          >
            Receipt B
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface ReceiptSummary {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  visibility: string;
  trustDecision: string;
  signature: string;
  createdAt: Date | string;
}

function ReceiptCard({ label, run }: { label: string; run: ReceiptSummary }) {
  const created =
    run.createdAt instanceof Date ? run.createdAt : new Date(run.createdAt);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <code className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          {label}
        </code>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
          {run.visibility}
        </span>
      </div>
      <h3 className="mb-2 truncate font-medium text-white">{run.agentName}</h3>
      <div className="flex flex-wrap gap-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <Cpu className="h-3 w-3" />
          {run.modelUsed}
        </span>
        <span className="inline-flex items-center gap-1">
          <Zap className="h-3 w-3" />
          {run.durationMs} ms
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {created.toUTCString()}
        </span>
        {run.trustDecision === "blocked" && (
          <span className="inline-flex items-center gap-1 text-rose-300">
            <AlertTriangle className="h-3 w-3" />
            blocked
          </span>
        )}
      </div>
      <code className="mt-3 block break-all font-mono text-[10px] text-cyan-300/80">
        sig {run.signature.slice(0, 24)}…
      </code>
      <Link
        href={`/r/${run.id}`}
        className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline"
      >
        Open full receipt →
      </Link>
    </div>
  );
}

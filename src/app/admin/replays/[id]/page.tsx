/**
 * /admin/replays/[id] — single replay drill-down.
 *
 * Shows the full step timeline + metadata for a replay trace. Admin
 * can inspect every phase: input → jailbreak check → ai() call →
 * PII scan → quality gate → response. Useful for:
 *
 *   - Debugging: why did this specific run produce that output?
 *   - Auditing: did the safety pipeline actually run?
 *   - Learning: which prompts triggered quality regenerations?
 *
 * The "Rerun" client island lets the admin replay the invocation
 * with an optional input override — fast iteration on prompt tuning
 * without bouncing through the marketplace UI.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { getReplay } from "@/lib/agent-replay";
import { ReplayRerunPanel } from "./ReplayRerunPanel";

type Params = Promise<{ id: string }>;
type SP = Promise<{ userId?: string }>;

export const metadata = {
  title: "Replay — Admin",
  robots: { index: false, follow: false },
};

function fmtDuration(ms: number | undefined): string {
  if (typeof ms !== "number") return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(2)} min`;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  const { id } = await params;
  const sp = await searchParams;
  const trace = getReplay(id);
  if (!trace) notFound();

  // Derive input text if it's surfaced in any step. The factory
  // typically records the user's input under "input-received" or
  // similar; scan the steps for anything that looks like a prompt.
  const firstInputStep = trace.steps.find(
    (s) =>
      typeof s.data?.input === "string" ||
      typeof s.data?.prompt === "string" ||
      typeof s.data?.text === "string",
  );
  const initialRerunInput =
    typeof firstInputStep?.data?.input === "string"
      ? firstInputStep.data.input
      : typeof firstInputStep?.data?.prompt === "string"
      ? firstInputStep.data.prompt
      : typeof firstInputStep?.data?.text === "string"
      ? firstInputStep.data.text
      : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href={`/admin/replays${sp.userId ? `?userId=${encodeURIComponent(sp.userId)}` : ""}`}
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Replays
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Replay
          </p>
          <h1 className="ed-display text-4xl mb-3" style={{ color: "var(--ed-ink)" }}>
            {trace.agentName}
          </h1>
          <p className="ed-caption">
            ID: <span className="ed-mono">{trace.id}</span>
          </p>
        </header>

        {/* Metadata strip */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <MetaField label="Status" value={trace.status} />
          <MetaField label="Steps" value={String(trace.steps.length)} />
          <MetaField label="Total duration" value={fmtDuration(trace.totalDurationMs)} />
          <MetaField
            label="Started"
            value={new Date(trace.startedAt).toLocaleString()}
          />
        </dl>

        {/* Rerun panel */}
        <ReplayRerunPanel
          agentName={trace.agentName}
          initialInput={initialRerunInput}
        />

        {/* Step timeline */}
        <section className="mt-14">
          <h2 className="ed-label mb-5">Timeline</h2>
          <ol className="space-y-3">
            {trace.steps.map((step, i) => (
              <li
                key={i}
                className="p-4"
                style={{
                  border: "1px solid var(--ed-rule)",
                  borderRadius: "2px",
                  background: "var(--ed-bg-raised)",
                }}
              >
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <span
                    className="ed-mono text-sm"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {String(i + 1).padStart(2, "0")} · {step.phase}
                  </span>
                  <span className="ed-caption">
                    {fmtDuration(step.durationMs)}
                    {" · "}
                    +{step.timestamp - trace.startedAt}ms
                  </span>
                </div>
                <pre
                  className="ed-mono text-[11px] whitespace-pre-wrap break-all"
                  style={{ color: "var(--ed-ink-soft)", maxHeight: "160px", overflow: "auto" }}
                >
                  {JSON.stringify(step.data, null, 2).slice(0, 2000)}
                  {JSON.stringify(step.data).length > 2000 && "\n…(truncated)"}
                </pre>
              </li>
            ))}
          </ol>
        </section>

        {/* Metadata */}
        {trace.metadata && (
          <section className="mt-14">
            <h2 className="ed-label mb-5">Metadata</h2>
            <pre
              className="p-4 ed-mono text-[11px] whitespace-pre-wrap"
              style={{
                border: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
                borderRadius: "2px",
              }}
            >
              {JSON.stringify(trace.metadata, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ed-label mb-1" style={{ color: "var(--ed-ink-soft)" }}>
        {label}
      </dt>
      <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
        {value}
      </dd>
    </div>
  );
}

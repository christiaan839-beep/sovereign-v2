"use client";

/**
 * /dashboard/appeals — file + view user appeals.
 *
 * The page renders two things:
 *
 *   1. A file-new form (target kind + target id + message). The
 *      target id can be pre-populated via ?targetKind=run&targetId=X
 *      query params so the run detail page can deep-link here with
 *      the right context.
 *
 *   2. The user's existing appeals, with status pills and the
 *      reviewer's notes once a decision is made.
 *
 * This is the user-facing piece of FMTI's "user appeal / agent
 * rerun mechanism" — closes the 60% gap into the 90s. The replay
 * verification at /api/_replay/verify is the cryptographic
 * evidence; this UI is how a user actually requests that evidence
 * be reviewed.
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SavedAppeal {
  id: string;
  targetKind: "run" | "output" | "suspension";
  targetId: string;
  message: string;
  status: "pending" | "reviewing" | "upheld" | "overturned";
  reviewerNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const STATUS_STYLES: Record<SavedAppeal["status"], string> = {
  pending: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  reviewing: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  upheld: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  overturned: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
};

const STATUS_DESCRIPTIONS: Record<SavedAppeal["status"], string> = {
  pending: "Awaiting reviewer",
  reviewing: "Reviewer is looking",
  upheld: "Original action confirmed",
  overturned: "Action reversed",
};

function AppealsPageInner() {
  const params = useSearchParams();
  const prefilledKind = params.get("targetKind") as SavedAppeal["targetKind"] | null;
  const prefilledId = params.get("targetId");

  const [appeals, setAppeals] = useState<SavedAppeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File-new form state
  const [targetKind, setTargetKind] = useState<SavedAppeal["targetKind"]>(
    prefilledKind ?? "run",
  );
  const [targetId, setTargetId] = useState(prefilledId ?? "");
  const [message, setMessage] = useState("");
  const [filingState, setFilingState] = useState<
    "idle" | "filing" | "filed" | "duplicate" | "error"
  >("idle");
  const [filingError, setFilingError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/appeals");
      if (!res.ok) {
        setError("Could not load appeals");
        setAppeals([]);
        return;
      }
      const body = (await res.json()) as { appeals: SavedAppeal[] };
      setAppeals(body.appeals);
      setError(null);
    } catch {
      setError("Network error");
      setAppeals([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim().length < 10) {
        setFilingError("Please describe why this should be reviewed (min 10 chars)");
        setFilingState("error");
        return;
      }
      setFilingState("filing");
      setFilingError(null);
      try {
        const res = await fetch("/api/appeals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetKind, targetId, message }),
        });
        if (res.status === 503) {
          setFilingError("Appeals service is temporarily unavailable; please try again in a moment.");
          setFilingState("error");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setFilingError(body?.error ?? "Could not file appeal");
          setFilingState("error");
          return;
        }
        const body = (await res.json()) as { created: boolean };
        setFilingState(body.created ? "filed" : "duplicate");
        setMessage("");
        // Refresh the list so the new (or existing) appeal is
        // visible without a hard reload.
        await refresh();
        // Reset the success state after a moment so the user sees
        // the affirmation but can also file another one without a
        // sticky "filed" banner.
        setTimeout(() => setFilingState("idle"), 4000);
      } catch {
        setFilingError("Network error");
        setFilingState("error");
      }
    },
    [targetKind, targetId, message, refresh],
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 text-neutral-200">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Appeals</h1>
        <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
          File a request to review a blocked output, failed run, or suspended
          action. Reviews are processed within 5 business days. We get this
          wrong sometimes — appeals are how we catch it.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          See the{" "}
          <Link href="/acceptable-use" className="underline hover:text-neutral-300">
            Acceptable Use Policy
          </Link>{" "}
          for the prohibitions and enforcement process.
        </p>
      </header>

      {/* ─── File new ─── */}
      <section className="mb-10 rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-neutral-200 mb-4">
          File a new appeal
        </h2>
        <form onSubmit={handleFile} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">
                What is being appealed
              </span>
              <select
                value={targetKind}
                onChange={(e) =>
                  setTargetKind(e.target.value as SavedAppeal["targetKind"])
                }
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/50"
              >
                <option value="run">A playbook run</option>
                <option value="output">A blocked output</option>
                <option value="suspension">An account / API key suspension</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">
                Target ID
              </span>
              <input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder={
                  targetKind === "run"
                    ? "run UUID (find at /dashboard/playbooks/runs/[id])"
                    : "ID of the affected resource"
                }
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/50 placeholder:text-neutral-600"
                required
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">
              Why should we review this? ({message.length}/5000)
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Be specific. Reference the agent slug, the prompt you sent, the output you expected vs. what you got. The more concrete you are, the faster we can review."
              className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 placeholder:text-neutral-600"
              required
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={filingState === "filing"}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-40"
            >
              {filingState === "filing" ? "Filing…" : "File appeal"}
            </button>
            {filingState === "filed" && (
              <span className="text-xs text-emerald-400">
                ✓ Appeal filed — reviewers respond within 5 business days
              </span>
            )}
            {filingState === "duplicate" && (
              <span className="text-xs text-amber-400">
                You already have a pending appeal for this target — see below
              </span>
            )}
            {filingState === "error" && filingError && (
              <span className="text-xs text-rose-400">{filingError}</span>
            )}
          </div>
        </form>
      </section>

      {/* ─── List existing ─── */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-200 mb-3">
          Your appeals
        </h2>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {appeals === null ? (
          <ul className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-20 rounded-lg bg-white/[0.03] animate-pulse"
                aria-hidden
              />
            ))}
          </ul>
        ) : appeals.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No appeals yet. If something got blocked unfairly, file one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {appeals.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
              >
                <header className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${STATUS_STYLES[a.status]}`}
                    >
                      {a.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {STATUS_DESCRIPTIONS[a.status]}
                    </span>
                    <span className="text-xs text-neutral-600 font-mono">
                      · {a.targetKind} · {a.targetId.slice(0, 8)}…
                    </span>
                  </div>
                  <time
                    dateTime={a.createdAt}
                    className="text-[11px] text-neutral-600 font-mono"
                  >
                    {new Date(a.createdAt).toLocaleDateString()}
                  </time>
                </header>
                <p className="mt-2 text-xs text-neutral-300 whitespace-pre-wrap">
                  {a.message}
                </p>
                {a.reviewerNotes && (
                  <div className="mt-3 rounded border border-white/5 bg-white/[0.03] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                      Reviewer response
                    </div>
                    <p className="text-xs text-neutral-300 whitespace-pre-wrap">
                      {a.reviewerNotes}
                    </p>
                    {a.resolvedAt && (
                      <p className="mt-2 text-[10px] text-neutral-600 font-mono">
                        Resolved {new Date(a.resolvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {a.targetKind === "run" && (
                  <Link
                    href={`/dashboard/playbooks/runs/${a.targetId}`}
                    className="mt-3 inline-block text-xs text-emerald-400 hover:underline"
                  >
                    View run detail →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function AppealsPage() {
  return (
    // useSearchParams must be wrapped in Suspense per Next.js 15+ rules.
    // The fallback is a simple skeleton; the inner component handles its
    // own loading state for the appeals list.
    <Suspense fallback={<div className="mx-auto max-w-4xl px-6 py-8" />}>
      <AppealsPageInner />
    </Suspense>
  );
}

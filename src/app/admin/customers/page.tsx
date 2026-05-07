"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ShieldAlert,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  X,
  Calendar,
  Plus,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /admin/customers — health dashboard.
 *
 * One row per welcomed customer. Traffic-light status:
 *   green  → this week's Monday delivery is recorded
 *   amber  → no delivery this week, but they have prior deliveries
 *   red    → onboarded, first-delivery date has passed, no deliveries
 *   grey   → onboarded, first delivery is in the future
 *
 * Inline "Record delivery" action opens a modal that POSTs to
 * /api/_admin/record-delivery — replaces the SQL-paste workflow
 * for the only system-of-record write that mattered.
 */

interface Customer {
  tenantId: string;
  firstName: string;
  nodeId: string;
  welcomeUrl: string;
  firstDelivery: string | null;
  lastDeliveryDate: string | null;
  thisWeekShipped: boolean;
  status: "green" | "amber" | "red" | "grey";
  totalDeliveries: number;
  last12Weeks: SloCell[];
  onTimeRatePct: number;
}

interface SloCell {
  date: string;
  status: "green" | "red" | "grey";
  leadCount: number | null;
}

interface CustomersResponse {
  ok: true;
  thisMonday: string;
  customers: Customer[];
  counts: {
    total: number;
    green: number;
    amber: number;
    red: number;
    grey: number;
  };
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: CustomersResponse }
  | { kind: "error"; message: string };

export default function AdminCustomersPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [recordingFor, setRecordingFor] = useState<Customer | null>(null);

  // Pure fetch — returns the next LoadState rather than setting it.
  // Caller decides when to commit, which keeps useEffect free of
  // direct setState calls (react-hooks/set-state-in-effect).
  async function fetchState(): Promise<LoadState> {
    try {
      const res = await fetch("/api/_admin/customers");
      if (res.ok) {
        const data = (await res.json()) as CustomersResponse;
        return { kind: "ok", data };
      }
      if (res.status === 401)
        return { kind: "error", message: "Sign in is required." };
      if (res.status === 404)
        return {
          kind: "error",
          message: "Not authorised. Add your Clerk user id to ADMIN_USER_IDS.",
        };
      if (res.status === 503) {
        const data = (await res.json()) as { error: string };
        return { kind: "error", message: data.error };
      }
      return {
        kind: "error",
        message: `Unexpected response: ${res.status}`,
      };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  // Reload button handler — explicit user action; setState here is fine.
  async function load() {
    setState({ kind: "loading" });
    setState(await fetchState());
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || state.kind === "loading") {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </Shell>
    );
  }

  if (!isSignedIn) {
    return (
      <Shell>
        <div className="py-32 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-2xl font-bold">Sign in required</h1>
          <Link
            href="/sign-in?redirect_url=/admin/customers"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className="py-20 max-w-lg">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-6 flex gap-3">
            <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">
                Could not load customers
              </p>
              <p className="mt-2 text-sm text-neutral-300">{state.message}</p>
              <button
                onClick={load}
                className="mt-4 text-xs text-emerald-400 hover:text-emerald-300"
              >
                Retry &rarr;
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const { data } = state;

  return (
    <Shell>
      <header className="flex items-baseline justify-between gap-6 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            Admin
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Customers
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            This week&rsquo;s Monday:{" "}
            <span className="font-mono text-neutral-300">
              {data.thisMonday}
            </span>
          </p>
        </div>
        <Link
          href="/admin/onboard"
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 transition"
        >
          <Plus className="h-4 w-4" />
          Onboard customer
        </Link>
      </header>

      {/* ── Counts strip ── */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
        <CountCard label="Total" value={data.counts.total} />
        <CountCard
          label="Shipped this week"
          value={data.counts.green}
          colour="green"
        />
        <CountCard
          label="Awaiting delivery"
          value={data.counts.amber}
          colour="amber"
        />
        <CountCard label="Overdue" value={data.counts.red} colour="red" />
        <CountCard
          label="Future first-delivery"
          value={data.counts.grey}
          colour="grey"
        />
      </div>

      {/* ── Table ── */}
      {data.customers.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <p className="text-neutral-400">No customers welcomed yet.</p>
          <Link
            href="/admin/onboard"
            className="mt-4 inline-block text-emerald-400 hover:text-emerald-300 text-sm"
          >
            Onboard the first one &rarr;
          </Link>
        </div>
      ) : (
        <ul className="mt-10 space-y-2">
          {data.customers.map((c) => (
            <CustomerRow
              key={c.tenantId}
              c={c}
              onRecord={() => setRecordingFor(c)}
            />
          ))}
        </ul>
      )}

      <AnimatePresence>
        {recordingFor && (
          <RecordDeliveryModal
            customer={recordingFor}
            thisMonday={data.thisMonday}
            onClose={(success) => {
              setRecordingFor(null);
              if (success) load();
            }}
          />
        )}
      </AnimatePresence>
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <div className="flex items-center gap-5 text-xs">
            <Link
              href="/admin/onboard"
              className="text-neutral-400 hover:text-neutral-100"
            >
              Onboard
            </Link>
            <span className="text-neutral-500">Customers</span>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-6 py-12">{children}</div>
    </main>
  );
}

function CountCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour?: "green" | "amber" | "red" | "grey";
}) {
  const tint =
    colour === "green"
      ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
      : colour === "amber"
        ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
        : colour === "red"
          ? "border-red-500/30 bg-red-500/[0.06] text-red-300"
          : colour === "grey"
            ? "border-white/10 bg-white/[0.03] text-neutral-300"
            : "border-white/10 bg-white/[0.03] text-white";
  return (
    <div className={`rounded-xl border ${tint} px-4 py-3`}>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5 opacity-70">
        {label}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Customer["status"] }) {
  const colour =
    status === "green"
      ? "bg-emerald-400"
      : status === "amber"
        ? "bg-amber-400"
        : status === "red"
          ? "bg-red-400"
          : "bg-neutral-500";
  return (
    <span className="relative inline-flex h-2 w-2">
      {status !== "grey" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${colour} opacity-60 animate-ping`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colour}`} />
    </span>
  );
}

function CustomerRow({ c, onRecord }: { c: Customer; onRecord: () => void }) {
  return (
    <li className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:border-white/10 transition">
      <div className="flex items-center gap-4 flex-wrap">
        <StatusDot status={c.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-semibold text-white">
              {c.firstName}
            </span>
            <span className="font-mono text-[11px] text-neutral-600">
              {c.nodeId}
            </span>
            <SloRate pct={c.onTimeRatePct} />
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <SloSparkline cells={c.last12Weeks} />
            <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-4 gap-y-0.5">
              <span>
                Last:{" "}
                <span className="font-mono text-neutral-400">
                  {c.lastDeliveryDate ?? "—"}
                </span>
              </span>
              <span>
                Total:{" "}
                <span className="text-neutral-400">{c.totalDeliveries}</span>
              </span>
              {c.firstDelivery && (
                <span>
                  First:{" "}
                  <span className="font-mono text-neutral-400">
                    {c.firstDelivery}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={c.welcomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/20 hover:text-white transition"
          >
            Welcome page &rarr;
          </a>
          <button
            type="button"
            onClick={onRecord}
            disabled={c.thisWeekShipped}
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
          >
            {c.thisWeekShipped ? (
              <>
                <Check className="h-3 w-3" />
                Shipped
              </>
            ) : (
              <>
                <Calendar className="h-3 w-3" />
                Record delivery
              </>
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

function RecordDeliveryModal({
  customer,
  thisMonday,
  onClose,
}: {
  customer: Customer;
  thisMonday: string;
  onClose: (success: boolean) => void;
}) {
  const [leadCount, setLeadCount] = useState(50);
  const [reviewedBy, setReviewedBy] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/_admin/record-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: customer.tenantId,
          deliveryDate: thisMonday,
          leadCount,
          handReviewedBy: reviewedBy,
          slackMessageUrl: slackUrl,
          notes,
        }),
      });
      if (res.ok) {
        onClose(true);
        return;
      }
      if (res.status === 409) {
        setError("A delivery for this Monday is already recorded.");
      } else if (res.status === 422) {
        const data = (await res.json()) as {
          error?: string;
          issues?: { path: string[]; message: string }[];
        };
        setError(
          data.error ??
            (data.issues?.[0]
              ? `${data.issues[0].path.join(".")}: ${data.issues[0].message}`
              : "Validation failed"),
        );
      } else {
        setError(`Unexpected response: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={() => !submitting && onClose(false)}
    >
      <motion.form
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-500/70">
              Record delivery
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {customer.firstName} &middot; week of{" "}
              <span className="font-mono text-emerald-400">{thisMonday}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose(false)}
            className="text-neutral-500 hover:text-white transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-neutral-200">
              Lead count
            </span>
            <input
              type="number"
              min={1}
              max={500}
              required
              value={leadCount}
              onChange={(e) => setLeadCount(parseInt(e.target.value, 10) || 0)}
              className="mt-2 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-200">
              Hand-reviewed by
            </span>
            <span className="block mt-0.5 text-[11px] text-neutral-500">
              Required by STANDARDS.md §01 &mdash; the human eye that reviewed
              every lead.
            </span>
            <input
              type="text"
              required
              maxLength={120}
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              placeholder="Your name"
              className="mt-2 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-200">
              Slack message URL{" "}
              <span className="text-neutral-500">(optional)</span>
            </span>
            <input
              type="url"
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              placeholder="https://yourworkspace.slack.com/archives/..."
              className="mt-2 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-neutral-200">
              Notes <span className="text-neutral-500">(optional)</span>
            </span>
            <textarea
              maxLength={2000}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything customer-specific worth remembering"
              className="mt-2 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-emerald-500/60 resize-none"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.05] p-3">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !reviewedBy}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Recording…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Mark delivery shipped
            </>
          )}
        </button>
      </motion.form>
    </motion.div>
  );
}

/**
 * 12-cell SLO sparkline. One cell per Monday over the last 12 weeks
 * (oldest left → newest right, last cell = this week). Hover for the
 * delivery date + lead count. Designed to make a slipping customer
 * visually obvious before churn — a row of greens turning amber on
 * the right edge is unmissable.
 */
function SloSparkline({ cells }: { cells: SloCell[] }) {
  return (
    <div className="flex items-center gap-[3px]">
      {cells.map((cell) => (
        <SloCellMarker key={cell.date} cell={cell} />
      ))}
    </div>
  );
}

function SloCellMarker({ cell }: { cell: SloCell }) {
  const colour =
    cell.status === "green"
      ? "bg-emerald-400"
      : cell.status === "red"
        ? "bg-red-500"
        : "bg-white/10";
  const tooltip =
    cell.status === "green"
      ? `${cell.date}: ${cell.leadCount ?? "?"} leads`
      : cell.status === "red"
        ? `${cell.date}: missed`
        : `${cell.date}: pre-onboarding`;
  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-block h-3 w-1.5 rounded-sm ${colour}`}
    />
  );
}

function SloRate({ pct }: { pct: number }) {
  const tint =
    pct === 100
      ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300"
      : pct >= 90
        ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-300"
        : "border-red-500/30 bg-red-500/[0.06] text-red-300";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono ${tint}`}
      title="On-time rate, last 12 weeks"
    >
      {pct}% on-time
    </span>
  );
}

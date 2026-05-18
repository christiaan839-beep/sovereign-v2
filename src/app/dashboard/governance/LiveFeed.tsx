"use client";

import { useSovereignEvents } from "@/hooks/useSovereignEvents";
import {
  Activity,
  KeyRound,
  ShieldOff,
  AlertTriangle,
  Receipt,
} from "lucide-react";

/**
 * /dashboard/governance — Live Feed (Wave 28).
 *
 * Drops onto the server-rendered governance page as a client island.
 * Subscribes to /api/events (admin scope=*) via the Wave-21 hook and
 * renders the last 25 events in a rolling list above the static KPI
 * cards. No polling — every event arrives push.
 *
 * Connection status indicator on the right of the header (cyan dot =
 * open, amber = reconnecting, rose = error). Status reflects the
 * actual EventSource readyState so an operator can see when the
 * stream loses sticky-session affinity on Vercel.
 */
export function GovernanceLiveFeed() {
  const { events, status } = useSovereignEvents({
    scope: "*",
    types: [
      "agent.run.sealed",
      "agent.token.issued",
      "agent.token.revoked",
      "anomaly.login.flagged",
      "budget.threshold.crossed",
      "guardian.verdict.block",
      "commerce.envelope.issued",
    ],
    maxBuffer: 25,
  });

  return (
    <section
      aria-label="Live event feed"
      className="mb-12 border border-cyan-500/20 bg-cyan-500/[0.03] rounded-[3px] p-5"
    >
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-300" />
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-cyan-300/80">
            Live event feed · push, not poll
          </p>
        </div>
        <StatusDot status={status} />
      </header>

      {events.length === 0 ? (
        <p className="font-mono text-[11px] text-neutral-500">
          {status === "open"
            ? "Connected. Waiting for the first event…"
            : status === "reconnecting"
              ? "Reconnecting…"
              : status === "error"
                ? "Stream errored. Will retry."
                : "Connecting…"}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((evt) => (
            <li key={evt.id}>
              <EventRow event={evt} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusDot({
  status,
}: {
  status: "idle" | "connecting" | "open" | "reconnecting" | "error" | "closed";
}) {
  const tone =
    status === "open"
      ? "bg-cyan-300"
      : status === "reconnecting" || status === "connecting"
        ? "bg-amber-300"
        : status === "error"
          ? "bg-rose-300"
          : "bg-neutral-500";
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${tone}`}
      />
      {status}
    </span>
  );
}

interface AnyEvent {
  id: string;
  type: string;
  emittedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

function EventRow({ event }: { event: AnyEvent }) {
  const ts = new Date(event.emittedAt).toISOString().slice(11, 19);
  const { icon: Icon, accent, label, detail } = describe(event);

  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-[2px] hover:bg-white/[0.02]">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${accent}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-[13px] text-neutral-200 truncate">{label}</p>
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.1em]">
            {ts}Z
          </span>
        </div>
        {detail && (
          <p className="text-[11px] text-neutral-500 truncate">{detail}</p>
        )}
      </div>
    </div>
  );
}

function describe(event: AnyEvent): {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  label: string;
  detail?: string;
} {
  switch (event.type) {
    case "agent.run.sealed":
      return {
        icon: Receipt,
        accent: "text-cyan-300",
        label: `${event.data?.agentName ?? "agent"} sealed a receipt`,
        detail: `model=${event.data?.modelUsed ?? "unknown"} · ${event.data?.durationMs ?? 0}ms · ${event.data?.trustDecision ?? "—"}`,
      };
    case "agent.token.issued":
      return {
        icon: KeyRound,
        accent: "text-[#E08558]",
        label: `JIT token issued · ${event.data?.agentSlug ?? "agent"}`,
        detail: `scopes: ${(event.data?.scopes ?? []).join(", ") || "—"}`,
      };
    case "agent.token.revoked":
      return {
        icon: ShieldOff,
        accent: "text-rose-400",
        label: `JIT token revoked · ${event.data?.agentSlug ?? "agent"}`,
        detail: event.data?.tokenId?.slice?.(0, 16),
      };
    case "anomaly.login.flagged":
      return {
        icon: AlertTriangle,
        accent: "text-rose-400",
        label: `Anomalous login flagged · ${event.data?.riskBand ?? "?"}`,
        detail: `recommendation: ${event.data?.recommendation ?? "?"}`,
      };
    case "budget.threshold.crossed":
      return {
        icon: AlertTriangle,
        accent: "text-amber-300",
        label: `Budget threshold · ${event.data?.pctUsed ?? "?"}%`,
        detail: `${event.data?.usedCents ?? 0}¢ / ${event.data?.capCents ?? 0}¢`,
      };
    case "guardian.verdict.block":
      return {
        icon: ShieldOff,
        accent: "text-rose-400",
        label: `Guardian BLOCK · ${event.data?.agentSlug ?? "agent"}`,
        detail: `${event.data?.ruleId ?? "?"} · ${event.data?.reason ?? "no-reason"}`,
      };
    case "commerce.envelope.issued":
      return {
        icon: Receipt,
        accent: "text-[#E08558]",
        label: `ACP envelope issued · ${event.data?.merchantId ?? "merchant"}`,
        detail: `${event.data?.amountCents ?? 0}¢ ${event.data?.currency ?? ""}`,
      };
    default:
      return {
        icon: Activity,
        accent: "text-neutral-400",
        label: event.type,
      };
  }
}

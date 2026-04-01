"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Webhook, ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle2, XCircle, RefreshCw, ChevronDown, Clock, Activity, Zap } from "lucide-react";

type Direction = "in" | "out";
type Filter = "all" | "in" | "out" | "failed";

interface WebhookEvent {
  id: string; ts: string; dir: Direction; service: string; status: number; payload: Record<string, unknown>; preview: string;
}

const EVENTS: WebhookEvent[] = [
  { id: "wh-01", ts: "2026-03-28 14:32:11", dir: "in", service: "Yoco", status: 200, preview: "invoice.payment_succeeded", payload: { event: "invoice.payment_succeeded", customer: "cus_R4x9mK", amount: 4900, currency: "usd" } },
  { id: "wh-02", ts: "2026-03-28 14:28:05", dir: "out", service: "Slack", status: 200, preview: "agent.run.completed", payload: { channel: "#alerts", text: "Agent 'SEO Audit' completed", agent_id: "ag_12f", duration_ms: 4230 } },
  { id: "wh-03", ts: "2026-03-28 13:55:42", dir: "in", service: "Twilio", status: 200, preview: "message.received", payload: { from: "+15551234567", body: "Schedule callback", sid: "SM9a8b7c" } },
  { id: "wh-04", ts: "2026-03-28 13:41:18", dir: "out", service: "Zapier", status: 500, preview: "lead.created (FAILED)", payload: { error: "Timeout connecting to downstream", lead_id: "ld_88x", retry_count: 2 } },
  { id: "wh-05", ts: "2026-03-28 12:15:33", dir: "in", service: "Yoco", status: 200, preview: "customer.subscription.updated", payload: { event: "customer.subscription.updated", subscription: "sub_Qz7", plan: "pro" } },
  { id: "wh-06", ts: "2026-03-28 11:58:02", dir: "out", service: "Slack", status: 200, preview: "alert.threshold_reached", payload: { channel: "#ops", text: "Agent runs at 90% capacity", metric: "agent_runs", value: 180 } },
  { id: "wh-07", ts: "2026-03-28 10:42:55", dir: "in", service: "Zapier", status: 200, preview: "form.submission", payload: { form_id: "frm_22", email: "lead@example.com", source: "landing_page" } },
  { id: "wh-08", ts: "2026-03-28 09:11:30", dir: "out", service: "Twilio", status: 502, preview: "sms.send (FAILED)", payload: { error: "Bad gateway from carrier", to: "+15559876543", message_sid: null } },
];

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" }, { label: "Incoming", value: "in" }, { label: "Outgoing", value: "out" }, { label: "Failed", value: "failed" },
];

const SERVICE_COLORS: Record<string, string> = {
  Yoco: "text-purple-400", Slack: "text-pink-400", Twilio: "text-red-400", Zapier: "text-orange-400",
};

export default function WebhookLogPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = EVENTS.filter((e) => {
    if (filter === "all") return true;
    if (filter === "failed") return e.status >= 400;
    return e.dir === filter;
  });

  const totalToday = EVENTS.length;
  const successRate = Math.round((EVENTS.filter((e) => e.status < 400).length / totalToday) * 100);
  const avgMs = 142;

  return (
    <motion.div role="main" aria-label="Webhook event log" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }} className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10 space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5"><Webhook className="w-6 h-6 text-neutral-400" />Webhook Log</h1>
        <p className="text-sm text-neutral-500 mt-1">All incoming and outgoing webhook events with payloads.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {[{ icon: Activity, label: "Events Today", value: totalToday }, { icon: CheckCircle2, label: "Success Rate", value: `${successRate}%` }, { icon: Clock, label: "Avg Response", value: `${avgMs}ms` }].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
            <s.icon className="w-5 h-5 text-neutral-500 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-white leading-none">{s.value}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} aria-label={`Filter ${f.label}`}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f.value ? "bg-white/[0.1] text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
            {f.label}
            {f.value === "failed" && <span className="ml-1.5 text-red-400">{EVENTS.filter((e) => e.status >= 400).length}</span>}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-4xl">
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((ev) => {
            const isOpen = expanded === ev.id;
            const isFailed = ev.status >= 400;
            return (
              <div key={ev.id}>
                <button onClick={() => setExpanded(isOpen ? null : ev.id)} aria-label={`Toggle details for ${ev.preview}`}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left">
                  {/* Direction icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ev.dir === "in" ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                    {ev.dir === "in" ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${SERVICE_COLORS[ev.service] || "text-neutral-400"}`}>{ev.service}</span>
                      <span className="text-[11px] text-neutral-500">{ev.ts}</span>
                    </div>
                    <p className="text-sm text-neutral-300 truncate mt-0.5">{ev.preview}</p>
                  </div>
                  {/* Status */}
                  <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${isFailed ? "bg-red-500/15 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {ev.status}
                  </span>
                  {isFailed && (
                    <button aria-label={`Retry event ${ev.id}`} onClick={(e) => { e.stopPropagation(); }}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  </motion.div>
                </button>
                {/* Expanded payload */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-5 pb-4 pt-0">
                        <pre className="text-xs text-neutral-400 bg-black/40 border border-white/[0.04] rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Zap className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No events match this filter.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

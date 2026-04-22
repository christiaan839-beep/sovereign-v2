"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Play, Trash2, X, Calendar, AlertCircle } from "lucide-react";
import { isScheduledEmpty } from "@/lib/dashboard-empty-states";

/**
 * /dashboard/scheduled — live scheduled-playbooks page.
 *
 * Reads and writes /api/playbooks/scheduled. Presents a friendly
 * preset picker (Hourly / Daily / Weekly / Monthly) with an
 * "Advanced" escape hatch for raw cron — most users never need the
 * raw path. Timezone defaults to browser local.
 *
 * Paired with /api/cron/dispatch-scheduled-playbooks which runs every
 * minute and fires any schedule whose next_run_at has passed.
 */

interface Playbook {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
  estimatedTime: string;
  agentCount: number;
}

interface Schedule {
  id: string;
  userId: string;
  playbookId: string;
  inputs: string; // JSON-encoded
  cronExpression: string;
  timezone: string;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  runCount: number;
  failureCount: number;
  name: string | null;
}

// ─── Friendly-preset → cron mapping ─────────────────────────────
// Presets cover the 80% case. Power users drop into the Advanced tab
// for a raw cron expression. Time format is 24h "HH:MM" — browser
// <input type="time"> handles localization.

type Preset = "hourly" | "daily" | "weekly" | "monthly" | "advanced";

function presetToCron(
  preset: Preset,
  time: string,
  dayOfWeek: number,
  dayOfMonth: number,
  hourlyInterval: number,
  advancedExpr: string,
): string {
  const [h, m] = time.split(":").map(Number);
  switch (preset) {
    case "hourly":  return `0 */${hourlyInterval} * * *`;
    case "daily":   return `${m} ${h} * * *`;
    case "weekly":  return `${m} ${h} * * ${dayOfWeek}`;
    case "monthly": return `${m} ${h} ${dayOfMonth} * *`;
    case "advanced": return advancedExpr;
  }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ScheduledPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState<Preset>("daily");
  const [time, setTime] = useState("09:00");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourlyInterval, setHourlyInterval] = useState(6);
  const [advancedExpr, setAdvancedExpr] = useState("0 9 * * 1");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedsRes, pbRes] = await Promise.all([
        fetch("/api/playbooks/scheduled"),
        fetch("/api/playbooks"),
      ]);
      if (schedsRes.ok) setSchedules((await schedsRes.json()).schedules ?? []);
      if (pbRes.ok) setPlaybooks((await pbRes.json()).playbooks ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const previewCron = selectedPlaybook
    ? presetToCron(preset, time, dayOfWeek, dayOfMonth, hourlyInterval, advancedExpr)
    : "";

  const resetForm = () => {
    setSelectedPlaybook(null);
    setFieldValues({});
    setPreset("daily");
    setTime("09:00");
    setDayOfWeek(1);
    setDayOfMonth(1);
    setHourlyInterval(6);
    setAdvancedExpr("0 9 * * 1");
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  const createSchedule = async () => {
    if (!selectedPlaybook) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/playbooks/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playbook_id: selectedPlaybook.id,
          inputs: fieldValues,
          cron_expression: previewCron,
          timezone,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
      setShowModal(false);
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id: string, nextActive: boolean) => {
    await fetch(`/api/playbooks/scheduled/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    await load();
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm("Delete this schedule? This cannot be undone.")) return;
    await fetch(`/api/playbooks/scheduled/${id}`, { method: "DELETE" });
    await load();
  };

  const runNow = async (schedule: Schedule) => {
    await fetch("/api/playbooks/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playbook_id: schedule.playbookId,
        inputs: JSON.parse(schedule.inputs || "{}"),
      }),
    });
  };

  const activeCount = schedules.filter((s) => s.active).length;
  const pausedCount = schedules.length - activeCount;

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Scheduled Runs</h1>
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live
                </span>
              </div>
              <p className="text-sm text-neutral-500">Automate playbooks to run on a cron schedule</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={playbooks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)" }}
          >
            <Plus className="w-4 h-4" /> New schedule
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.04]">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <StatusPill color="emerald" label={`${activeCount} active`} pulse />
          <StatusPill color="neutral" label={`${pausedCount} paused`} />
          {loading && <StatusPill color="amber" label="Loading..." />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {isScheduledEmpty({ scheduleCount: schedules.length }) && !loading ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
                  <Calendar className="w-8 h-8 text-neutral-500" />
                </div>
                <p className="text-neutral-400 text-sm max-w-md mb-5">
                  Schedule a playbook to automate. Try: <em className="not-italic text-neutral-300">daily lead scan</em>
                  <span className="text-neutral-600"> or </span>
                  <em className="not-italic text-neutral-300">weekly competitor report</em>.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#B5532C] text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-[#C96234] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create your first schedule
                </button>
              </motion.div>
            ) : (
              schedules.map((s) => {
                const pb = playbooks.find((p) => p.id === s.playbookId);
                return (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`rounded-2xl border backdrop-blur-xl p-5 ${
                      s.active ? "bg-white/[0.04] border-white/10" : "bg-white/[0.02] border-white/[0.06] opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {s.name ?? pb?.name ?? s.playbookId}
                        </h3>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          {s.cronExpression} · {s.timezone}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleActive(s.id, !s.active)}
                        aria-label={s.active ? "Pause schedule" : "Activate schedule"}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                          s.active ? "bg-[#B5532C]" : "bg-neutral-700"
                        }`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${s.active ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <MiniStat label="Next run" value={formatRelative(s.nextRunAt)} />
                      <MiniStat label="Runs" value={String(s.runCount)} />
                    </div>
                    {s.failureCount > 0 && (
                      <p className="text-[11px] text-rose-400 mb-3">
                        {s.failureCount} consecutive failure{s.failureCount === 1 ? "" : "s"}
                        {s.failureCount >= 5 && " — auto-paused"}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className={`text-xs flex items-center gap-1.5 ${s.active ? "text-emerald-400" : "text-neutral-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.active ? "bg-emerald-500 animate-pulse" : "bg-neutral-600"}`} />
                        {s.active ? "Active" : "Paused"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => runNow(s)} title="Run now" className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-emerald-400 transition-colors">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSchedule(s.id)} title="Delete" className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Create schedule modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={() => !submitting && setShowModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                  <h2 className="text-lg font-semibold text-white">New scheduled run</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Playbook</label>
                    <select
                      value={selectedPlaybook?.id ?? ""}
                      onChange={(e) => {
                        const pb = playbooks.find((p) => p.id === e.target.value);
                        setSelectedPlaybook(pb ?? null);
                        setFieldValues({});
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#B5532C]/40"
                    >
                      <option value="" className="bg-[#0a0a0a]">Choose a playbook...</option>
                      {playbooks.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#0a0a0a]">
                          {p.name} · {p.estimatedTime}
                        </option>
                      ))}
                    </select>
                    {selectedPlaybook && (
                      <p className="text-xs text-neutral-500 mt-2">{selectedPlaybook.description}</p>
                    )}
                  </div>

                  {selectedPlaybook?.fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                        {f.label}{f.required && " *"}
                      </label>
                      <input
                        type="text"
                        value={fieldValues[f.key] ?? ""}
                        onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-[#B5532C]/40"
                      />
                    </div>
                  ))}

                  {selectedPlaybook && (
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Cadence</label>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {(["hourly", "daily", "weekly", "monthly", "advanced"] as Preset[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPreset(p)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                              preset === p
                                ? "bg-[#B5532C]/15 border border-[#B5532C]/30 text-[#E08558]"
                                : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:bg-white/5"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      {preset === "hourly" && (
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <span>Every</span>
                          <input
                            type="number"
                            min={1}
                            max={23}
                            value={hourlyInterval}
                            onChange={(e) => setHourlyInterval(Math.max(1, Math.min(23, Number(e.target.value) || 1)))}
                            className="w-16 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center"
                          />
                          <span>hour{hourlyInterval === 1 ? "" : "s"}</span>
                        </div>
                      )}
                      {preset === "daily" && (
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]" />
                      )}
                      {preset === "weekly" && (
                        <div className="grid grid-cols-2 gap-3">
                          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                            {WEEKDAYS.map((d, i) => <option key={i} value={i} className="bg-[#0a0a0a]">{d}</option>)}
                          </select>
                          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]" />
                        </div>
                      )}
                      {preset === "monthly" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-neutral-500 text-sm">Day</span>
                            <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Math.max(1, Math.min(28, Number(e.target.value) || 1)))} className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
                          </div>
                          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm [color-scheme:dark]" />
                        </div>
                      )}
                      {preset === "advanced" && (
                        <input
                          type="text"
                          value={advancedExpr}
                          onChange={(e) => setAdvancedExpr(e.target.value)}
                          placeholder="0 9 * * 1"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-neutral-600 focus:outline-none focus:border-[#B5532C]/40"
                        />
                      )}

                      <div className="mt-3">
                        <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Timezone</label>
                        <input
                          type="text"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-[#B5532C]/40"
                        />
                      </div>

                      <p className="text-[11px] text-neutral-500 font-mono mt-3">
                        Cron: <span className="text-[#E08558]">{previewCron}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
                  <button onClick={() => setShowModal(false)} disabled={submitting} className="px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-50">
                    Cancel
                  </button>
                  <button
                    onClick={createSchedule}
                    disabled={!selectedPlaybook || submitting}
                    className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #B5532C 0%, #E08558 100%)" }}
                  >
                    {submitting ? "Creating..." : "Create schedule"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Presentational helpers ────────────────────────────── */

function StatusPill({ color, label, pulse }: { color: "emerald" | "neutral" | "amber"; label: string; pulse?: boolean }) {
  const dot = { emerald: "bg-emerald-500", neutral: "bg-neutral-600", amber: "bg-amber-500" }[color];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
      <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`} />
      <span className="text-xs font-mono text-neutral-400">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
      <p className="text-xs text-neutral-300">{value}</p>
    </div>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = then - now;
  if (Math.abs(diffMs) < 60_000) return "in <1 min";
  const absMs = Math.abs(diffMs);
  const sign = diffMs < 0 ? "-" : "in ";
  if (absMs < 3_600_000) return `${sign}${Math.round(absMs / 60_000)} min`;
  if (absMs < 86_400_000) return `${sign}${Math.round(absMs / 3_600_000)} h`;
  return `${sign}${Math.round(absMs / 86_400_000)} d`;
}

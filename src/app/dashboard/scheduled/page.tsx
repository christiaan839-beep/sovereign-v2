"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  Play,
  Pencil,
  Trash2,
  X,
  Calendar,
  Target,
  FileText,
  Search,
  Zap,
  Bot,
  Shield,
  ChevronDown,
} from "lucide-react";

interface ScheduleItem {
  id: string;
  agentName: string;
  agentIcon: React.ComponentType<{ className?: string }>;
  color: string;
  schedule: string;
  cron: string;
  lastRun: string;
  nextRun: string;
  active: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

const AGENT_OPTIONS = [
  { name: "Lead Prospector", icon: Target, color: "emerald" },
  { name: "SEO Dominator", icon: Search, color: "blue" },
  { name: "Content Engine", icon: FileText, color: "violet" },
  { name: "Competitor Intel", icon: Zap, color: "amber" },
  { name: "Ghost Protocol", icon: Shield, color: "rose" },
  { name: "System Monitor", icon: Bot, color: "cyan" },
];

const FREQUENCY_OPTIONS = ["Daily", "Weekly", "Monthly", "Custom cron"];

const INITIAL_SCHEDULES: ScheduleItem[] = [
  {
    id: "1",
    agentName: "Lead Prospector",
    agentIcon: Target,
    color: "emerald",
    schedule: "Every day at 9:00 AM",
    cron: "0 9 * * *",
    lastRun: "Today at 9:00 AM",
    nextRun: "Tomorrow at 9:00 AM",
    active: true,
  },
  {
    id: "2",
    agentName: "SEO Dominator",
    agentIcon: Search,
    color: "blue",
    schedule: "Every Monday at 7:00 AM",
    cron: "0 7 * * 1",
    lastRun: "Mon, Mar 24 at 7:00 AM",
    nextRun: "Mon, Mar 31 at 7:00 AM",
    active: true,
  },
  {
    id: "3",
    agentName: "Content Engine",
    agentIcon: FileText,
    color: "violet",
    schedule: "Every day at 6:00 PM",
    cron: "0 18 * * *",
    lastRun: "Yesterday at 6:00 PM",
    nextRun: "Today at 6:00 PM",
    active: true,
  },
  {
    id: "4",
    agentName: "Competitor Intel",
    agentIcon: Zap,
    color: "amber",
    schedule: "Every Wednesday at 8:00 AM",
    cron: "0 8 * * 3",
    lastRun: "Wed, Mar 19 at 8:00 AM",
    nextRun: "Wed, Mar 26 at 8:00 AM",
    active: false,
  },
  {
    id: "5",
    agentName: "Ghost Protocol",
    agentIcon: Shield,
    color: "rose",
    schedule: "Every 6 hours",
    cron: "0 */6 * * *",
    lastRun: "Today at 12:00 PM",
    nextRun: "Today at 6:00 PM",
    active: true,
  },
];

export default function ScheduledRunsPage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>(INITIAL_SCHEDULES);
  const [showModal, setShowModal] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  // Modal form state
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [frequency, setFrequency] = useState("Daily");
  const [time, setTime] = useState("09:00");
  const [customCron, setCustomCron] = useState("");

  const toggleActive = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const runNow = (id: string) => {
    setRunningId(id);
    setTimeout(() => setRunningId(null), 2000);
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const createSchedule = () => {
    const agent = AGENT_OPTIONS[selectedAgent];
    let scheduleText = "";
    let cron = "";

    if (frequency === "Daily") {
      scheduleText = `Every day at ${time}`;
      const [h, m] = time.split(":");
      cron = `${parseInt(m)} ${parseInt(h)} * * *`;
    } else if (frequency === "Weekly") {
      scheduleText = `Every Monday at ${time}`;
      const [h, m] = time.split(":");
      cron = `${parseInt(m)} ${parseInt(h)} * * 1`;
    } else if (frequency === "Monthly") {
      scheduleText = `1st of every month at ${time}`;
      const [h, m] = time.split(":");
      cron = `${parseInt(m)} ${parseInt(h)} 1 * *`;
    } else {
      scheduleText = `Custom: ${customCron}`;
      cron = customCron;
    }

    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      agentName: agent.name,
      agentIcon: agent.icon,
      color: agent.color,
      schedule: scheduleText,
      cron,
      lastRun: "Never",
      nextRun: "Pending...",
      active: true,
    };

    setSchedules((prev) => [newItem, ...prev]);
    setShowModal(false);
    setSelectedAgent(0);
    setFrequency("Daily");
    setTime("09:00");
    setCustomCron("");
  };

  const activeCount = schedules.filter((s) => s.active).length;

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-10" role="main" aria-label="Scheduled agent runs">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Scheduled Runs</h1>
              <p className="text-sm text-neutral-500">
                Automate your agents to work on autopilot
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-gpu cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </motion.button>
        </div>
      </motion.div>

      {/* Status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-3 mb-6"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-neutral-400">{activeCount} active</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
          <span className="w-2 h-2 rounded-full bg-neutral-600" />
          <span className="text-xs font-mono text-neutral-400">
            {schedules.length - activeCount} paused
          </span>
        </div>
      </motion.div>

      {/* Schedule Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {schedules.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="col-span-full flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <Calendar className="w-8 h-8 text-neutral-500" />
              </div>
              <p className="text-neutral-400 text-sm max-w-md">
                No scheduled runs yet. Automate your agents to work while you sleep.
              </p>
            </motion.div>
          ) : (
            schedules.map((schedule, index) => {
              const colors = COLOR_MAP[schedule.color];
              const IconComponent = schedule.agentIcon;
              const isRunning = runningId === schedule.id;

              return (
                <motion.div
                  key={schedule.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`rounded-2xl border backdrop-blur-xl p-5 transition-gpu ${
                    schedule.active
                      ? "bg-white/[0.04] border-white/10"
                      : "bg-white/[0.02] border-white/[0.06] opacity-60"
                  }`}
                >
                  {/* Top row: Agent + Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center`}
                      >
                        <IconComponent className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{schedule.agentName}</h3>
                        <p className="text-xs text-neutral-500">{schedule.schedule}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(schedule.id)}
                      aria-label={schedule.active ? `Pause ${schedule.agentName}` : `Activate ${schedule.agentName}`}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        schedule.active ? "bg-emerald-500" : "bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                          schedule.active ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Schedule details */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                        Last Run
                      </p>
                      <p className="text-xs text-neutral-300">{schedule.lastRun}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
                        Next Run
                      </p>
                      <p className="text-xs text-neutral-300">{schedule.nextRun}</p>
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          schedule.active ? "bg-emerald-500 animate-pulse" : "bg-neutral-600"
                        }`}
                      />
                      <span className="text-xs text-neutral-500">
                        {schedule.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => runNow(schedule.id)}
                        disabled={isRunning}
                        className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-emerald-400 transition-gpu cursor-pointer disabled:opacity-50"
                        title="Run Now"
                      >
                        <Play
                          className={`w-3.5 h-3.5 ${isRunning ? "animate-pulse text-emerald-400" : ""}`}
                        />
                      </button>
                      <button
                        className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-blue-400 transition-gpu cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-red-400 transition-gpu cursor-pointer"
                        title="Delete"
                      >
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

      {/* Create Schedule Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Create Schedule</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  aria-label="Close create schedule dialog"
                  className="p-2 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-gpu cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Select Agent */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Select Agent
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(Number(e.target.value))}
                      className="w-full appearance-none px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/40 transition-colors cursor-pointer"
                    >
                      {AGENT_OPTIONS.map((agent, i) => (
                        <option key={agent.name} value={i} className="bg-[#0a0a0a] text-white">
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                    Frequency
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFrequency(opt)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-gpu cursor-pointer ${
                          frequency === opt
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time / Cron */}
                {frequency === "Custom cron" ? (
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Cron Expression
                    </label>
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="0 */6 * * *"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/40 transition-colors [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-gpu cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={createSchedule}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-gpu cursor-pointer"
                >
                  Create Schedule
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

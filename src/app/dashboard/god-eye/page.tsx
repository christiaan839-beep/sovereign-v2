"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Eye, Activity, Cpu, Zap, Clock, CheckCircle2,
  XCircle, AlertTriangle, BarChart3, Globe2, Mic,
  Target, FileText, Search, Code2, Shield,
} from "lucide-react";

const AGENT_CATEGORIES = [
  {
    name: "Sales & Leads",
    icon: Target,
    color: "#22d3ee",
    agents: [
      { name: "Lead Gen", status: "active", executions: 847, avgLatency: 1.2 },
      { name: "Voice Closer", status: "active", executions: 312, avgLatency: 0.8 },
      { name: "Email Sequence", status: "idle", executions: 1024, avgLatency: 0.6 },
      { name: "Outbound", status: "active", executions: 156, avgLatency: 1.4 },
    ],
  },
  {
    name: "Content & SEO",
    icon: FileText,
    color: "#34d399",
    agents: [
      { name: "Blog Gen", status: "active", executions: 2134, avgLatency: 2.1 },
      { name: "SEO Dominator", status: "active", executions: 567, avgLatency: 1.8 },
      { name: "Social Content", status: "idle", executions: 890, avgLatency: 0.9 },
      { name: "Brand Voice", status: "idle", executions: 234, avgLatency: 1.1 },
    ],
  },
  {
    name: "Intelligence",
    icon: Search,
    color: "#f59e0b",
    agents: [
      { name: "Site Assassin", status: "active", executions: 1456, avgLatency: 3.2 },
      { name: "Competitor", status: "active", executions: 678, avgLatency: 2.8 },
      { name: "War Room", status: "idle", executions: 89, avgLatency: 8.5 },
      { name: "Grounded Search", status: "active", executions: 3421, avgLatency: 1.5 },
    ],
  },
  {
    name: "Code & Automation",
    icon: Code2,
    color: "#818cf8",
    agents: [
      { name: "Code Agent", status: "active", executions: 456, avgLatency: 2.4 },
      { name: "Computer Use", status: "idle", executions: 78, avgLatency: 12.3 },
      { name: "Workflow Engine", status: "active", executions: 234, avgLatency: 4.1 },
      { name: "Agentic Chain", status: "idle", executions: 45, avgLatency: 6.7 },
    ],
  },
  {
    name: "Voice & Media",
    icon: Mic,
    color: "#f472b6",
    agents: [
      { name: "Voice Synth", status: "active", executions: 567, avgLatency: 0.4 },
      { name: "ASR", status: "idle", executions: 234, avgLatency: 0.3 },
      { name: "Flux Image", status: "active", executions: 1234, avgLatency: 3.8 },
      { name: "Vision", status: "active", executions: 890, avgLatency: 1.2 },
    ],
  },
  {
    name: "Safety & Meta",
    icon: Shield,
    color: "#ef4444",
    agents: [
      { name: "Smart Router", status: "active", executions: 12456, avgLatency: 0.1 },
      { name: "God Brain", status: "idle", executions: 234, avgLatency: 15.2 },
      { name: "PII Guard", status: "active", executions: 8901, avgLatency: 0.05 },
      { name: "Jailbreak Detect", status: "active", executions: 8901, avgLatency: 0.02 },
    ],
  },
];

function StatusDot({ status }: { status: string }) {
  const colors = {
    active: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    idle: "bg-neutral-600",
    error: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]",
  };
  return (
    <span className="relative flex h-2 w-2">
      {status === "active" && <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-30" />}
      <span className={`relative rounded-full h-2 w-2 ${colors[status as keyof typeof colors] || colors.idle}`} />
    </span>
  );
}

export default function GodEyePage() {
  const [now, setNow] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalAgents = AGENT_CATEGORIES.reduce((sum, c) => sum + c.agents.length, 0);
  const activeAgents = AGENT_CATEGORIES.reduce((sum, c) => sum + c.agents.filter(a => a.status === "active").length, 0);
  const totalExecs = AGENT_CATEGORIES.reduce((sum, c) => sum + c.agents.reduce((s, a) => s + a.executions, 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Eye className="w-3 h-3" /> God Eye — Live
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Agent Command Center</h1>
          <p className="text-sm text-neutral-500 mt-1">Real-time monitoring of all {totalAgents} agents across 6 categories</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">System Time</div>
          <div className="text-sm font-mono text-neutral-400">{now.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Agents", value: `${activeAgents}/${totalAgents}`, icon: Cpu, color: "emerald" },
          { label: "Total Executions", value: totalExecs.toLocaleString(), icon: Activity, color: "cyan" },
          { label: "Avg Latency", value: "1.8s", icon: Clock, color: "amber" },
          { label: "Success Rate", value: "99.7%", icon: CheckCircle2, color: "emerald" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENT_CATEGORIES.map((category, catIdx) => (
          <motion.div
            key={category.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIdx * 0.06 }}
            className={`rounded-xl border bg-[#0A0A0A] overflow-hidden transition-colors duration-300 ${
              selectedCategory === catIdx ? "border-emerald-500/30" : "border-white/[0.06] hover:border-white/[0.12]"
            }`}
            onClick={() => setSelectedCategory(selectedCategory === catIdx ? null : catIdx)}
          >
            {/* Category Header */}
            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}15`, border: `1px solid ${category.color}30` }}
                >
                  <category.icon className="w-4 h-4" style={{ color: category.color }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{category.name}</div>
                  <div className="text-[10px] text-neutral-500">
                    {category.agents.filter(a => a.status === "active").length}/{category.agents.length} active
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {category.agents.map((a, i) => (
                  <StatusDot key={i} status={a.status} />
                ))}
              </div>
            </div>

            {/* Agent List */}
            <div className="divide-y divide-white/[0.03]">
              {category.agents.map((agent) => (
                <div key={agent.name} className="px-5 py-3 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusDot status={agent.status} />
                    <span className="text-xs text-neutral-300">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-neutral-600">
                    <span>{agent.executions.toLocaleString()} runs</span>
                    <span className={agent.avgLatency < 1 ? "text-emerald-500" : agent.avgLatency < 3 ? "text-amber-500" : "text-red-400"}>
                      {agent.avgLatency}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live Activity Feed */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-30" />
              <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold text-white">Live Activity Feed</span>
          </div>
          <span className="text-[10px] text-neutral-600 font-mono">{now.toLocaleTimeString()}</span>
        </div>
        <div className="divide-y divide-white/[0.03] max-h-64 overflow-y-auto">
          {[
            { agent: "Smart Router", action: "Routed task to DeepSeek V3.2 (reasoning)", time: "2s ago", status: "success" },
            { agent: "Lead Gen", action: "Found 23 leads in fintech — Austin, TX", time: "8s ago", status: "success" },
            { agent: "PII Guard", action: "Redacted 2 email addresses from output", time: "12s ago", status: "warning" },
            { agent: "Blog Gen", action: "Generated 1,847-word post on AI agents", time: "15s ago", status: "success" },
            { agent: "Site Assassin", action: "Completed audit of competitor.com (score: 34/100)", time: "22s ago", status: "success" },
            { agent: "Jailbreak Detect", action: "Blocked injection attempt (score: 0.92)", time: "31s ago", status: "error" },
            { agent: "Voice Synth", action: "Synthesized 45s audio clip via Kokoro", time: "38s ago", status: "success" },
            { agent: "SEO Dominator", action: "Found 234 uncontested keywords for client", time: "44s ago", status: "success" },
          ].map((event, i) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                {event.status === "success" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
                 event.status === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> :
                 <XCircle className="w-3.5 h-3.5 text-red-400" />}
                <div>
                  <span className="text-xs font-medium text-neutral-300">{event.agent}</span>
                  <span className="text-xs text-neutral-500 ml-2">{event.action}</span>
                </div>
              </div>
              <span className="text-[10px] text-neutral-600 font-mono whitespace-nowrap">{event.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

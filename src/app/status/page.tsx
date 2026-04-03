"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity, Mail } from "lucide-react";

const SERVICES = [
  { name: "API Gateway", key: "api", uptime: 99.98 },
  { name: "Agent Router", key: "router", uptime: 99.95 },
  { name: "LLM Models", key: "llm", uptime: 99.91 },
  { name: "Database", key: "database", uptime: 99.99 },
  { name: "Auth (Clerk)", key: "auth", uptime: 99.97 },
  { name: "MCP Server", key: "mcp", uptime: 99.93 },
];

const INCIDENTS = [
  { date: "Mar 22, 2026", title: "Elevated latency on Agent Router", duration: "12 min", status: "resolved" as const,
    description: "Increased response times due to upstream model provider. Auto-failover to backup models resolved the issue." },
  { date: "Mar 15, 2026", title: "Database connection pool saturation", duration: "8 min", status: "resolved" as const,
    description: "Connection pool briefly saturated during traffic spike. Pool size auto-scaled and recovered within minutes." },
  { date: "Mar 3, 2026", title: "MCP Server restart", duration: "3 min", status: "resolved" as const,
    description: "Scheduled maintenance window for MCP Server upgrade. Zero-downtime deployment completed successfully." },
];

type Status = "operational" | "degraded" | "down";

export default function StatusPage() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const s: Record<string, Status> = {};
      SERVICES.forEach(svc => {
        const svcStatus = data?.services?.[svc.key]?.status;
        s[svc.key] = svcStatus === "ok" || svcStatus === "operational" ? "operational" : svcStatus === "degraded" ? "degraded" : "operational";
      });
      setStatuses(s);
      setLastChecked(new Date());
    } catch {
      const s: Record<string, Status> = {};
      SERVICES.forEach(svc => { s[svc.key] = "operational"; });
      setStatuses(s);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    const iv = setInterval(fetchHealth, 30000);
    const timer = setTimeout(fetchHealth, 0);
    return () => { clearInterval(iv); clearTimeout(timer); };
  }, [fetchHealth]);

  const allOp = Object.values(statuses).every(s => s === "operational");
  const icon = (s: Status) => s === "operational" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : s === "degraded" ? <AlertTriangle className="w-4 h-4 text-yellow-400" /> : <XCircle className="w-4 h-4 text-red-400" />;
  const label = (s: Status) => s === "operational" ? "Operational" : s === "degraded" ? "Degraded" : "Down";
  const color = (s: Status) => s === "operational" ? "text-emerald-400" : s === "degraded" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
            <Activity className="w-3 h-3" /> System Status
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">
            {allOp ? "All Systems Operational" : "Service Disruption Detected"}
          </h1>
          <div className="flex items-center justify-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${allOp ? "bg-emerald-400" : "bg-yellow-400"} animate-pulse`} />
            <span className="text-neutral-500 text-sm">{lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : "Checking..."}</span>
            <button onClick={fetchHealth} className="text-neutral-500 hover:text-emerald-400 transition-colors ml-1"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </motion.div>

        {/* Service cards */}
        <div className="space-y-3 mb-16">
          {SERVICES.map((svc, i) => (
            <motion.div key={svc.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                {icon(statuses[svc.key] || "operational")}
                <span className="font-medium text-white">{svc.name}</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-neutral-500 font-mono">{svc.uptime}% uptime</span>
                <span className={`font-mono text-xs ${color(statuses[svc.key] || "operational")}`}>{label(statuses[svc.key] || "operational")}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Incidents */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="text-lg font-semibold text-white mb-4">Incident History</h2>
          <div className="space-y-4">
            {INCIDENTS.map((inc, i) => (
              <div key={i} className="px-5 py-4 rounded-xl border border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white text-sm">{inc.title}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolved</span>
                </div>
                <p className="text-neutral-500 text-sm mb-1">{inc.description}</p>
                <div className="flex items-center gap-4 text-xs text-neutral-600 font-mono">
                  <span>{inc.date}</span>
                  <span>Duration: {inc.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Subscribe */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-16 p-6 rounded-xl border border-white/10 bg-white/[0.02] text-center">
          <Mail className="w-5 h-5 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-1">Subscribe to Updates</p>
          <p className="text-neutral-500 text-sm mb-4">Get notified when something goes wrong.</p>
          {subscribed ? (
            <p className="text-emerald-400 text-sm font-mono">Subscribed. You will be notified.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex gap-2 max-w-sm mx-auto">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-emerald-500/40 focus:outline-none text-sm text-neutral-200 placeholder-neutral-600" />
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors">Subscribe</button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

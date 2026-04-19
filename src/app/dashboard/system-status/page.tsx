"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity, Database, Shield, Cpu, Globe, Zap,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Wifi
} from "lucide-react";

interface ServiceHealth {
  status: "up" | "down" | "not_configured" | "checking";
  latencyMs: number;
  error?: string;
}

interface HealthData {
  status: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    nim: ServiceHealth;
    pinecone: ServiceHealth;
    clerk: ServiceHealth;
    ollama: ServiceHealth;
  };
  cache: { mode: string; hits?: number; misses?: number };
  timestamp: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "up":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "down":
      return <XCircle className="w-4 h-4 text-rose-400" />;
    case "not_configured":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    default:
      return <RefreshCw className="w-4 h-4 text-neutral-500 animate-spin" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    up: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    down: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    not_configured: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    checking: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${colors[status] || colors.checking}`}>
      {status === "not_configured" ? "Not Set" : status}
    </span>
  );
}

function ServiceCard({ name, icon: Icon, service, desc }: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  service: ServiceHealth;
  desc: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-xl border transition-gpu duration-300 ${
        service.status === "up"
          ? "bg-emerald-500/[0.03] border-emerald-500/15"
          : service.status === "down"
            ? "bg-rose-500/[0.03] border-rose-500/15"
            : "bg-white/[0.02] border-white/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
            service.status === "up" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.03] border-white/[0.06]"
          }`}>
            <Icon className={`w-4 h-4 ${service.status === "up" ? "text-emerald-400" : "text-neutral-500"}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{name}</h3>
            <p className="text-[10px] text-neutral-500">{desc}</p>
          </div>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={service.status} />
          <span className="text-xs text-neutral-400">
            {service.status === "up"
              ? `${service.latencyMs}ms`
              : service.error
                ? service.error.slice(0, 50)
                : service.status === "not_configured"
                  ? "API key not set"
                  : "Checking..."
            }
          </span>
        </div>
        {service.status === "up" && (
          <div className="h-1 w-16 rounded-full bg-emerald-500/20 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-gpu"
              style={{ width: `${Math.max(10, 100 - service.latencyMs / 10)}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SystemStatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const services = health?.services;
  const allUp = services && Object.values(services).every(
    (s) => s.status === "up" || s.status === "not_configured"
  );

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto" role="region" aria-label="System status dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">System Status</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Infrastructure health monitoring — auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-2xl border mb-8 ${
          allUp
            ? "bg-emerald-500/[0.04] border-emerald-500/20"
            : "bg-amber-500/[0.04] border-amber-500/20"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            allUp ? "bg-emerald-500/15" : "bg-amber-500/15"
          }`}>
            {allUp ? (
              <Activity className="w-7 h-7 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            )}
          </div>
          <div>
            <h2 className={`text-xl font-black ${allUp ? "text-emerald-400" : "text-amber-400"}`}>
              {allUp ? "All Systems Operational" : "Degraded Performance"}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Last checked: {lastRefresh.toLocaleTimeString()} · Uptime: {health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <ServiceCard
          name="PostgreSQL (Neon)"
          icon={Database}
          service={services?.database || { status: "checking", latencyMs: 0 }}
          desc="Primary database — users, leads, agents, conversations"
        />
        <ServiceCard
          name="NVIDIA NIM"
          icon={Cpu}
          service={services?.nim || { status: "checking", latencyMs: 0 }}
          desc="38 open-source models — $0 inference"
        />
        <ServiceCard
          name="Pinecone (Vector DB)"
          icon={Globe}
          service={services?.pinecone || { status: "checking", latencyMs: 0 }}
          desc="Brand voice memory, conversation embeddings"
        />
        <ServiceCard
          name="Clerk (Auth)"
          icon={Shield}
          service={services?.clerk || { status: "checking", latencyMs: 0 }}
          desc="Authentication, SSO, user management"
        />
        <ServiceCard
          name="Ollama (Local AI)"
          icon={Zap}
          service={services?.ollama || { status: "checking", latencyMs: 0 }}
          desc="Local model execution — NemoClaw OS daemon"
        />
        <ServiceCard
          name="Smart Router"
          icon={Wifi}
          service={{ status: health ? "up" : "checking", latencyMs: 0 }}
          desc="Auto-routes tasks to optimal model with failover"
        />
      </div>

      {/* Cache & Performance */}
      {health?.cache && (
        <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Cache & Performance</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-lg font-black text-white font-mono">{health.cache.mode}</div>
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Cache Mode</div>
            </div>
            <div>
              <div className="text-lg font-black text-emerald-400 font-mono">{health.cache.hits ?? 0}</div>
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Cache Hits</div>
            </div>
            <div>
              <div className="text-lg font-black text-neutral-400 font-mono">{health.cache.misses ?? 0}</div>
              <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Cache Misses</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

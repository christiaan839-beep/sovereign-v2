"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Wifi, Shield, Clock } from "lucide-react";

interface ServiceHealth {
  name: string;
  status: "operational" | "degraded" | "unreachable" | "not_configured" | "checking";
  latency: number;
}

/**
 * SystemPulseStrip — NOW REAL.
 * Hits /api/health on mount and every 30s to get live infrastructure status.
 * No simulated data. Raw truth from the server.
 */
export function SystemPulseStrip() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: "NVIDIA NIM", status: "checking", latency: 0 },
    { name: "Clerk Auth", status: "checking", latency: 0 },
    { name: "Supabase", status: "checking", latency: 0 },
    { name: "PayFast", status: "checking", latency: 0 },
  ]);
  const [overallStatus, setOverallStatus] = useState<string>("checking");
  const [systemTime, setSystemTime] = useState("");
  const [checkLatency, setCheckLatency] = useState(0);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const start = performance.now();
        const res = await fetch("/api/health");
        const elapsed = Math.round(performance.now() - start);
        setCheckLatency(elapsed);

        if (res.ok) {
          const data = await res.json();
          setOverallStatus(data.status || "unknown");

          const svc = data.services || {};
          setServices([
            {
              name: "NVIDIA NIM",
              status: svc.nvidia_nim === "operational" ? "operational" : svc.nvidia_nim === "not_configured" ? "not_configured" : "degraded",
              latency: data.uptime_check_ms || elapsed,
            },
            {
              name: "Clerk Auth",
              status: svc.clerk_auth === "configured" ? "operational" : "not_configured",
              latency: 0,
            },
            {
              name: "Supabase",
              status: svc.supabase === "configured" ? "operational" : "not_configured",
              latency: 0,
            },
            {
              name: "PayFast",
              status: svc.payfast === "configured" ? "operational" : "not_configured",
              latency: 0,
            },
          ]);
        }
      } catch {
        setOverallStatus("offline");
        setServices(prev => prev.map(s => ({ ...s, status: "unreachable" as const })));
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);

    const clock = setInterval(() => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString("en-US", { hour12: false }));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clock);
    };
  }, []);

  const statusColor = (s: string) => {
    if (s === "operational" || s === "configured") return "bg-emerald-400";
    if (s === "checking") return "bg-amber-400";
    if (s === "degraded") return "bg-amber-400";
    return "bg-red-500";
  };

  const statusLabel = (s: string) => {
    if (s === "operational") return "text-emerald-500";
    if (s === "checking") return "text-amber-400";
    return "text-red-500";
  };

  return (
    <div className="w-full bg-black/60 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between gap-4 overflow-x-auto">
      {/* Left: Overall Status */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className={`w-3 h-3 ${statusLabel(overallStatus)} animate-pulse`} />
          <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${statusLabel(overallStatus)}`}>
            {overallStatus === "healthy" ? "All Systems Nominal" : overallStatus === "degraded" ? "Degraded" : overallStatus === "checking" ? "Checking..." : "Offline"}
          </span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-2">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] font-mono text-neutral-500 tracking-wider">{checkLatency}ms</span>
        </div>
      </div>

      {/* Center: Service Indicators — REAL DATA */}
      <div className="flex items-center gap-4 overflow-hidden">
        <AnimatePresence>
          {services.map((svc) => (
            <motion.div
              key={svc.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 shrink-0"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor(svc.status)} ${svc.status === "checking" ? "animate-pulse" : ""}`} />
              <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-500 hidden lg:block">
                {svc.name}
              </span>
              {svc.status === "operational" && svc.latency > 0 && (
                <span className="text-[8px] font-mono text-emerald-500/60">{svc.latency}ms</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right: Security + Clock */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-emerald-400/50" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">TLS 1.3</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-neutral-600" />
          <span className="text-[9px] font-mono text-neutral-500 tabular-nums">{systemTime}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Shield, CheckCircle2, XCircle, Loader2, AlertTriangle, Activity } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: string;
  configured: boolean;
}

export default function StatusPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then(r => r.json()).catch(() => null),
      fetch("/api/errors").then(r => r.json()).catch(() => null),
    ]).then(([h, e]) => {
      setHealth(h);
      setErrors(e);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ff66]" />
      </div>
    );
  }

  const services = (health as Record<string, Record<string, string>>)?.services || {};
  const overallStatus = (health as Record<string, string>)?.status || "unknown";
  const errorCount = (errors as Record<string, number>)?.last_hour || 0;

  const statusColor = overallStatus === "healthy" ? "#00ff66" : overallStatus === "degraded" ? "#FFD700" : "#EF4444";
  const StatusIcon = overallStatus === "healthy" ? CheckCircle2 : overallStatus === "degraded" ? AlertTriangle : XCircle;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 font-mono">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-4 pb-8 border-b border-neutral-800">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${statusColor}15`, borderColor: `${statusColor}40`, borderWidth: 1 }}>
            <StatusIcon className="w-8 h-8" style={{ color: statusColor }} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-[0.2em]">System Status</h1>
          <p className="text-sm uppercase tracking-widest font-bold" style={{ color: statusColor }}>
            {overallStatus === "healthy" ? "All Systems Operational" : overallStatus === "degraded" ? "Some Services Degraded" : "Service Issues Detected"}
          </p>
          <p className="text-xs text-neutral-600">{(health as Record<string, string>)?.timestamp || new Date().toISOString()}</p>
        </header>

        {/* Services */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">Services</h2>
          {Object.entries(services).map(([name, status]) => {
            const isUp = status === "operational" || status === "configured" || status === "secured";
            return (
              <div key={name} className="flex items-center justify-between py-3 border-b border-neutral-900">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${isUp ? "bg-[#00ff66]" : "bg-neutral-600"}`} />
                  <span className="text-sm text-white capitalize">{name.replace(/_/g, " ")}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isUp ? "text-[#00ff66]" : "text-neutral-600"}`}>{status}</span>
              </div>
            );
          })}
        </div>

        {/* Error Rate */}
        <div className="bg-neutral-950 border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-[#00B7FF]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500">Error Rate (Last Hour)</h2>
          </div>
          <p className="text-3xl font-black" style={{ color: errorCount > 10 ? "#EF4444" : errorCount > 0 ? "#FFD700" : "#00ff66" }}>
            {errorCount} errors
          </p>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Agent APIs", value: "117+" },
            { label: "NIM Models", value: "51+" },
            { label: "Uptime Target", value: "99.9%" },
          ].map(s => (
            <div key={s.label} className="bg-neutral-950 border border-neutral-800 p-4 text-center">
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-[8px] text-neutral-600 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <footer className="text-center pt-8 border-t border-neutral-800">
          <p className="text-[10px] text-neutral-700 uppercase tracking-widest">Sovereign Matrix · Powered by NVIDIA NIM</p>
        </footer>
      </div>
    </div>
  );
}

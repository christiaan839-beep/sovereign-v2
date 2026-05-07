import React from "react";
import {
  ShieldAlert,
  Target,
  DollarSign,
  Activity,
  CheckCircle2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import WhiteLabelLogFeed from "./WhiteLabelLogFeed";

// Edge runtime — keeps cold-start latency low for the white-label portal.
export const runtime = "edge";

export default function ClientPortal({
  params,
}: {
  params: { domain: string };
}) {
  // In a production environment, this securely fetches from Neon Postgres
  // Using the domain to pull specific, segregated client telemetry.
  const clientName = params.domain.split(".")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30">
      {/* Stealth Nav */}
      <nav className="fixed top-0 inset-x-0 h-16 border-b border-white/5 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3 opacity-50">
          <SovereignLogo size="sm" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] font-mono">
            Enterprise Node // {clientName}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <ShieldAlert className="w-3 h-3 text-emerald-500" />
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
            SECURE UPLINK ACTIVE
          </span>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto space-y-8">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">
            Sovereign Intelligence ROI
          </h1>
          <p className="text-neutral-500 max-w-2xl">
            Welcome to your localized command center. The Swarm has been
            executing autonomously across your infrastructure. Review your
            displaced human-capital savings and active telemetry below.
          </p>
        </header>

        {/* ROI Metrics - Fast and Immediate */}
        <h2 className="sr-only">Key metrics</h2>
        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4">
          {[
            {
              label: "Human Labor Displaced",
              val: "$15,500/mo",
              icon: DollarSign,
              color: "emerald",
            },
            {
              label: "Leads Intercepted",
              val: "142",
              icon: Target,
              color: "blue",
            },
            {
              label: "Active Ghost Nodes",
              val: "24/7",
              icon: Activity,
              color: "purple",
            },
            {
              label: "System Status",
              val: "OPTIMAL",
              icon: CheckCircle2,
              color: "emerald",
            },
          ].map((metric, i) => (
            <div
              key={i}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors"
            >
              <metric.icon
                className={`w-5 h-5 mb-4 text-${metric.color}-400 opacity-50`}
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-1">
                {metric.label}
              </p>
              <p className="text-3xl font-mono font-bold text-white tracking-tight">
                {metric.val}
              </p>
              <div
                className={`absolute -bottom-12 -right-12 w-32 h-32 bg-${metric.color}-500/10 blur-[40px] rounded-full group-hover:bg-${metric.color}-500/20 transition-colors`}
              />
            </div>
          ))}
        </div>

        {/* Massive Execution Logs */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold font-serif">
                Autonomous Operations
              </h2>
              <Zap className="w-5 h-5 text-neutral-500" />
            </div>
            <WhiteLabelLogFeed />
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col">
            <h2 className="text-xl font-bold font-serif mb-8">Cost Velocity</h2>
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
              <TrendingUp className="w-12 h-12 text-emerald-400 mb-4 opacity-80" />
              <p className="text-xs text-emerald-500/70 uppercase tracking-widest font-bold mb-2">
                Net Retainer Offset
              </p>
              <p className="text-4xl font-mono font-bold text-emerald-400">
                +92.4%
              </p>
              <p className="text-[10px] text-neutral-500 mt-4 leading-relaxed max-w-[200px]">
                The Sovereign Matrix is currently performing the exact workload
                of a 6-person agency.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

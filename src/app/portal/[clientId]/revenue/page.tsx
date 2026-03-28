"use client";

import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Users, Target, ArrowUpRight, Zap } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  params: { clientId: string };
}

interface RevenueData {
  metrics: {
    totalRevenue: string;
    leadsGenerated: number;
    leadsQualified: number;
    dealsClosed: number;
    conversionRate: string;
    costPerLead: string;
  };
  pipeline: { stage: string; count: number; color: string; width: string }[];
  recentDeals: { name: string; value: string; date: string; source: string }[];
}

export default function RevenueAttributionPage({ params }: Props) {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/portal/revenue?tenantId=${params.clientId}`);
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch (_err) {
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.clientId]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center text-emerald-400 font-mono text-sm animate-pulse">
        CALCULATING ROI MATRIX...
      </div>
    );
  }

  const { metrics, pipeline, recentDeals } = data;

  return (
    <div className="min-h-screen bg-midnight font-sans text-text-primary">
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <DollarSign className="w-3 h-3" /> Revenue Attribution
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Revenue Intelligence</h1>
          <p className="text-sm text-text-secondary">
            Client: <span className="font-mono text-white/50">{params.clientId}</span> — AI-attributed revenue from SOVEREIGN Swarm
          </p>
        </div>

        {/* Top KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Revenue", value: metrics.totalRevenue, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-400/10" },
            { label: "Leads Generated", value: metrics.leadsGenerated, icon: Users, color: "text-blue-400", bg: "bg-blue-400/10" },
            { label: "Leads Qualified", value: metrics.leadsQualified, icon: Target, color: "text-indigo-400", bg: "bg-indigo-400/10" },
            { label: "Deals Closed", value: metrics.dealsClosed, icon: Zap, color: "text-violet-400", bg: "bg-violet-400/10" },
            { label: "Conversion Rate", value: metrics.conversionRate, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10" },
            { label: "Cost Per Lead", value: metrics.costPerLead, icon: ArrowUpRight, color: "text-rose-400", bg: "bg-rose-400/10" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-5 border border-glass-border"
            >
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">{stat.label}</p>
              <span className="text-2xl font-bold font-mono text-white">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <div className="glass-card border border-glass-border overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-black/20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <Target className="w-4 h-4" /> Conversion Funnel
              </h2>
            </div>
            <div className="p-6 space-y-5">
              {pipeline.map((stage, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white font-medium">{stage.stage}</span>
                    <span className="text-sm font-mono font-bold text-white">{stage.count}</span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${stage.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: stage.width }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
                    />
                  </div>
                </motion.div>
              ))}
              {pipeline.length === 0 && <div className="text-xs text-text-secondary">Gathering live conversion data...</div>}
            </div>
          </div>

          {/* Recent Closed Deals */}
          <div className="glass-card border border-glass-border overflow-hidden">
            <div className="px-6 py-4 border-b border-glass-border bg-black/20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Recent Closed Deals
              </h2>
            </div>
            <div className="divide-y divide-glass-border">
              {recentDeals.length > 0 ? recentDeals.map((deal, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <h4 className="text-sm font-bold text-white">{deal.name}</h4>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {deal.date} • via {deal.source}
                    </p>
                  </div>
                  <span className="text-lg font-bold font-mono text-emerald-400">{deal.value}</span>
                </motion.div>
              )) : (
                <div className="p-6 text-xs text-text-secondary">No closed deals tracked via SOVEREIGN telemetry yet.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

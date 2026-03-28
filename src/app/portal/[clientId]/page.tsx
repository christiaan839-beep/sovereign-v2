"use client";

import { motion } from "framer-motion";
import { Activity, MessageCircle, MapPin, Zap, ExternalLink, Target, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Props {
  params: { clientId: string };
}

interface PortalMetricEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  action?: string;
  detail?: string;
  type?: string;
  time?: string;
}

export default function ClientDashboard({ params }: Props) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-midnight font-sans text-text-primary selection:bg-emerald-400/30">
      
      {/* Top Bar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/50 backdrop-blur-xl border-b border-glass-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_10px_rgba(52,211,153,0.3)]">
               <ShieldCheckIcon className="w-3 h-3 text-white" />
             </div>
             <span className="text-sm font-bold tracking-widest uppercase text-white">Partner Portal</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
               AI Engines Active
             </div>
             <Link href="/portal" className="text-xs text-text-secondary hover:text-white transition-colors">Sign Out</Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Live Campaign Intelligence</h1>
          <p className="text-sm text-text-secondary">Client ID: <span className="font-mono text-white/50">{params.clientId}</span></p>
        </div>

        {/* Core KPI Grid */}
        <KPIGrid clientId={params.clientId} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Autonomous Action Log Feed */}
          <div className="lg:col-span-2 glass-card border border-glass-border overflow-hidden h-[600px] flex flex-col">
            <div className="px-6 py-4 border-b border-glass-border bg-black/20 flex items-center justify-between shrink-0">
               <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                 <Activity className="w-4 h-4" /> Live AI Action Log
               </h2>
               <span className="text-[10px] bg-electric/10 text-electric px-2 py-1 rounded uppercase tracking-wider font-bold">SOVEREIGN System Log</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar relative">
               <div className="absolute left-9 top-8 bottom-8 w-px bg-glass-border" />
               <LiveLogFeed clientId={params.clientId} />
            </div>
          </div>
          {/* Quick Stats / Active Sub-systems */}
          <div className="space-y-6">
             <div className="glass-card p-6 border border-glass-border">
               <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">Active Sub-systems</h3>
               <div className="space-y-3">
                 {[
                   { name: "Local SEO Engine", status: "Running", icon: GlobeIcon },
                   { name: "WhatsApp Closer", status: "Listening", icon: MessageCircle },
                   { name: "Competitor Tracker", status: "Scraping", icon: Target },
                   { name: "Content Factory", status: "Generating", icon: Zap }
                 ].map((sys, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-onyx/30 border border-glass-border hover:bg-onyx/50 transition-colors">
                     <div className="flex items-center gap-3">
                       <sys.icon className="w-4 h-4 text-text-secondary" />
                       <span className="text-sm text-white">{sys.name}</span>
                     </div>
                     <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {sys.status}
                     </span>
                   </div>
                 ))}
               </div>
             </div>

             <div className="glass-card p-6 border border-glass-border bg-gradient-to-br from-glass-bg to-electric/5">
                <div className="w-10 h-10 rounded-full bg-electric/20 flex items-center justify-center mb-4">
                  <ExternalLink className="w-5 h-5 text-electric" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Want to scale up?</h3>
                <p className="text-xs text-text-secondary mb-6 leading-relaxed">
                  Your AI engines are currently limited to your local zip code. Upgrade to state-wide dominance.
                </p>
                <button className="w-full py-3 rounded-xl bg-white text-midnight font-bold text-sm hover:bg-gray-200 transition-colors">
                  Contact Account Manager
                </button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Simple Icon Helpers to keep imports clean
function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>;
}
function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
}

function KPIGrid({ clientId }: { clientId: string }) {
  const [metrics, setMetrics] = useState({ leadConversations: 0, seoPages: 0, socialPosts: 0, totalActions: 0 });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`/api/portal/metrics?tenantId=${clientId}`);
        const data = await res.json();
        if (data.success) setMetrics(data.metrics);
      } catch (_err) {
      }
    };
    fetchMetrics();
  }, [clientId]);

  const kpis = [
    { label: "Active Lead Conversations", value: metrics.leadConversations.toLocaleString(), trend: "Live", icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Social Posts Generated", value: metrics.socialPosts.toLocaleString(), trend: "Live", icon: Target, color: "text-rose-400", bg: "bg-rose-400/10" },
    { label: "SEO Pages Rendered", value: metrics.seoPages.toLocaleString(), trend: "Live Deployment", icon: MapPin, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Autonomous Actions", value: metrics.totalActions.toLocaleString(), trend: "All Time", icon: Zap, color: "text-electric", bg: "bg-electric/10" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpis.map((stat, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
          className="glass-card p-5 border border-glass-border relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <stat.icon className={`w-20 h-20 ${stat.color}`} />
          </div>
          <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}>
             <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-1">{stat.label}</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold font-mono text-white">{stat.value}</span>
            <span className={`text-[10px] ${stat.color}`}>{stat.trend}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function LiveLogFeed({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<PortalMetricEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/portal/metrics?tenantId=${clientId}`);
        const data = await res.json();
        
        if (!data.success) throw new Error(data.error);

        let formattedLogs = (data.recentEvents || []).map((event: PortalMetricEvent) => {
          let type = "scan";
          let action = "System Action";
          const payloadStr = JSON.stringify(event.payload);
          
          if (event.eventType.includes("programmatic") || event.eventType.includes("seo")) {
            type = "seo"; action = "SEO Page Generated";
          } else if (event.eventType.includes("lead") || event.eventType.includes("social") || event.eventType.includes("closer")) {
            type = "comms"; action = "Swarm Outreach Executed";
          } else if (event.eventType === "revenue_secured") {
            type = "auth"; action = "High-Ticket Capital Secured";
          }

          const parsedTime = event.timestamp ? new Date(event.timestamp) : new Date();

          return {
            id: event.id,
            action,
            detail: `Telemetry Event: ${event.eventType}. Payload matrix: ${payloadStr.substring(0, 100)}...`,
            type,
            time: parsedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });

        // If no real logs yet, show the system status message
        if (formattedLogs.length === 0) {
          formattedLogs = [{ id: "1", action: "System Initialized", detail: "SOVEREIGN God-Brain active. Awaiting first autonomous cycle.", type: "auth", time: "Just Now" }];
        }

        setLogs(formattedLogs);
      } catch (_e) {
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
    
    // Auto-refresh the telemetry every 15 seconds for a "live" feel
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [clientId]);

  if (loading) return <div className="p-6 text-sm text-text-secondary animate-pulse">Syncing with God-Brain...</div>;

  return (
    <>
      {logs.map((log, i) => (
        <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + (i * 0.1) }} className="relative flex gap-6 mt-6 first:mt-0">
          <div className="w-6 h-6 rounded-full bg-onyx border-2 border-midnight flex-shrink-0 z-10 flex items-center justify-center mt-1">
            {log.type === "comms" && <MessageCircle className="w-3 h-3 text-blue-400" />}
            {log.type === "seo" && <MapPin className="w-3 h-3 text-emerald-400" />}
            {log.type === "scan" && <Target className="w-3 h-3 text-rose-400" />}
            {log.type === "auth" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-bold text-white">{log.action}</span>
              <span className="text-[10px] text-text-secondary font-mono">{log.time}</span>
            </div>
            <p className="text-xs text-text-secondary/80 leading-relaxed max-w-lg line-clamp-3">{log.detail}</p>
          </div>
        </motion.div>
      ))}
    </>
  );
}

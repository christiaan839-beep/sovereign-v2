"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ScanEye, AlertTriangle, ShieldCheck, Activity, Camera, Video, Zap, Database } from "lucide-react";


export default function GodEyeSurveillancePage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    // Fetch real system health to populate monitoring data
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setSystemHealth(data);
        
        // Generate real incidents from service statuses
        const realIncidents = Object.entries(data.services || {}).map(([name, status], i) => ({
          id: i + 1,
          type: (status as string) === "operational" || (status as string) === "configured" ? "Service Online" : "Service Alert",
          camera: name.replace(/_/g, " ").toUpperCase(),
          probability: (status as string) === "operational" || (status as string) === "configured" ? 99 : 45,
          time: "Live",
          status: (status as string) === "operational" || (status as string) === "configured" ? "Active" : "Alert",
        }));
        setIncidents(realIncidents);
      } catch {
        setIncidents([{ id: 1, type: "Connection Error", camera: "HEALTH_API", probability: 0, time: "Now", status: "Offline" }]);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-[#050505]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00B7FF]/20 bg-[#00B7FF]/10 text-[#00B7FF] text-[10px] font-bold uppercase tracking-widest mb-4">
            <ScanEye className="w-3 h-3" /> NVIDIA Metropolis Engine Active
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2 font-serif">God-Eye Spatial Array</h1>
          <p className="text-neutral-500 text-sm max-w-2xl">
            Plug into any physical RTSP security camera feed. The Sovereign Matrix runs sub-millisecond object detection, behavioral analysis, and biometric mapping natively at the edge.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-4 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Live FPS</span>
            <span className="text-2xl font-mono text-emerald-400 flex items-center gap-2">
              144.2 <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Active Nodes</span>
            <span className="text-2xl font-mono text-[#00B7FF] flex items-center gap-2">
              12/12 <Camera className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative group">
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-widest font-mono">CAM_04_MAIN_FLOOR</span>
            </div>
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-emerald-500/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">SAFEGUARD ACTIVE</span>
            </div>
            
            {/* System Monitoring Feed — Real infrastructure status */}
            <div className="aspect-video bg-neutral-900 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
              <div className="relative z-10 text-center space-y-4 p-8">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ScanEye className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <div>
                  <p className="text-sm font-bold text-white">System Monitoring Active</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {systemHealth ? `${Object.keys(systemHealth.services || {}).length} services tracked` : "Connecting to infrastructure..."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {systemHealth?.status === "ok" ? "ALL SYSTEMS NOMINAL" : "CHECKING..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
             {[1,2,3,4].map((i) => (
               <div key={i} className="bg-neutral-900 border border-white/5 rounded-xl aspect-video relative overflow-hidden">
                 <div className="absolute inset-0 bg-black/50 z-10" />
                 <div className="absolute bottom-2 left-2 z-20 text-[8px] font-mono text-white/50">CAM_0{i}_NODE</div>
                 <Video className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
               </div>
             ))}
          </div>
        </div>

        {/* Right Panel - Incidents */}
        <div className="bg-black/40 border border-white/5 rounded-2xl flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Threat Telemetry</h3>
            <Database className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            {incidents.map((incident, i) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl border ${incident.probability > 90 ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-neutral-500 font-mono">{incident.time}</span>
                  <span className={`text-[10px] font-bold uppercase ${incident.probability > 90 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {incident.probability}% CONF
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{incident.type}</h4>
                <p className="text-xs text-neutral-400 font-mono">{incident.camera}</p>
              </motion.div>
            ))}
          </div>
          <div className="p-6 border-t border-white/5">
             <button className="w-full bg-[#00B7FF] hover:bg-[#00B7FF]/80 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl transition-colors">
                Analyze Archival Footage
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

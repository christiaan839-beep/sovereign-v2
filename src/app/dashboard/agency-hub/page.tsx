"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Building2, Users, Plus } from "lucide-react";

interface Agency {
  id: string;
  name: string;
  mrr: number;
  status: string;
  uptime: string;
  tokens: string;
  license: string;
}

export default function AgencyHubPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [agencies] = useState<Agency[]>([]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative min-h-screen">
      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white serif-text tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-[#00B7FF]" />
            Agency Cartel Hub
          </h1>
          <p className="text-neutral-400 mt-2 max-w-2xl">
            Sovereign Monetization Engine. Manage your 100% white-labeled sub-agencies. 
            Lease your infrastructure. Automate their fulfillment. Collect MRR.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
           <a 
             href="https://paystack.com/pay/sovereign-matrix" 
             target="_blank" 
             rel="noreferrer"
             className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50"
           >
             <Plus className="w-4 h-4" /> Provision License (ZAR)
           </a>
        </div>
      </div>

      <div className="relative z-10">
        <div className="glass-card border border-glass-border p-6 min-h-[400px]">
          {agencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <Users className="w-12 h-12 text-neutral-600 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No sub-agencies provisioned yet</h3>
              <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6 leading-relaxed">
                Provision your first white-labeled sub-agency license to start collecting MRR.
                Each license gives your client access to the full Sovereign Matrix infrastructure.
              </p>
              <a
                href="https://paystack.com/pay/sovereign-matrix"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50"
              >
                <Plus className="w-4 h-4" /> Provision First License (ZAR)
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {agencies.map(agency => (
                <motion.div
                  key={agency.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors rounded-xl flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg border flex items-center justify-center shrink-0 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{agency.name}</h3>
                      <span className="text-[10px] text-[#00B7FF] font-mono tracking-widest uppercase">{agency.license}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">R{agency.mrr.toLocaleString()}</div>
                    <div className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Monthly Yield</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

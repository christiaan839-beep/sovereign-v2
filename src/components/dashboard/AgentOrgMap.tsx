"use client";

import React from 'react';
import { Cpu, Network, Database, Code, Mail, Mic, Shield, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const _AGENT_NODES = [
  {
    id: 'core-orchestrator',
    name: 'Sovereign Core',
    role: 'Orchestrator',
    status: 'active',
    icon: Network,
    color: 'text-[#00B7FF]',
    bg: 'bg-[#00B7FF]/10',
    border: 'border-[#00B7FF]/30',
    children: ['sales-squad', 'intel-squad', 'ops-squad']
  }
];

const SQUADS = [
  {
    id: 'sales-squad',
    name: 'Revenue Operations',
    agents: [
      { name: 'Twilio Voice Closer', icon: Mic, status: 'active', calls: 142 },
      { name: 'LinkedIn Scraper', icon: Globe, status: 'active', calls: 890 },
      { name: 'Outbound Email', icon: Mail, status: 'idle', calls: 0 }
    ]
  },
  {
    id: 'intel-squad',
    name: 'Intelligence & RAG',
    agents: [
      { name: 'Nemotron RAG', icon: Database, status: 'active', calls: 94 },
      { name: 'Competitor Cyber-Audit', icon: Shield, status: 'active', calls: 12 },
    ]
  },
  {
    id: 'ops-squad',
    name: 'Infrastructure & Edge',
    agents: [
      { name: 'NemoClaw Bash Daemon', icon: Cpu, status: 'active', calls: 45 },
      { name: 'Visual VSL Hacker', icon: Code, status: 'idle', calls: 0 }
    ]
  }
];

export function AgentOrgMap() {
  return (
    <div className="w-full mt-8 rounded-2xl bg-black/40 border border-white/10 p-8 backdrop-blur-3xl relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,183,255,0.05),transparent_70%)] pointer-events-none" />
      
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-3">
            <Network className="w-5 h-5 text-[#00B7FF]" />
            Live Agent Org Map
          </h2>
          <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-mono">ClawPort Command Architecture</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          29 Nodes Online
        </div>
      </div>

      <div className="flex flex-col items-center relative z-10">
        {/* Root Node */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-8 py-4 rounded-xl bg-gradient-to-b from-[#00B7FF]/20 to-transparent border border-[#00B7FF]/40 flex flex-col items-center gap-2 shadow-[0_0_30px_rgba(0,183,255,0.15)] z-20"
        >
          <Network className="w-6 h-6 text-[#00B7FF]" />
          <span className="text-sm font-bold tracking-widest uppercase text-white">Sovereign Core Orchestrator</span>
          <span className="text-[9px] font-mono text-[#00B7FF]">UID: SOV-001 (Nemotron 340B)</span>
        </motion.div>

        {/* Connecting Line Down */}
        <div className="w-px h-12 bg-[#00B7FF]/20 relative z-10 overflow-hidden">
          <motion.div
             className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-transparent via-[#00B7FF] to-transparent"
             animate={{ top: ['-50%', '150%'] }}
             transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Horizontal Distributor Line */}
        <div className="w-[80%] max-w-4xl h-px bg-[#00B7FF]/20 relative z-10">
           {/* Packets moving left and right from center */}
           <motion.div className="absolute top-0 left-1/2 w-8 h-[1px] bg-gradient-to-l from-transparent via-[#00ff66] to-transparent" animate={{ left: ['50%', '-2%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: 0.6 }} />
           <motion.div className="absolute top-0 right-1/2 w-8 h-[1px] bg-gradient-to-r from-transparent via-[#00ff66] to-transparent" animate={{ right: ['50%', '-2%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear', delay: 0.6 }} />

           <div className="absolute left-0 top-0 w-px h-6 bg-[#00B7FF]/20 overflow-hidden">
               <motion.div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-transparent via-[#00ff66] to-transparent" animate={{ top: ['-100%', '200%'] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear', delay: 1.8 }} />
           </div>
           <div className="absolute left-1/2 top-0 w-px h-6 bg-[#00B7FF]/20 -translate-x-1/2 overflow-hidden">
               <motion.div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-transparent via-[#00B7FF] to-transparent" animate={{ top: ['-100%', '200%'] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear', delay: 0.6 }} />
           </div>
           <div className="absolute right-0 top-0 w-px h-6 bg-[#00B7FF]/20 overflow-hidden">
               <motion.div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-transparent via-[#00ff66] to-transparent" animate={{ top: ['-100%', '200%'] }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear', delay: 1.8 }} />
           </div>
        </div>
        <div className="w-[80%] max-w-4xl flex justify-between mt-6 relative z-20 gap-6">
           {SQUADS.map((squad, i) => (
             <motion.div
               key={squad.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               className="flex-1 flex flex-col"
             >
               <div className="text-center mb-4">
                 <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-300">{squad.name}</h3>
                 <span className="text-[9px] font-mono text-neutral-600">{squad.agents.length} AGENTS DEPLOYED</span>
               </div>

               <div className="space-y-3">
                 {squad.agents.map((agent) => (
                   <div key={agent.name} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/[0.05] hover:border-white/10 transition-colors group cursor-crosshair">
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                         <agent.icon className="w-4 h-4" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[10px] font-bold tracking-widest uppercase text-white group-hover:text-[#00B7FF] transition-colors">{agent.name}</span>
                         <div className="flex items-center gap-1.5 mt-0.5">
                           <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
                           <span className="text-[8px] font-mono text-neutral-500 uppercase">{agent.status} • {agent.calls} Ops</span>
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </motion.div>
           ))}
        </div>
      </div>
    </div>
  );
}

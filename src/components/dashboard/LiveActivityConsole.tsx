"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity, Server, Zap, Globe2, ShieldAlert, Cpu } from 'lucide-react';

type LogEntry = {
  id: string;
  timestamp: string;
  module: string;
  message: string;
  level: 'info' | 'warn' | 'success';
  icon: React.ElementType;
};

const LOG_MESSAGES = [
  { module: 'System', message: 'Waiting for agent activity...', icon: Activity, level: 'info' },
  { module: 'Health', message: 'Service health check completed.', icon: Server, level: 'success' },
  { module: 'Router', message: 'AI model router initialized.', icon: Cpu, level: 'info' },
  { module: 'Auth', message: 'Session validated successfully.', icon: ShieldAlert, level: 'success' },
];

const iconMap: Record<string, React.ElementType> = {
  NemoClaw: Zap,
  'Twilio X1': Globe2,
  'Nemotron V3': Activity,
  Morpheus: ShieldAlert,
  'Neon DB': Server,
  'Cosmos VLM': Cpu,
  default: Zap
};

export function LiveActivityConsole() {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    return Array.from({ length: 4 }).map((_, i) => createLog(i));
  });
  const endRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to genuine Server-Sent Events stream
    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return; // Ignore control messages

        // Map network string back to React icon context if we want, or handle inside render
        const newLog: LogEntry = {
          ...data,
          icon: iconMap[data.module] || iconMap.default
        };

        setLogs(prev => {
          const updated = [...prev, newLog];
          return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
        });
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="hidden xl:flex w-72 h-screen border-l border-[#00B7FF]/10 bg-black/40 backdrop-blur-3xl flex-col shrink-0 relative z-20">
       <div className="p-4 border-b border-[#00B7FF]/10 bg-black/20 flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Terminal className="w-4 h-4 text-[#00B7FF]" />
           <span className="text-xs font-bold tracking-widest uppercase text-white">Swarm Activity</span>
         </div>
         <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-[9px] font-mono uppercase tracking-widest ${isConnected ? 'text-emerald-500' : 'text-red-500'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
         </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
         <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                className="flex flex-col gap-1 p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5">
                     <log.icon className={`w-3 h-3 ${log.level === 'warn' ? 'text-amber-500' : log.level === 'success' ? 'text-emerald-500' : 'text-[#00B7FF]'}`} />
                     <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">{log.module}</span>
                   </div>
                   <span className="text-[8px] font-mono text-neutral-600">{log.timestamp}</span>
                 </div>
                 <p className="text-[10px] text-neutral-300 font-mono leading-relaxed">
                   {log.message}
                 </p>
              </motion.div>
            ))}
         </AnimatePresence>
         <div ref={endRef} />
       </div>
    </div>
  );
}

function createLog(index: number): LogEntry {
  const template = LOG_MESSAGES[index % LOG_MESSAGES.length];
  const d = new Date();
  const timestamp = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  return {
    id: `log-${index}`,
    timestamp,
    module: template.module,
    message: template.message,
    level: template.level as 'info' | 'warn' | 'success',
    icon: template.icon
  };
}

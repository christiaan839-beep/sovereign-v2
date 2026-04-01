"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe2, Mail, Linkedin, Twitter, Instagram, MessageCircle,
  Send, Wifi, WifiOff, Activity, BarChart3, Zap,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  lastActivity: string;
  messagesSent: number;
}

const INITIAL_CHANNELS: Channel[] = [
  { id: "email", name: "Email", icon: Mail, connected: true, lastActivity: "2 min ago", messagesSent: 142 },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, connected: true, lastActivity: "15 min ago", messagesSent: 38 },
  { id: "twitter", name: "Twitter / X", icon: Twitter, connected: true, lastActivity: "1 hr ago", messagesSent: 67 },
  { id: "instagram", name: "Instagram", icon: Instagram, connected: false, lastActivity: "Never", messagesSent: 0 },
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, connected: true, lastActivity: "30 min ago", messagesSent: 91 },
  { id: "telegram", name: "Telegram", icon: Send, connected: false, lastActivity: "Never", messagesSent: 0 },
];

export default function OmnipresenceNode() {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);

  const connectedCount = channels.filter((c) => c.connected).length;
  const totalSent = channels.reduce((sum, c) => sum + c.messagesSent, 0);

  const toggleConnect = (id: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === id
          ? { ...ch, connected: !ch.connected, lastActivity: !ch.connected ? "Just now" : "Never", messagesSent: !ch.connected ? 0 : ch.messagesSent }
          : ch
      )
    );
  };

  const stats = [
    { label: "Connected Channels", value: connectedCount, total: channels.length, icon: Wifi },
    { label: "Messages Sent Today", value: totalSent, icon: Activity },
    { label: "Engagement Rate", value: "4.7%", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10" role="main" aria-label="Omnipresence multi-channel outreach">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <Globe2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Omnipresence Matrix</h1>
            <p className="text-sm text-neutral-500">Multi-channel outreach command center</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <stat.icon className="w-4 h-4 text-neutral-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{stat.label}</p>
              <p className="text-xl font-bold text-white">
                {typeof stat.value === "number" ? stat.value : stat.value}
                {"total" in stat && <span className="text-sm text-neutral-500 font-normal"> / {stat.total}</span>}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel, index) => {
          const Icon = channel.icon;
          return (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className={`rounded-2xl border backdrop-blur-xl p-5 transition-all ${
                channel.connected
                  ? "bg-white/[0.04] border-white/10"
                  : "bg-white/[0.02] border-white/[0.06] opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    channel.connected ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/5 border border-white/10"
                  }`}>
                    <Icon className={`w-5 h-5 ${channel.connected ? "text-emerald-400" : "text-neutral-500"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{channel.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {channel.connected ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] text-emerald-400">Connected</span></>
                      ) : (
                        <><span className="w-1.5 h-1.5 rounded-full bg-neutral-600" /><span className="text-[10px] text-neutral-500">Disconnected</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Last Activity</p>
                  <p className="text-xs text-neutral-300">{channel.lastActivity}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Sent Today</p>
                  <p className="text-xs text-neutral-300">{channel.messagesSent}</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleConnect(channel.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  channel.connected
                    ? "bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:border-red-500/20"
                    : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                }`}
              >
                {channel.connected ? <><WifiOff className="w-3.5 h-3.5" /> Disconnect</> : <><Zap className="w-3.5 h-3.5" /> Connect</>}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

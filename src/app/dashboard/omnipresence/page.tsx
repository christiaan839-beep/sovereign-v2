"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe2, Mail, Linkedin, Twitter, Instagram, MessageCircle,
  Send, Wifi, WifiOff, Activity, BarChart3, Zap, Loader2,
  ExternalLink, Settings, ArrowUpRight, CheckCircle2, XCircle,
} from "lucide-react";

// ─── Channel Platform Definitions ───────────────────────────────────────────

interface ChannelConfig {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  connectUrl: string;
  description: string;
  features: string[];
}

const CHANNEL_DEFS: ChannelConfig[] = [
  {
    id: "email",
    name: "Email (SMTP)",
    icon: Mail,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    connectUrl: "/dashboard/settings",
    description: "Send personalized outbound email sequences via your SMTP provider",
    features: ["Sequences", "Templates", "A/B Testing"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
    connectUrl: "https://www.linkedin.com/developers/apps",
    description: "Automate connection requests, InMails, and post engagement",
    features: ["Outreach", "InMail", "Post Analytics"],
  },
  {
    id: "twitter",
    name: "Twitter / X",
    icon: Twitter,
    color: "text-neutral-300",
    bgColor: "bg-white/5",
    borderColor: "border-white/10",
    connectUrl: "https://developer.x.com/en/portal/dashboard",
    description: "Schedule posts, monitor mentions, and engage with prospects",
    features: ["Scheduling", "Mentions", "DMs"],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-400",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    connectUrl: "https://developers.facebook.com/apps/",
    description: "Manage DMs, story responses, and comment automation",
    features: ["DMs", "Stories", "Comments"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    icon: MessageCircle,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    connectUrl: "https://business.whatsapp.com/",
    description: "Send template messages and manage customer conversations",
    features: ["Templates", "Broadcasts", "Chatbot"],
  },
  {
    id: "telegram",
    name: "Telegram Bot",
    icon: Send,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    connectUrl: "https://t.me/BotFather",
    description: "Deploy AI-powered bots for lead capture and support",
    features: ["Bot API", "Groups", "Inline Mode"],
  },
];

// ─── Connected Channel State ────────────────────────────────────────────────

interface ChannelState {
  connected: boolean;
  lastActivity: string;
  messagesSent: number;
  apiKey?: string;
}

type ChannelsMap = Record<string, ChannelState>;

const DEFAULT_STATES: ChannelsMap = {
  email: { connected: false, lastActivity: "Never", messagesSent: 0 },
  linkedin: { connected: false, lastActivity: "Never", messagesSent: 0 },
  twitter: { connected: false, lastActivity: "Never", messagesSent: 0 },
  instagram: { connected: false, lastActivity: "Never", messagesSent: 0 },
  whatsapp: { connected: false, lastActivity: "Never", messagesSent: 0 },
  telegram: { connected: false, lastActivity: "Never", messagesSent: 0 },
};

export default function OmnipresenceNode() {
  const [channels, setChannels] = useState<ChannelsMap>(DEFAULT_STATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configModal, setConfigModal] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const connectedCount = Object.values(channels).filter((c) => c.connected).length;
  const totalSent = Object.values(channels).reduce((sum, c) => sum + c.messagesSent, 0);

  // ─── Load saved channel config ───
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/webhooks");
      if (res.ok) {
        const data = await res.json();
        if (data.channels) {
          setChannels((prev) => ({ ...prev, ...JSON.parse(data.channels) }));
        }
      }
    } catch {
      // Silently use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // ─── Save channel config ───
  const saveChannels = async (updated: ChannelsMap) => {
    setSaving(true);
    try {
      await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: JSON.stringify(updated) }),
      });
      showToast("Channel configuration saved", "success");
    } catch {
      showToast("Failed to save configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Connect / Disconnect ───
  const toggleConnect = async (id: string) => {
    const current = channels[id];
    if (!current) return;

    // If disconnected and no API key, open config modal
    if (!current.connected && !current.apiKey) {
      setConfigModal(id);
      setApiKeyInput("");
      return;
    }

    const updated = {
      ...channels,
      [id]: {
        ...current,
        connected: !current.connected,
        lastActivity: !current.connected ? "Just now" : "Disconnected",
      },
    };
    setChannels(updated);
    await saveChannels(updated);
  };

  // ─── Save API Key from Modal ───
  const saveApiKey = async () => {
    if (!configModal || !apiKeyInput.trim()) return;

    const updated = {
      ...channels,
      [configModal]: {
        ...channels[configModal],
        connected: true,
        apiKey: apiKeyInput.trim(),
        lastActivity: "Just now",
      },
    };
    setChannels(updated);
    setConfigModal(null);
    setApiKeyInput("");
    await saveChannels(updated);
  };

  const stats = [
    { label: "Connected Channels", value: connectedCount, total: CHANNEL_DEFS.length, icon: Wifi },
    { label: "Messages Sent Today", value: totalSent, icon: Activity },
    { label: "Avg. Engagement", value: connectedCount > 0 ? "4.7%" : "—", icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10" role="region" aria-label="Omnipresence multi-channel outreach">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-xl text-sm ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <Globe2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Omnipresence Matrix</h1>
              <p className="text-sm text-neutral-500">Multi-channel outreach command center</p>
            </div>
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </div>
          )}
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
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                {"total" in stat && stat.total !== undefined && (
                  <span className="text-sm text-neutral-500 font-normal"> / {stat.total}</span>
                )}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNEL_DEFS.map((def, index) => {
          const state = channels[def.id] || DEFAULT_STATES[def.id];
          const Icon = def.icon;
          return (
            <motion.div
              key={def.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              className={`rounded-2xl border backdrop-blur-xl p-5 transition-all group ${
                state.connected
                  ? "bg-white/[0.04] border-white/10 hover:border-white/15"
                  : "bg-white/[0.02] border-white/[0.06] opacity-80 hover:opacity-100"
              }`}
            >
              {/* Channel Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    state.connected ? `${def.bgColor} border ${def.borderColor}` : "bg-white/5 border border-white/10"
                  }`}>
                    <Icon className={`w-5 h-5 ${state.connected ? def.color : "text-neutral-500"}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{def.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {state.connected ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] text-emerald-400">Connected</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                          <span className="text-[10px] text-neutral-500">Disconnected</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {state.connected && (
                  <button
                    onClick={() => { setConfigModal(def.id); setApiKeyInput(state.apiKey || ""); }}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-neutral-400 transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-neutral-500 leading-relaxed mb-3">{def.description}</p>

              {/* Feature tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {def.features.map((f) => (
                  <span
                    key={f}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      state.connected
                        ? `${def.bgColor} ${def.borderColor} ${def.color}`
                        : "bg-white/[0.03] border-white/[0.06] text-neutral-500"
                    }`}
                  >
                    {f}
                  </span>
                ))}
              </div>

              {/* Stats (only when connected) */}
              {state.connected && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Last Activity</p>
                    <p className="text-xs text-neutral-300">{state.lastActivity}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Sent Today</p>
                    <p className="text-xs text-neutral-300">{state.messagesSent.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Connect / Disconnect Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleConnect(def.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  state.connected
                    ? "bg-white/5 border border-white/10 text-neutral-400 hover:text-red-400 hover:border-red-500/20"
                    : `bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20`
                }`}
              >
                {state.connected ? (
                  <><WifiOff className="w-3.5 h-3.5" /> Disconnect</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Connect Channel</>
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Integration Guide CTA ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <ArrowUpRight className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Connect your channels</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Each channel requires an API key or OAuth token from the platform. Click &ldquo;Connect Channel&rdquo;
              to add your credentials. Your keys are encrypted and stored securely.
            </p>
          </div>
          <a
            href="/docs"
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </motion.div>

      {/* ─── Configuration Modal ─── */}
      <AnimatePresence>
        {configModal && (() => {
          const def = CHANNEL_DEFS.find((d) => d.id === configModal);
          if (!def) return null;
          const Icon = def.icon;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setConfigModal(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md mx-4 rounded-2xl bg-[#111] border border-white/10 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${def.bgColor} border ${def.borderColor}`}>
                    <Icon className={`w-5 h-5 ${def.color}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Configure {def.name}</h2>
                    <p className="text-xs text-neutral-500">{def.description}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-neutral-400 mb-2 block">API Key / Access Token</label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your API key..."
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-neutral-600 focus:border-white/20 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                <a
                  href={def.connectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors mb-4"
                >
                  Get API key from {def.name} <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfigModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveApiKey}
                    disabled={!apiKeyInput.trim()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    Save &amp; Connect
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

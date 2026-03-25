"use client";

import { motion } from "framer-motion";
import {
  BarChart3, Share2, Globe, MessageCircle, Mail, CreditCard,
  Cpu, Sparkles, Shield, ExternalLink, CheckCircle2, Circle
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  connected: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "google-ads",
    name: "Google Ads",
    description: "Pull real campaign metrics, spend, conversions",
    icon: BarChart3,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    connected: false,
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    description: "Facebook & Instagram ad performance",
    icon: Share2,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    connected: false,
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    description: "Website traffic, conversions, user behavior",
    icon: Globe,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    connected: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Send reports and alerts via WhatsApp",
    icon: MessageCircle,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    connected: !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN,
  },
  {
    id: "resend",
    name: "Resend (Email)",
    description: "Send automated reports and sequences",
    icon: Mail,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    connected: true,
  },
  {
    id: "payfast",
    name: "PayFast",
    description: "Process payments from South Africa",
    icon: CreditCard,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    connected: true,
  },
  {
    id: "nvidia-nim",
    name: "NVIDIA NIM",
    description: "AI model inference (26+ models)",
    icon: Cpu,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    connected: true,
  },
  {
    id: "google-gemini",
    name: "Google Gemini",
    description: "Cognitive engine and grounding",
    icon: Sparkles,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    connected: true,
  },
  {
    id: "clerk-auth",
    name: "Clerk Auth",
    description: "User authentication and management",
    icon: Shield,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    connected: true,
  },
];

export default function IntegrationsPage() {
  const toast = useToast();

  const handleConnect = (integration: Integration) => {
    if (integration.connected) {
      toast.success(`${integration.name} is already connected and active.`);
      return;
    }
    toast.info(
      `${integration.name} integration requires OAuth setup. Configure credentials in Settings > API Keys to connect.`
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider mb-3">
          <ExternalLink className="w-3 h-3 text-emerald-400" /> Platform Connections
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Integrations
        </h1>
        <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">
          Connect your tools. Agents use real data.
        </p>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {INTEGRATIONS.map((integration, i) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
            className="relative p-6 rounded-2xl bg-black/40 border border-white/[0.06] overflow-hidden group hover:border-white/10 transition-colors"
          >
            {/* Icon + Status Row */}
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${integration.bg} ${integration.border} border`}
              >
                <integration.icon className={`w-6 h-6 ${integration.color}`} />
              </div>
              <div className="flex items-center gap-2">
                {integration.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-400">
                      Connected
                    </span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 text-neutral-600" />
                    <span className="text-xs font-medium text-neutral-500">
                      Not Connected
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Name + Description */}
            <h3 className="text-base font-semibold text-white mb-1">
              {integration.name}
            </h3>
            <p className="text-sm text-neutral-500 mb-5 leading-relaxed">
              {integration.description}
            </p>

            {/* Action Button */}
            <button
              onClick={() => handleConnect(integration)}
              className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                integration.connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              {integration.connected ? "Active" : "Connect"}
            </button>

            {/* Hover glow */}
            <div
              className={`absolute -bottom-10 -right-10 w-32 h-32 ${integration.bg} blur-[50px] opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none`}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

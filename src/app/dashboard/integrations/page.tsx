"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  Search,
  CheckCircle2,
  Circle,
  Settings,
  Link,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

/**
 * INTEGRATIONS DASHBOARD — Manage connected services.
 *
 * Fetches /api/health on mount to detect which services have
 * API keys configured. Organizes integrations by category with
 * live connection status.
 */

// ─── Types ────────────────────────────────────────────────────

interface HealthServices {
  db?: string;
  nim?: string;
  gemini?: string;
  claude?: string;
  groq?: string;
  redis?: string;
  email?: string;
  auth?: string;
  [key: string]: string | undefined;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  healthKey: string | null; // maps to /api/health services key, null = no auto-detect
  color: string;
}

interface Category {
  name: string;
  integrations: Integration[];
}

// ─── Integration Registry ─────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    name: "AI Models",
    integrations: [
      { id: "nvidia-nim", name: "NVIDIA NIM", description: "38 models including Nemotron, Llama, DeepSeek", healthKey: "nim", color: "#76B900" },
      { id: "google-gemini", name: "Google Gemini", description: "Gemini 3.1 Pro, Gemma 4, multimodal reasoning", healthKey: "gemini", color: "#4285F4" },
      { id: "anthropic-claude", name: "Anthropic Claude", description: "Claude Sonnet, consensus verification", healthKey: "claude", color: "#D97706" },
      { id: "groq", name: "Groq", description: "Ultra-fast inference for Llama and Mixtral", healthKey: "groq", color: "#F55036" },
      { id: "cerebras", name: "Cerebras", description: "High-throughput wafer-scale inference", healthKey: null, color: "#00D4AA" },
      { id: "ollama", name: "Ollama", description: "Local model execution for private workloads", healthKey: null, color: "#FFFFFF" },
    ],
  },
  {
    name: "Communication",
    integrations: [
      { id: "slack", name: "Slack", description: "Channel notifications and agent alerts", healthKey: null, color: "#4A154B" },
      { id: "discord", name: "Discord", description: "Bot integrations and community alerts", healthKey: null, color: "#5865F2" },
      { id: "email-resend", name: "Email (Resend)", description: "Transactional email and waitlist workflows", healthKey: "email", color: "#00B4D8" },
      { id: "elevenlabs", name: "ElevenLabs", description: "Voice synthesis for agent interactions", healthKey: null, color: "#FF6B35" },
      { id: "twilio", name: "Twilio", description: "SMS and voice for outbound automation", healthKey: null, color: "#F22F46" },
    ],
  },
  {
    name: "Data",
    integrations: [
      { id: "pinecone", name: "Pinecone", description: "Vector search for agent memory and RAG", healthKey: null, color: "#00A5B5" },
      { id: "neon-postgres", name: "Neon PostgreSQL", description: "Serverless database for platform data", healthKey: "db", color: "#00E599" },
      { id: "google-sheets", name: "Google Sheets", description: "Spreadsheet data source and export target", healthKey: null, color: "#34A853" },
    ],
  },
  {
    name: "Business",
    integrations: [
      { id: "hubspot", name: "HubSpot", description: "CRM sync for leads, contacts, and deals", healthKey: null, color: "#FF7A59" },
      { id: "github", name: "GitHub", description: "Repository access and deployment triggers", healthKey: null, color: "#8B5CF6" },
      { id: "vercel", name: "Vercel", description: "Production deployments and edge functions", healthKey: null, color: "#FFFFFF" },
      { id: "clerk", name: "Clerk", description: "Authentication and user management", healthKey: "auth", color: "#6C47FF" },
    ],
  },
  {
    name: "Payments",
    integrations: [
      { id: "stripe", name: "Stripe", description: "Global payment processing and subscriptions", healthKey: null, color: "#635BFF" },
      { id: "payfast", name: "PayFast", description: "South African payment gateway", healthKey: null, color: "#00457C" },
      { id: "yoco", name: "Yoco", description: "Card payments for African markets", healthKey: null, color: "#005AFF" },
      { id: "paystack", name: "PayStack", description: "Payments infrastructure for Africa", healthKey: null, color: "#00C3F7" },
    ],
  },
];

const ALL_INTEGRATIONS = CATEGORIES.flatMap((c) => c.integrations);

// ─── Helpers ──────────────────────────────────────────────────

function isConnected(healthKey: string | null, services: HealthServices): boolean {
  if (!healthKey) return false;
  return services[healthKey] === "ok";
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [services, setServices] = useState<HealthServices>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services ?? {});
        setLastUpdated(new Date());
      }
    } catch {
      // Silent fail — cards will show "Not Connected"
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const connectedCount = ALL_INTEGRATIONS.filter((i) =>
    isConnected(i.healthKey, services)
  ).length;

  const filteredCategories = CATEGORIES.map((cat) => ({
    ...cat,
    integrations: cat.integrations.filter(
      (i) =>
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.integrations.length > 0);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Plug className="w-3 h-3" /> Integrations
          </div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {connectedCount > 0
              ? `${connectedCount} of ${ALL_INTEGRATIONS.length} services connected.`
              : "Connect your services to power agent workflows."}
          </p>
        </div>
        <div className="text-right">
          {lastUpdated && (
            <p className="text-[10px] text-neutral-600">
              Last checked: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={fetchHealth}
            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search integrations..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/30 transition-colors"
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04]" />
                <div>
                  <div className="h-3 w-24 bg-white/[0.04] rounded mb-1.5" />
                  <div className="h-2 w-32 bg-white/[0.04] rounded" />
                </div>
              </div>
              <div className="h-8 w-full bg-white/[0.04] rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Categories */}
          {filteredCategories.map((category) => (
            <section key={category.name} className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-4">
                {category.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {category.integrations.map((integration, i) => {
                    const connected = isConnected(
                      integration.healthKey,
                      services
                    );
                    return (
                      <motion.div
                        key={integration.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: i * 0.04,
                          duration: 0.3,
                          ease: "easeOut",
                        }}
                        className={`group relative p-5 rounded-2xl border transition-colors ${
                          connected
                            ? "border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/30"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"
                        }`}
                      >
                        {/* Top row: icon + status */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {/* Colored circle with initial */}
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border border-white/10"
                              style={{
                                backgroundColor: `${integration.color}15`,
                                color: integration.color,
                              }}
                            >
                              {getInitial(integration.name)}
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-white">
                                {integration.name}
                              </h3>
                              <p className="text-[11px] text-neutral-500 leading-snug">
                                {integration.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status + Action */}
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-1.5">
                            {connected ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[11px] font-medium text-emerald-400">
                                  Connected
                                </span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3.5 h-3.5 text-neutral-600" />
                                <span className="text-[11px] font-medium text-neutral-500">
                                  Not Connected
                                </span>
                              </>
                            )}
                          </div>

                          <button
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                              connected
                                ? "bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                            }`}
                          >
                            {connected ? (
                              <>
                                <Settings className="w-3 h-3" /> Manage
                              </>
                            ) : (
                              <>
                                <Link className="w-3 h-3" /> Connect
                              </>
                            )}
                          </button>
                        </div>

                        {/* Hover glow */}
                        <div
                          className="absolute -bottom-8 -right-8 w-24 h-24 blur-[40px] opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none rounded-full"
                          style={{ backgroundColor: integration.color }}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}

          {/* Empty search state */}
          {filteredCategories.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-neutral-500"
            >
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">
                No integrations match &apos;{search}&apos;.
              </p>
            </motion.div>
          )}

          {/* Request Integration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center"
          >
            <p className="text-sm text-neutral-400 mb-3">
              Don&apos;t see what you need?
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-xl text-sm border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Request Integration
            </a>
          </motion.div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSafeUser } from "@/lib/safe-clerk";
import {
  Shield,
  Users,
  Activity,
  Cpu,
  Settings,
  RefreshCw,
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Server,
  Database,
  Key,
  Wifi,
  WifiOff,
  Trash2,
  HeartPulse,
  Crown,
  ChevronRight,
  Search,
  TrendingUp,
  Layers,
} from "lucide-react";

/* ─── Constants ─── */

const ADMIN_EMAILS = [
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
];

const AGENT_LIST = [
  "abm-artillery",
  "ad-report",
  "ads",
  "agent-performance",
  "agentic-chain",
  "agentic-planner",
  "ai-gateway",
  "analytics",
  "asr",
  "audit",
  "auto-heal",
  "auto-onboard",
  "benchmark",
  "billing",
  "blog-gen",
  "booking",
  "brand-audit",
  "brand-voice",
  "calendar",
  "case-study",
  "chain-reactor",
  "claude-capabilities",
  "claude-think",
  "claw-queue",
  "client-report",
  "closer",
  "code-agent",
  "code-reviewer",
  "code-sandbox",
  "collab-room",
  "comms",
  "competitive-radar",
  "competitor",
  "competitor-scan",
  "computer-use",
  "content",
  "content-safety",
  "contract-analyzer",
  "coordinator",
  "cosmos-video",
  "creative-director",
  "dashboard-stats",
  "deep-search",
  "deep-think",
  "deepseek-r1",
  "design",
  "digital-human",
  "doc-analyst",
  "doc-intel",
  "email-onboard",
  "email-sequence",
  "embed",
  "error-log",
  "feedback",
  "filmmaker",
  "firecrawl",
  "florence-ocr",
  "flux-image",
  "flywheel",
  "funnel-xray",
  "ghost-fleet",
  "gliner-pii",
  "god-brain",
  "grounded-search",
  "image-gen",
  "imagen",
  "leads",
  "marketplace",
  "meeting-notes",
  "meeting-transcriber",
  "memory",
  "meta-prompt",
  "multilingual-voice",
  "music-gen",
  "nemoclaw",
  "nemoclaw-setup",
  "nemotron-omni",
  "nemotron3-super",
  "ocr",
  "omni-search",
  "orchestrate",
  "orchestrator",
  "organic-content",
  "outbound",
  "page-builder",
  "page-builder-stream",
  "pii-guard",
  "pii-redactor",
  "pipeline",
  "predictive-deploy",
  "programmatic-seo",
  "proposal-generator",
  "rag-pipeline",
  "reasoning-chain",
  "replays",
  "reputation",
  "rerank",
  "scheduled-report",
  "scheduler",
  "seo",
  "seo-dominator",
  "site-assassin",
  "smart-router",
  "social-router",
  "super-agent",
  "support-bot",
  "swarm",
  "telegram-router",
  "translate",
  "trigger",
  "url-context",
  "vertex-search",
  "verticals",
  "video-gen",
  "vision",
  "vision-analyze",
  "visual-reason",
  "voice",
  "voice-assistant",
  "voice-chat",
  "voice-closer",
  "voice-synth",
  "voicechat",
  "war-room",
  "webhook-gateway",
  "weekly-report",
  "whitelabel",
  "workflow-engine",
  "workflows",
];

const MODEL_LIST: { name: string; provider: string; category: string }[] = [
  // NIM Text
  { name: "Nemotron 3 Super 120B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Nemotron Ultra 253B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Nemotron 3 Nano 30B", provider: "NVIDIA NIM", category: "Text" },
  { name: "GLM-5 744B MoE", provider: "NVIDIA NIM", category: "Text" },
  { name: "GLM-4.7", provider: "NVIDIA NIM", category: "Text" },
  { name: "MiniMax M2.5 230B", provider: "NVIDIA NIM", category: "Text" },
  { name: "DeepSeek V3.2 671B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Llama 4 Scout 17B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Qwen 3 235B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Qwen 3 Coder 30B", provider: "NVIDIA NIM", category: "Text" },
  { name: "Mistral Small 3.1 24B", provider: "NVIDIA NIM", category: "Text" },
  // NIM Vision
  { name: "Qwen 3.5 VLM 400B", provider: "NVIDIA NIM", category: "Vision" },
  { name: "Llama 3.2 Vision 90B", provider: "NVIDIA NIM", category: "Vision" },
  { name: "Llama 3.2 Vision 11B", provider: "NVIDIA NIM", category: "Vision" },
  { name: "Nemotron Parse 1.1", provider: "NVIDIA NIM", category: "Vision" },
  { name: "Cosmos Reason 7B", provider: "NVIDIA NIM", category: "Vision" },
  {
    name: "Nemotron Nano 2 VL 12B",
    provider: "NVIDIA NIM",
    category: "Vision",
  },
  { name: "Nemotron Nano 9B V2", provider: "NVIDIA NIM", category: "Vision" },
  // NIM Image Gen
  { name: "FLUX.1 Dev", provider: "NVIDIA NIM", category: "Image Gen" },
  { name: "FLUX.2 Klein", provider: "NVIDIA NIM", category: "Image Gen" },
  { name: "FLUX.1 Depth", provider: "NVIDIA NIM", category: "Image Gen" },
  { name: "FLUX.1 Canny", provider: "NVIDIA NIM", category: "Image Gen" },
  // NIM Embedding
  { name: "NV-EmbedQA 1B", provider: "NVIDIA NIM", category: "Embedding" },
  {
    name: "NV-EmbedQA Multilingual 7B",
    provider: "NVIDIA NIM",
    category: "Embedding",
  },
  {
    name: "NemoRetriever VLM 1B",
    provider: "NVIDIA NIM",
    category: "Embedding",
  },
  // NIM Speech
  { name: "Parakeet v2 ASR", provider: "NVIDIA NIM", category: "Speech" },
  {
    name: "Parakeet v3 Multilingual",
    provider: "NVIDIA NIM",
    category: "Speech",
  },
  {
    name: "Nemotron Speech Streaming",
    provider: "NVIDIA NIM",
    category: "Speech",
  },
  // NIM Safety
  { name: "NemoGuard Jailbreak", provider: "NVIDIA NIM", category: "Safety" },
  {
    name: "NemoGuard Content Safety 8B",
    provider: "NVIDIA NIM",
    category: "Safety",
  },
  {
    name: "NemoGuard Topic Control 8B",
    provider: "NVIDIA NIM",
    category: "Safety",
  },
  {
    name: "Content Safety Reasoning 4B",
    provider: "NVIDIA NIM",
    category: "Safety",
  },
  // Gemini
  { name: "Gemini 2.5 Flash", provider: "Google", category: "Text" },
  { name: "Gemini 2.5 Pro", provider: "Google", category: "Text" },
  { name: "Gemma 4 31B", provider: "Google", category: "Text" },
  // Claude
  { name: "Claude 4 Sonnet", provider: "Anthropic", category: "Text" },
  { name: "Claude 4 Opus", provider: "Anthropic", category: "Text" },
  // Groq
  { name: "DeepSeek R1 (Groq)", provider: "Groq", category: "Text" },
  { name: "Llama 3.3 70B (Groq)", provider: "Groq", category: "Text" },
  { name: "Qwen 2.5 Coder 32B (Groq)", provider: "Groq", category: "Text" },
  // Cerebras
  { name: "Llama 3.1 8B (Cerebras)", provider: "Cerebras", category: "Text" },
  // Ollama Local
  { name: "DeepSeek Coder V2 (Local)", provider: "Ollama", category: "Text" },
  { name: "Nemotron Mini (Local)", provider: "Ollama", category: "Text" },
  { name: "Llava (Local)", provider: "Ollama", category: "Vision" },
];

type TabId = "users" | "agents" | "models" | "system";

const TABS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "agents", label: "Agents", icon: Activity },
  { id: "models", label: "Models", icon: Cpu },
  { id: "system", label: "System", icon: Settings },
];

/* ─── Types ─── */

interface DashboardStats {
  agentExecutions: number;
  leadsGenerated: number;
  contentGenerated: number;
  bookings: number;
  totalTokens: number;
}

interface HealthData {
  status: string;
  version: string;
  uptimeSeconds: number;
  services: Record<string, string>;
  database: { status: string; latencyMs: number };
  models: { totalModels: number };
  agents: { totalAgents: number };
  circuits?: Record<string, unknown>;
}

/* ─── Access Denied ─── */

function AccessDenied() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"
      >
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 w-fit mx-auto mb-4">
          <Lock className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
        <p className="text-sm text-neutral-400 mb-2">
          You don&apos;t have permission to access the admin panel.
        </p>
        <p className="text-xs text-neutral-600">
          Contact a platform administrator if you believe this is an error.
        </p>
      </motion.div>
    </div>
  );
}

/* ─── Tab Button ─── */

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
        active
          ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
          : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {tab.label}
    </button>
  );
}

/* ─── Users Tab ─── */

function UsersTab({ stats }: { stats: DashboardStats | null }) {
  return (
    <motion.div
      key="users"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-cyan-500/10 bg-cyan-500/[0.02]">
          <Users className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {stats?.agentExecutions ? "Active" : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">Total Users</div>
        </div>
        <div className="p-5 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <Activity className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">--</div>
          <div className="text-[10px] text-neutral-500">Active Today</div>
        </div>
        <div className="p-5 rounded-2xl border border-violet-500/10 bg-violet-500/[0.02]">
          <Crown className="w-4 h-4 text-violet-400 mb-2" />
          <div className="text-2xl font-bold text-white">--</div>
          <div className="text-[10px] text-neutral-500">Plan Distribution</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">User Directory</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Email
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Plan
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Signed Up
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Last Active
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Database className="w-6 h-6 text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400 mb-1">
                    No user data available
                  </p>
                  <p className="text-xs text-neutral-600">
                    Connect DATABASE_URL and run migrations to see real user
                    data.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Agents Tab ─── */

function AgentsTab({ stats }: { stats: DashboardStats | null }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = AGENT_LIST.filter((a) =>
    a.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-2xl border border-violet-500/10 bg-violet-500/[0.02]">
          <Activity className="w-4 h-4 text-violet-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {AGENT_LIST.length}
          </div>
          <div className="text-[10px] text-neutral-500">Registered Agents</div>
        </div>
        <div className="p-5 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <Zap className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {stats?.agentExecutions?.toLocaleString() || "--"}
          </div>
          <div className="text-[10px] text-neutral-500">Total Executions</div>
        </div>
        <div className="p-5 rounded-2xl border border-cyan-500/10 bg-cyan-500/[0.02]">
          <Clock className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {stats?.totalTokens
              ? `${Math.round(stats.totalTokens / 1000)}K`
              : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">Total Tokens</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
          />
        </div>
      </div>

      {/* Agent Grid */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Agent Registry</h3>
          <span className="text-[10px] text-neutral-500">
            {filtered.length} agents
          </span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
            {filtered.map((agent, i) => (
              <motion.div
                key={agent}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5) }}
                className="px-4 py-3 bg-[#0A0A0A] hover:bg-white/[0.03] transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                    <span className="text-xs text-neutral-300 font-mono">
                      {agent}
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Models Tab ─── */

function ModelsTab({ health }: { health: HealthData | null }) {
  const [filterProvider, setFilterProvider] = useState<string>("all");

  const providers = [
    "all",
    ...Array.from(new Set(MODEL_LIST.map((m) => m.provider))),
  ];
  const filtered =
    filterProvider === "all"
      ? MODEL_LIST
      : MODEL_LIST.filter((m) => m.provider === filterProvider);

  const providerStatus = (
    provider: string,
  ): "online" | "offline" | "unknown" => {
    if (!health?.services) return "unknown";
    const map: Record<string, string> = {
      "NVIDIA NIM": "nim",
      Google: "gemini",
      Anthropic: "claude",
      Groq: "groq",
      Cerebras: "cerebras",
      Ollama: "ollama",
    };
    const key = map[provider];
    if (!key) return "unknown";
    const status = health.services[key];
    if (status === "ok") return "online";
    if (status === "unconfigured" || status === "unreachable") return "offline";
    return "unknown";
  };

  return (
    <motion.div
      key="models"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-5 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <Cpu className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {MODEL_LIST.length}
          </div>
          <div className="text-[10px] text-neutral-500">Total Models</div>
        </div>
        <div className="p-5 rounded-2xl border border-cyan-500/10 bg-cyan-500/[0.02]">
          <Server className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {new Set(MODEL_LIST.map((m) => m.provider)).size}
          </div>
          <div className="text-[10px] text-neutral-500">Providers</div>
        </div>
        <div className="p-5 rounded-2xl border border-violet-500/10 bg-violet-500/[0.02]">
          <HeartPulse className="w-4 h-4 text-violet-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {health?.status === "ok"
              ? "Healthy"
              : health?.status === "degraded"
                ? "Degraded"
                : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">System Health</div>
        </div>
      </div>

      {/* Provider Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {providers.map((p) => (
          <button
            key={p}
            onClick={() => setFilterProvider(p)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
              filterProvider === p
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {p === "all" ? "All Providers" : p}
          </button>
        ))}
      </div>

      {/* Model Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Model Registry</h3>
          <span className="text-[10px] text-neutral-500">
            {filtered.length} models
          </span>
        </div>
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#0A0A0A]">
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Model
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Provider
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Category
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((model, i) => {
                const status = providerStatus(model.provider);
                return (
                  <motion.tr
                    key={model.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.5) }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-3">
                      <span className="text-xs text-neutral-200 font-medium">
                        {model.name}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-neutral-400">
                        {model.provider}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-neutral-400">
                        {model.category}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${
                          status === "online"
                            ? "text-emerald-400"
                            : status === "offline"
                              ? "text-red-400"
                              : "text-neutral-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            status === "online"
                              ? "bg-emerald-500"
                              : status === "offline"
                                ? "bg-red-500"
                                : "bg-neutral-600"
                          }`}
                        />
                        {status === "online"
                          ? "Online"
                          : status === "offline"
                            ? "Offline"
                            : "Unknown"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── System Tab ─── */

function SystemTab({
  health,
  onHealthCheck,
}: {
  health: HealthData | null;
  onHealthCheck: () => void;
}) {
  const [clearing, setClearing] = useState(false);

  const handleClearCache = () => {
    setClearing(true);
    // Simulated cache clear since there is no dedicated endpoint
    setTimeout(() => setClearing(false), 1500);
  };

  const serviceEntries = health?.services
    ? Object.entries(health.services)
    : [];

  const keyLabels: Record<string, string> = {
    nim: "NVIDIA NIM",
    gemini: "Gemini",
    claude: "Anthropic Claude",
    groq: "Groq",
    redis: "Redis (Upstash)",
    email: "Email (Resend)",
    auth: "Auth (Clerk)",
    db: "Database",
  };

  return (
    <motion.div
      key="system"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <HeartPulse className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {health?.status === "ok"
              ? "Operational"
              : health?.status === "degraded"
                ? "Degraded"
                : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">System Status</div>
        </div>
        <div className="p-5 rounded-2xl border border-cyan-500/10 bg-cyan-500/[0.02]">
          <Clock className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {health?.uptimeSeconds
              ? health.uptimeSeconds > 3600
                ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m`
                : `${Math.floor(health.uptimeSeconds / 60)}m`
              : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">Uptime</div>
        </div>
        <div className="p-5 rounded-2xl border border-violet-500/10 bg-violet-500/[0.02]">
          <Database className="w-4 h-4 text-violet-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {health?.database?.latencyMs != null &&
            health.database.latencyMs >= 0
              ? `${health.database.latencyMs}ms`
              : "--"}
          </div>
          <div className="text-[10px] text-neutral-500">DB Latency</div>
        </div>
      </div>

      {/* API Keys / Services */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] mb-6">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            Environment &amp; Services
          </h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {serviceEntries.length > 0 ? (
            serviceEntries.map(([key, status]) => (
              <div
                key={key}
                className="px-6 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {status === "ok" ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-xs text-neutral-300">
                    {keyLabels[key] || key}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${
                    status === "ok"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : status === "unconfigured"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {status === "ok" && <CheckCircle2 className="w-2.5 h-2.5" />}
                  {status === "unconfigured" && (
                    <AlertTriangle className="w-2.5 h-2.5" />
                  )}
                  {(status === "unreachable" || status === "error") && (
                    <XCircle className="w-2.5 h-2.5" />
                  )}
                  {status}
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-xs text-neutral-500">
                Run a health check to see service status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Build Info */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] mb-6">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            Build Info
          </h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Version</span>
            <span className="text-xs text-neutral-200 font-mono">
              {health?.version || "2.0.0"}
            </span>
          </div>
          <div className="px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Total Agents</span>
            <span className="text-xs text-neutral-200 font-mono">
              {health?.agents?.totalAgents || AGENT_LIST.length}
            </span>
          </div>
          <div className="px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Total Models</span>
            <span className="text-xs text-neutral-200 font-mono">
              {health?.models?.totalModels || MODEL_LIST.length}
            </span>
          </div>
          <div className="px-6 py-3.5 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Database</span>
            <span
              className={`text-xs font-mono ${
                health?.database?.status === "ok"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {health?.database?.status || "unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer disabled:opacity-50"
        >
          {clearing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          {clearing ? "Clearing..." : "Clear Cache"}
        </button>
        <button
          onClick={onHealthCheck}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
        >
          <HeartPulse className="w-3.5 h-3.5" />
          Run Health Check
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function AdminPage() {
  const { user, isLoaded } = useSafeUser();
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch("/api/agents/dashboard-stats")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/health")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (statsRes) {
        const s = statsRes.stats ?? statsRes;
        setStats({
          agentExecutions: s.agentExecutions || 0,
          leadsGenerated: s.leadsGenerated || 0,
          contentGenerated: s.contentGenerated || 0,
          bookings: s.bookings || 0,
          totalTokens: s.totalTokens || 0,
        });
      }
      if (healthRes) {
        setHealth(healthRes);
      }
      setLastRefreshed(new Date());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isAdmin) {
      fetchAll();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded, isAdmin, fetchAll]);

  // Show nothing while Clerk loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Access gate
  if (!isAdmin) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Admin Panel
                </h1>
                <p className="text-sm text-neutral-500">
                  Platform Administration
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-[10px] text-neutral-600 hidden sm:block">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
              >
                <RefreshCw
                  className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* ─── Deep Dives ─── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 grid gap-3 sm:grid-cols-2"
        >
          <Link
            href="/dashboard/admin/cohorts"
            className="group rounded-2xl border border-cyan-500/[0.12] bg-gradient-to-br from-cyan-500/[0.06] via-cyan-500/[0.02] to-transparent p-4 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.04]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-4 w-4 text-cyan-300" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    Cohort intel
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Retention pockets · super-users · weekly buckets
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
            </div>
          </Link>
          <Link
            href="/dashboard/admin/sessions"
            className="group rounded-2xl border border-amber-500/[0.12] bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.02] to-transparent p-4 transition hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-amber-300" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    Agent sessions
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Resumable state · stuck-run detection · step history
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
            </div>
          </Link>
        </motion.div>

        {/* ─── Tabs ─── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </motion.div>

        {/* ─── Loading Skeleton ─── */}
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse"
                >
                  <div className="h-4 w-4 bg-white/[0.04] rounded mb-3" />
                  <div className="h-7 w-20 bg-white/[0.04] rounded mb-2" />
                  <div className="h-2.5 w-24 bg-white/[0.04] rounded" />
                </div>
              ))}
            </div>
            <div className="h-64 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          </div>
        ) : (
          /* ─── Tab Content ─── */
          <AnimatePresence mode="wait">
            {activeTab === "users" && <UsersTab stats={stats} />}
            {activeTab === "agents" && <AgentsTab stats={stats} />}
            {activeTab === "models" && <ModelsTab health={health} />}
            {activeTab === "system" && (
              <SystemTab health={health} onHealthCheck={fetchAll} />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

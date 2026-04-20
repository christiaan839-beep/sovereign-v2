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
  Loader2,
  Key,
  Webhook,
  Copy,
  ChevronDown,
  ChevronRight,
  Zap,
  Code2,
  Globe,
} from "lucide-react";

/**
 * INTEGRATIONS HUB — Connect every tool in your stack.
 *
 * Three connection types:
 *   - "native"  → platform-level env key, auto-detected via /api/health
 *   - "oauth"   → per-user OAuth (Slack currently live)
 *   - "byok"    → bring-your-own-key (Hunter, Apollo, Clearbit, etc.)
 *   - "api"     → connects via the v1 REST API (Zapier, Make, n8n, Pipedream)
 */

// ─── Types ────────────────────────────────────────────────────

type ConnectType = "native" | "oauth" | "byok" | "api";

interface SlackStatus {
  connected: boolean;
  configurable: boolean;
  workspace?: string;
  connectedAt?: string | null;
}

function formatAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
  healthKey: string | null;
  color: string;
  connectType: ConnectType;
  byokKey?: string;    // env var name shown to user for BYOK
  docsUrl?: string;
  comingSoon?: boolean;
}

interface Category {
  name: string;
  icon: string;
  integrations: Integration[];
}

// ─── Integration Registry ─────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    name: "AI Models",
    icon: "🧠",
    integrations: [
      { id: "nvidia-nim",       name: "NVIDIA NIM",        description: "39 models — Nemotron Ultra, Llama 4, DeepSeek, Qwen 3",   healthKey: "nim",    color: "#76B900", connectType: "native" },
      { id: "google-gemini",    name: "Google Gemini",     description: "Gemini 2.5 Pro, Gemma 4, multimodal reasoning",             healthKey: "gemini", color: "#4285F4", connectType: "native" },
      { id: "anthropic-claude", name: "Anthropic Claude",  description: "Claude Sonnet/Haiku — consensus critic + extended thinking", healthKey: "claude", color: "#D97706", connectType: "native" },
      { id: "groq",             name: "Groq",              description: "Sub-100ms Llama 4 Scout and Mixtral inference",              healthKey: "groq",   color: "#F55036", connectType: "native" },
      { id: "cerebras",         name: "Cerebras",          description: "Wafer-scale, fastest Llama throughput on earth",             healthKey: null,     color: "#00D4AA", connectType: "native" },
      { id: "ollama",           name: "Ollama",            description: "Fully local model execution for air-gapped workloads",       healthKey: null,     color: "#FFFFFF", connectType: "native" },
      { id: "openai",           name: "OpenAI",            description: "GPT-4o, o3 — optional fallback model slot",                  healthKey: null,     color: "#10A37F", connectType: "byok",   byokKey: "OPENAI_API_KEY" },
      { id: "mistral",          name: "Mistral",           description: "Mistral Large and Codestral for code generation",            healthKey: null,     color: "#FF7000", connectType: "byok",   byokKey: "MISTRAL_API_KEY" },
      { id: "perplexity",       name: "Perplexity",        description: "Real-time web-grounded search and research",                 healthKey: null,     color: "#20808D", connectType: "byok",   byokKey: "PERPLEXITY_API_KEY" },
    ],
  },
  {
    name: "Automation & Workflows",
    icon: "⚡",
    integrations: [
      { id: "zapier",     name: "Zapier",     description: "6,000+ app automations — trigger any agent from any Zap",  healthKey: null, color: "#FF4A00", connectType: "api" },
      { id: "make",       name: "Make",       description: "Visual no-code workflows — call agents as HTTP modules",    healthKey: null, color: "#6D00CC", connectType: "api" },
      { id: "n8n",        name: "n8n",        description: "Self-hostable workflow engine with native HTTP nodes",      healthKey: null, color: "#EA4B71", connectType: "api" },
      { id: "pipedream",  name: "Pipedream",  description: "Code-first event-driven workflows with 1,000+ sources",    healthKey: null, color: "#3B82F6", connectType: "api" },
      { id: "workato",    name: "Workato",    description: "Enterprise iPaaS — route agent outputs to any system",     healthKey: null, color: "#00C896", connectType: "api" },
      { id: "tray",       name: "Tray.io",    description: "API-first automation for complex enterprise flows",         healthKey: null, color: "#8B5CF6", connectType: "api" },
      { id: "activepieces", name: "Activepieces", description: "Open-source Zapier alternative with self-hosting",    healthKey: null, color: "#F59E0B", connectType: "api" },
    ],
  },
  {
    name: "Data Enrichment",
    icon: "🔍",
    integrations: [
      { id: "hunter",     name: "Hunter.io",   description: "Find verified business email addresses for any domain",   healthKey: null, color: "#F97316", connectType: "byok",  byokKey: "HUNTER_API_KEY",    docsUrl: "https://hunter.io/api" },
      { id: "apollo",     name: "Apollo.io",   description: "265M contacts, 73M companies — B2B intelligence",         healthKey: null, color: "#6366F1", connectType: "byok",  byokKey: "APOLLO_API_KEY",    docsUrl: "https://apolloio.github.io/apollo-api-docs" },
      { id: "clearbit",   name: "Clearbit",    description: "Real-time company and person data enrichment API",        healthKey: null, color: "#1DA462", connectType: "byok",  byokKey: "CLEARBIT_API_KEY",  docsUrl: "https://clearbit.com/docs" },
      { id: "lusha",      name: "Lusha",       description: "Direct dials and emails from LinkedIn + web profiles",    healthKey: null, color: "#00D4A0", connectType: "byok",  byokKey: "LUSHA_API_KEY" },
      { id: "snov",       name: "Snov.io",     description: "Prospect finder + email verifier + drip campaigns",       healthKey: null, color: "#FF5C35", connectType: "byok",  byokKey: "SNOV_CLIENT_ID" },
      { id: "zoominfo",   name: "ZoomInfo",    description: "Enterprise B2B intelligence and intent data",             healthKey: null, color: "#0070C9", connectType: "byok",  byokKey: "ZOOMINFO_USERNAME", comingSoon: true },
      { id: "tavily",     name: "Tavily",      description: "Real-time AI-optimised web research — built in",          healthKey: null, color: "#00B4D8", connectType: "native" },
    ],
  },
  {
    name: "CRM & Sales",
    icon: "🎯",
    integrations: [
      { id: "hubspot",    name: "HubSpot",     description: "CRM sync — push leads, contacts, deals from agents",      healthKey: null, color: "#FF7A59", connectType: "byok",  byokKey: "HUBSPOT_ACCESS_TOKEN" },
      { id: "salesforce", name: "Salesforce",  description: "Enterprise CRM — contacts, leads, opportunities, tasks",  healthKey: null, color: "#00A1E0", connectType: "byok",  byokKey: "SALESFORCE_ACCESS_TOKEN", comingSoon: true },
      { id: "pipedrive",  name: "Pipedrive",   description: "Pipeline management — add leads directly from agents",    healthKey: null, color: "#272D37", connectType: "byok",  byokKey: "PIPEDRIVE_API_TOKEN" },
      { id: "close",      name: "Close CRM",   description: "Built for inside sales — agents post call notes",         healthKey: null, color: "#2563EB", connectType: "byok",  byokKey: "CLOSE_API_KEY" },
      { id: "gohighlevel",name: "GoHighLevel", description: "All-in-one CRM for agencies — push contacts and pipelines", healthKey: null, color: "#4F46E5", connectType: "byok", byokKey: "GHL_API_KEY" },
      { id: "lemlist",    name: "Lemlist",      description: "Cold outreach sequences — trigger from lead agents",      healthKey: null, color: "#FC6D26", connectType: "byok",  byokKey: "LEMLIST_API_KEY" },
      { id: "instantly",  name: "Instantly",   description: "Cold email at scale with AI personalisation",             healthKey: null, color: "#6D28D9", connectType: "byok",  byokKey: "INSTANTLY_API_KEY" },
    ],
  },
  {
    name: "Communication",
    icon: "💬",
    integrations: [
      { id: "slack",      name: "Slack",        description: "Channel alerts and agent notifications",                  healthKey: null, color: "#4A154B", connectType: "oauth" },
      { id: "discord",    name: "Discord",      description: "Bot integrations and community alerts",                   healthKey: null, color: "#5865F2", connectType: "byok",  byokKey: "DISCORD_BOT_TOKEN" },
      { id: "email-resend", name: "Email (Resend)", description: "Transactional email and waitlist workflows",         healthKey: "email", color: "#00B4D8", connectType: "native" },
      { id: "telegram",   name: "Telegram",     description: "Bot notifications for playbook completions",              healthKey: null, color: "#2CA5E0", connectType: "native" },
      { id: "twilio",     name: "Twilio",       description: "SMS and voice outreach automation",                       healthKey: null, color: "#F22F46", connectType: "byok",  byokKey: "TWILIO_ACCOUNT_SID" },
      { id: "sendgrid",   name: "SendGrid",     description: "High-volume transactional email delivery",                healthKey: null, color: "#1A82E2", connectType: "byok",  byokKey: "SENDGRID_API_KEY" },
    ],
  },
  {
    name: "Productivity & Data",
    icon: "📊",
    integrations: [
      { id: "notion",           name: "Notion",          description: "Write agent reports, notes, and databases",           healthKey: null, color: "#FFFFFF", connectType: "byok",  byokKey: "NOTION_TOKEN" },
      { id: "google-sheets",    name: "Google Sheets",   description: "Spreadsheet data source and export target",           healthKey: null, color: "#34A853", connectType: "byok",  byokKey: "GOOGLE_SERVICE_ACCOUNT" },
      { id: "airtable",         name: "Airtable",        description: "Structured data tables for agent outputs",            healthKey: null, color: "#FCB400", connectType: "byok",  byokKey: "AIRTABLE_TOKEN" },
      { id: "google-docs",      name: "Google Docs",     description: "Publish long-form agent reports directly to Docs",    healthKey: null, color: "#4285F4", connectType: "byok",  byokKey: "GOOGLE_SERVICE_ACCOUNT" },
      { id: "neon-postgres",    name: "Neon PostgreSQL", description: "Serverless database — platform data store",           healthKey: "db", color: "#00E599", connectType: "native" },
      { id: "pinecone",         name: "Pinecone",        description: "Vector search for agent memory and RAG",              healthKey: null, color: "#00A5B5", connectType: "byok",  byokKey: "PINECONE_API_KEY" },
      { id: "supabase",         name: "Supabase",        description: "Postgres + realtime + storage for agent data",        healthKey: null, color: "#3ECF8E", connectType: "byok",  byokKey: "SUPABASE_SERVICE_KEY" },
    ],
  },
  {
    name: "Voice & Media",
    icon: "🎙️",
    integrations: [
      { id: "nvidia-tts",   name: "NVIDIA Magpie TTS", description: "Sub-300ms neural TTS — built in via NIM",            healthKey: "nim",  color: "#76B900", connectType: "native" },
      { id: "elevenlabs",   name: "ElevenLabs",        description: "Hyper-realistic voice clones for outreach agents",    healthKey: null,   color: "#FF6B35", connectType: "byok",  byokKey: "ELEVENLABS_API_KEY" },
      { id: "deepgram",     name: "Deepgram",          description: "Real-time STT — transcribe calls and meetings",       healthKey: null,   color: "#2196F3", connectType: "byok",  byokKey: "DEEPGRAM_API_KEY" },
      { id: "assemblyai",   name: "AssemblyAI",        description: "Call transcription with speaker diarisation",         healthKey: null,   color: "#6C5CE7", connectType: "byok",  byokKey: "ASSEMBLYAI_API_KEY" },
      { id: "fal",          name: "fal.ai",            description: "FLUX image generation and video synthesis",           healthKey: null,   color: "#FF3366", connectType: "byok",  byokKey: "FAL_KEY" },
    ],
  },
  {
    name: "Development",
    icon: "⚙️",
    integrations: [
      { id: "github",    name: "GitHub",    description: "Repository access, PR creation, deployment triggers",     healthKey: null, color: "#8B5CF6", connectType: "byok",  byokKey: "GITHUB_TOKEN" },
      { id: "gitlab",    name: "GitLab",    description: "CI/CD pipelines and merge request automation",            healthKey: null, color: "#FC6D26", connectType: "byok",  byokKey: "GITLAB_TOKEN" },
      { id: "linear",    name: "Linear",    description: "Issue creation and sprint planning from agents",          healthKey: null, color: "#5E6AD2", connectType: "byok",  byokKey: "LINEAR_API_KEY" },
      { id: "jira",      name: "Jira",      description: "Enterprise ticketing — push agent findings as issues",   healthKey: null, color: "#0052CC", connectType: "byok",  byokKey: "JIRA_TOKEN" },
      { id: "vercel",    name: "Vercel",    description: "Production deployments and edge function triggers",      healthKey: null, color: "#FFFFFF", connectType: "native" },
      { id: "clerk",     name: "Clerk",     description: "Authentication and multi-tenant user management",        healthKey: "auth", color: "#6C47FF", connectType: "native" },
    ],
  },
  {
    name: "Payments",
    icon: "💳",
    integrations: [
      { id: "stripe",   name: "Stripe",   description: "Global payments, subscriptions, and Connect payouts",  healthKey: null, color: "#635BFF", connectType: "native" },
      { id: "payfast",  name: "PayFast",  description: "South African payment gateway",                        healthKey: null, color: "#00457C", connectType: "native" },
      { id: "yoco",     name: "Yoco",     description: "Card payments for African markets",                    healthKey: null, color: "#005AFF", connectType: "byok",  byokKey: "YOCO_SECRET_KEY" },
      { id: "paystack", name: "Paystack", description: "Payments infrastructure for Africa",                   healthKey: null, color: "#00C3F7", connectType: "byok",  byokKey: "PAYSTACK_SECRET_KEY" },
    ],
  },
];

const ALL_INTEGRATIONS = CATEGORIES.flatMap((c) => c.integrations);

// ─── Helpers ──────────────────────────────────────────────────

function isConnected(integration: Integration, services: HealthServices, slackData: SlackStatus | null): boolean {
  if (integration.id === "slack") return Boolean(slackData?.connected);
  if (integration.connectType === "api") return true; // Always available via v1 API
  if (!integration.healthKey) return false;
  return services[integration.healthKey] === "ok";
}

function getStatusLabel(integration: Integration, connected: boolean): string {
  if (integration.connectType === "api") return "Available via API";
  if (integration.comingSoon) return "Coming Soon";
  if (connected) return "Connected";
  if (integration.connectType === "byok") return "Add API Key";
  return "Not Connected";
}

function getStatusColor(integration: Integration, connected: boolean): string {
  if (integration.connectType === "api") return "text-sky-400";
  if (integration.comingSoon) return "text-neutral-600";
  if (connected) return "text-emerald-400";
  if (integration.connectType === "byok") return "text-amber-400";
  return "text-neutral-500";
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// ─── BYOK Panel ───────────────────────────────────────────────

function ByokPanel({ integration, onClose }: { integration: Integration; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/settings/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: integration.byokKey, value: value.trim() }),
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="mt-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] space-y-3"
    >
      <div className="flex items-center gap-2">
        <Key className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-amber-400">Add your {integration.name} key</span>
      </div>
      <p className="text-[11px] text-neutral-500">
        Stored encrypted in your account settings. Used only for your agent runs.
        {integration.docsUrl && (
          <> <a href={integration.docsUrl} target="_blank" rel="noopener" className="text-amber-400/70 hover:text-amber-400 underline">Get key →</a></>
        )}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`${integration.byokKey ?? "API_KEY"}`}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/30"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={saving || !value.trim()}
          className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-[11px] font-semibold border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 transition-all"
        >
          {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Webhook Section ──────────────────────────────────────────

function WebhookSection() {
  const [copied, setCopied] = useState("");
  const endpoint = "https://sovereignmatrix.agency/api/v1/agents/leads";
  const exampleCurl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"niche":"SaaS","location":"Austin TX"}'`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <section className="mb-10 p-6 rounded-2xl border border-sky-500/15 bg-sky-500/[0.03]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Webhook className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Connect Any Automation Tool</h2>
          </div>
          <p className="text-[12px] text-neutral-500">
            Every agent is callable via the v1 REST API. Use your API key to connect Zapier, Make, n8n, Pipedream — or any HTTP client.
          </p>
        </div>
        <a
          href="/dashboard/settings/api-keys"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all"
        >
          <Key className="w-3 h-3" /> Get API Key
        </a>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-5">
        {[
          { icon: "⚡", tool: "Zapier", desc: "Use the 'Webhook by Zapier' action → POST to any agent endpoint" },
          { icon: "🔧", tool: "Make (Integromat)", desc: "HTTP module → POST with Bearer auth header" },
          { icon: "🔄", tool: "n8n", desc: "HTTP Request node → connect to /api/v1/agents/* routes" },
        ].map((t) => (
          <div key={t.tool} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-base mb-1.5">{t.icon}</div>
            <div className="text-[12px] font-semibold text-white mb-1">{t.tool}</div>
            <div className="text-[11px] text-neutral-500 leading-snug">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] font-mono text-neutral-500">Example — Run Leads Agent</span>
          </div>
          <button
            onClick={() => copy(exampleCurl, "curl")}
            className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied === "curl" ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="px-4 py-4 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre">
          {exampleCurl}
        </pre>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-600">
        <a href="/developers/docs" className="hover:text-neutral-400 transition-colors flex items-center gap-1">
          <Globe className="w-3 h-3" /> Full API docs
        </a>
        <a href="/dashboard/settings/api-keys" className="hover:text-neutral-400 transition-colors flex items-center gap-1">
          <Key className="w-3 h-3" /> Manage API keys
        </a>
        <a href="/dashboard/webhook-log" className="hover:text-neutral-400 transition-colors flex items-center gap-1">
          <Zap className="w-3 h-3" /> Webhook logs
        </a>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [services, setServices] = useState<HealthServices>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [slackBusy, setSlackBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [byokOpen, setByokOpen] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.name)) // All expanded by default
  );

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services ?? {});
        setLastUpdated(new Date());
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlack = useCallback(async () => {
    try {
      const res = await fetch("/api/_integrations/slack/status");
      if (res.ok) setSlack((await res.json()) as SlackStatus);
    } catch {
      /* keep prior state */
    }
  }, []);

  const handleSlackDisconnect = useCallback(async () => {
    if (!confirm("Disconnect Slack? Playbooks using slack-notify will stop until reconnected.")) return;
    setSlackBusy(true);
    try {
      const res = await fetch("/api/_integrations/slack/disconnect", { method: "POST" });
      setToast(res.ok ? "Slack disconnected." : "Failed to disconnect Slack.");
      await fetchSlack();
    } catch {
      setToast("Failed to disconnect Slack.");
    } finally {
      setSlackBusy(false);
    }
  }, [fetchSlack]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "slack") setToast("Slack connected successfully.");
    else if (params.get("slack_error")) setToast(`Slack error: ${params.get("slack_error")}`);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetchHealth();
    fetchSlack();
  }, [fetchHealth, fetchSlack]);

  function toggleCategory(name: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const connectedCount = ALL_INTEGRATIONS.filter((i) => isConnected(i, services, slack)).length;

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
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="status"
            className="fixed top-6 right-6 z-50 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm backdrop-blur-xl shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Plug className="w-3 h-3" /> Integrations
          </div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {ALL_INTEGRATIONS.length} services ·{" "}
            <span className="text-emerald-400">{connectedCount} connected</span>
            {" "}· All agents callable via the v1 REST API
          </p>
        </div>
        <div className="text-right">
          {lastUpdated && (
            <p className="text-[10px] text-neutral-600 mb-1">
              Checked {lastUpdated.toLocaleTimeString()}
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
          placeholder={`Search ${ALL_INTEGRATIONS.length} integrations…`}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/30 transition-colors"
        />
      </div>

      {/* Webhook / API section — always visible */}
      {!search && <WebhookSection />}

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] animate-pulse">
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
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.name) || Boolean(search);
            return (
              <section key={category.name} className="mb-8">
                {/* Category header — collapsible */}
                <button
                  onClick={() => !search && toggleCategory(category.name)}
                  className="w-full flex items-center justify-between mb-4 group"
                >
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>{category.icon}</span>
                    {category.name}
                    <span className="text-[10px] font-normal text-neutral-600">
                      {category.integrations.length}
                    </span>
                  </h2>
                  {!search && (
                    <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {category.integrations.map((integration, i) => {
                          const connected = isConnected(integration, services, slack);
                          const subtitle =
                            integration.id === "slack" && slack?.connected
                              ? `${slack.workspace}${slack.connectedAt ? ` · connected ${formatAgo(slack.connectedAt)}` : ""}`
                              : integration.description;
                          const showByok = byokOpen === integration.id;

                          return (
                            <motion.div
                              key={integration.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.25, ease: "easeOut" }}
                              className={`group relative p-5 rounded-2xl border transition-colors ${
                                connected
                                  ? "border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/30"
                                  : integration.connectType === "api"
                                  ? "border-sky-500/15 bg-sky-500/[0.02] hover:border-sky-500/25"
                                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"
                              }`}
                            >
                              {integration.comingSoon && (
                                <div className="absolute top-3 right-3 px-1.5 py-0.5 rounded text-[9px] font-bold text-neutral-600 bg-white/5 border border-white/[0.06] uppercase tracking-wider">
                                  Soon
                                </div>
                              )}

                              {/* Top row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border border-white/10"
                                    style={{ backgroundColor: `${integration.color}15`, color: integration.color }}
                                  >
                                    {getInitial(integration.name)}
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
                                    <p className="text-[11px] text-neutral-500 leading-snug max-w-[180px]">{subtitle}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Status + Action */}
                              <div className="flex items-center justify-between mt-4">
                                <div className={`flex items-center gap-1.5 ${getStatusColor(integration, connected)}`}>
                                  {connected && integration.connectType !== "api" ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : integration.connectType === "api" ? (
                                    <Webhook className="w-3.5 h-3.5" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5" />
                                  )}
                                  <span className="text-[11px] font-medium">
                                    {getStatusLabel(integration, connected)}
                                  </span>
                                </div>

                                {/* Action button */}
                                {integration.id === "slack" ? (
                                  connected ? (
                                    <button
                                      onClick={handleSlackDisconnect}
                                      disabled={slackBusy}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-all"
                                    >
                                      {slackBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Settings className="w-3 h-3" />}
                                      Disconnect
                                    </button>
                                  ) : (
                                    <a
                                      href={slack?.configurable === false ? "#" : "/api/_integrations/slack/authorize"}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                                        slack?.configurable === false
                                          ? "bg-white/[0.03] text-neutral-600 border-white/[0.06] cursor-not-allowed"
                                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                      }`}
                                      onClick={(e) => { if (slack?.configurable === false) e.preventDefault(); }}
                                    >
                                      <Link className="w-3 h-3" /> Connect
                                    </a>
                                  )
                                ) : integration.connectType === "byok" && !integration.comingSoon ? (
                                  <button
                                    onClick={() => setByokOpen(showByok ? null : integration.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                  >
                                    <Key className="w-3 h-3" /> Add Key
                                  </button>
                                ) : integration.connectType === "api" ? (
                                  <a
                                    href="#webhook-section"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20 transition-all"
                                  >
                                    <ExternalLink className="w-3 h-3" /> View Setup
                                  </a>
                                ) : integration.connectType === "native" ? (
                                  <span className="text-[10px] font-mono text-neutral-600">
                                    {connected ? "Platform key" : "Not configured"}
                                  </span>
                                ) : null}
                              </div>

                              {/* BYOK inline panel */}
                              <AnimatePresence>
                                {showByok && <ByokPanel integration={integration} onClose={() => setByokOpen(null)} />}
                              </AnimatePresence>

                              {/* Hover glow */}
                              <div
                                className="absolute -bottom-8 -right-8 w-24 h-24 blur-[40px] opacity-0 group-hover:opacity-25 transition-opacity pointer-events-none rounded-full"
                                style={{ backgroundColor: integration.color }}
                              />
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}

          {/* Empty search state */}
          {filteredCategories.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-neutral-500"
            >
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">No integrations match &apos;{search}&apos;.</p>
            </motion.div>
          )}

          {/* Request Integration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-white font-medium mb-1">Don&apos;t see what you need?</p>
              <p className="text-[12px] text-neutral-500">Any HTTP endpoint can call our v1 API. Request native integration for OAuth-based services.</p>
            </div>
            <a
              href="/contact"
              className="shrink-0 ml-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 font-semibold rounded-xl text-sm border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Request
            </a>
          </motion.div>
        </>
      )}
    </div>
  );
}

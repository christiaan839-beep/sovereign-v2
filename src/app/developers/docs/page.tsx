"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Key,
  Bot,
  Play,
  BarChart3,
  Webhook,
  Copy,
  CheckCircle2,
  ArrowRight,
  Zap,
  ChevronRight,
  ExternalLink,
  Shield,
  Clock,
} from "lucide-react";

/* ────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────── */

type StatusBadge = "Stable" | "Beta" | "Coming Soon";

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  status: StatusBadge;
  auth: boolean;
  requestBody?: string;
  responseBody: string;
  notes?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  endpoints: Endpoint[];
}

/* ────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────── */

const RATE_LIMITS = [
  {
    plan: "Free",
    requests: "50 / day",
    color: "text-neutral-400",
    bg: "bg-neutral-500/10",
    border: "border-neutral-500/20",
  },
  {
    plan: "Pro",
    requests: "500 / day",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    price: "$49/mo",
  },
  {
    plan: "Team",
    requests: "2,000 / day",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    price: "$199/mo",
  },
  {
    plan: "Enterprise",
    requests: "10,000 / day",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    price: "Custom",
  },
];

const SECTIONS: Section[] = [
  {
    id: "authentication",
    title: "Authentication",
    icon: Key,
    description:
      "All authenticated endpoints require a Bearer token from Clerk. Pass it in the Authorization header with every request. Free endpoints (marked below) do not require authentication.",
    endpoints: [],
  },
  {
    id: "agents",
    title: "Agents",
    icon: Bot,
    description:
      "Execute any of 130+ specialized AI agents. Each agent handles a specific task -- lead generation, content writing, SEO analysis, competitor scanning, and more.",
    endpoints: [
      {
        id: "free-run",
        method: "POST",
        path: "/api/free/run",
        description:
          "Execute an agent without authentication. Limited to read-only agents (seo-dominator, leads, brand-voice, competitor-scan, brand-audit). Rate limited to 3 requests per hour per IP.",
        status: "Stable",
        auth: false,
        requestBody: `{
  "agent": "seo-dominator",
  "params": {
    "prompt": "Analyze SEO for example.com",
    "url": "https://example.com"
  }
}`,
        responseBody: `{
  "success": true,
  "data": {
    "analysis": "...",
    "score": 72,
    "recommendations": [...]
  },
  "model": "gemini-2.0-flash",
  "responseTimeMs": 2340,
  "_free": {
    "remaining": 2,
    "limit": 3
  }
}`,
        notes:
          "Allowed agents: seo-dominator, seo, leads, brand-voice, competitor-scan, competitor, brand-audit. The _free object shows remaining requests in your hourly window.",
      },
      {
        id: "agent-call",
        method: "POST",
        path: "/api/agents/{agentId}",
        description:
          "Execute any agent by name. Requires authentication. The agent factory handles rate limiting, the 5-layer safety pipeline (jailbreak detection, PII scan, content safety, quality scoring, critic review), and model routing automatically.",
        status: "Stable",
        auth: true,
        requestBody: `{
  "prompt": "Find 50 fintech leads in NYC",
  "url": "https://target-company.com",
  "confirmed": true
}`,
        responseBody: `{
  "success": true,
  "data": {
    "result": "...",
    "metadata": {
      "model": "nemotron-ultra-253b-v1",
      "tokensUsed": 1847,
      "safetyScore": 0.98,
      "qualityScore": 0.91
    }
  },
  "responseTimeMs": 3120
}`,
        notes:
          "The {agentId} can be any registered agent (e.g., leads, blog-gen, seo-dominator, page-builder, voice-chat). Pass confirmed: true to skip the confirmation step. Response headers include X-Agent, X-Response-Time, and X-Powered-By.",
      },
      {
        id: "dashboard-stats",
        method: "GET",
        path: "/api/agents/dashboard-stats",
        description:
          "Retrieve aggregated metrics for the authenticated user: total agent executions, token usage, leads generated, bookings, content pieces, recent activity, and cross-agent signal stats.",
        status: "Stable",
        auth: true,
        responseBody: `{
  "stats": {
    "agentExecutions": 142,
    "totalTokens": 284930,
    "leadsGenerated": 87,
    "bookings": 12,
    "contentGenerated": 34
  },
  "recentActivity": [
    {
      "agentId": "leads",
      "model": "gemini-2.0-flash",
      "tokens": 1200,
      "createdAt": "2026-04-07T10:30:00Z"
    }
  ],
  "signals": {
    "totalSignals": 56,
    "lastHour": 3,
    "activeSubscriptions": 8,
    "topSources": ["leads", "seo-dominator"]
  },
  "timestamp": "2026-04-07T12:00:00Z"
}`,
        notes:
          "Returns zeros gracefully if the database is unavailable. Use this endpoint to populate analytics dashboards and usage meters.",
      },
    ],
  },
  {
    id: "playbooks",
    title: "Playbooks",
    icon: Play,
    description:
      "Playbooks are multi-step agent workflows. Start a playbook, then poll for live step-by-step progress. Each step executes a different agent in sequence, with outputs piped between steps.",
    endpoints: [
      {
        id: "playbook-run",
        method: "POST",
        path: "/api/playbooks/run",
        description:
          "Start a playbook execution. Returns immediately in async mode (recommended) with a runId and poll URL. Steps execute sequentially, each calling a specialized agent. Outputs from earlier steps are injected as context into later steps.",
        status: "Stable",
        auth: true,
        requestBody: `{
  "playbook_id": "lead-blitz",
  "inputs": {
    "url": "https://target-company.com",
    "industry": "fintech",
    "count": "50"
  },
  "async": true
}`,
        responseBody: `{
  "runId": "run_abc123def456",
  "status": "running",
  "pollUrl": "/api/playbooks/runs/run_abc123def456"
}`,
        notes:
          "Set async: true to get a 202 response immediately and poll for progress. Without async, the request blocks until all steps complete. Plan limits are enforced -- exceeding your monthly quota returns 429 with usage details and an upgrade URL.",
      },
      {
        id: "playbook-runs",
        method: "GET",
        path: "/api/playbooks/runs",
        description:
          "List the last 30 playbook runs for the authenticated user. Each run includes step summaries (agent name, status, duration) but not full result payloads.",
        status: "Stable",
        auth: true,
        responseBody: `{
  "runs": [
    {
      "id": "run_abc123def456",
      "playbookId": "lead-blitz",
      "playbookName": "Lead Blitz",
      "status": "done",
      "stepCount": 4,
      "stepsSucceeded": 4,
      "stepsFailed": 0,
      "durationMs": 12400,
      "createdAt": "2026-04-07T09:15:00Z",
      "completedAt": "2026-04-07T09:15:12Z",
      "steps": [
        {
          "stepIndex": 0,
          "agentName": "leads",
          "reason": "Find target leads",
          "status": "done",
          "durationMs": 3200
        }
      ]
    }
  ]
}`,
        notes:
          "Returns an empty array if the database tables have not been migrated yet. Use this to build a run history dashboard.",
      },
      {
        id: "playbook-run-detail",
        method: "GET",
        path: "/api/playbooks/runs/{id}",
        description:
          'Get full details for a single playbook run, including all step results. Poll this endpoint every 2 seconds while status is "running" to show live step-by-step progress.',
        status: "Stable",
        auth: true,
        responseBody: `{
  "id": "run_abc123def456",
  "playbookId": "lead-blitz",
  "playbookName": "Lead Blitz",
  "status": "running",
  "stepCount": 4,
  "stepsSucceeded": 2,
  "stepsFailed": 0,
  "currentStep": 2,
  "progress": 50,
  "done": false,
  "steps": [
    {
      "stepIndex": 0,
      "agentName": "leads",
      "status": "done",
      "result": "{...}",
      "durationMs": 3200,
      "startedAt": "2026-04-07T09:15:00Z",
      "completedAt": "2026-04-07T09:15:03Z"
    },
    {
      "stepIndex": 1,
      "agentName": "blog-gen",
      "status": "done",
      "result": "{...}",
      "durationMs": 4100
    },
    {
      "stepIndex": 2,
      "agentName": "seo-dominator",
      "status": "running",
      "result": null,
      "durationMs": null
    },
    {
      "stepIndex": 3,
      "agentName": "email-writer",
      "status": "pending",
      "result": null,
      "durationMs": null
    }
  ]
}`,
        notes:
          'The done field is true when status is "done" or "failed". The progress field is a percentage (0-100). The currentStep field is the index of the currently running step, or -1 if none are running.',
      },
    ],
  },
  {
    id: "models",
    title: "Models",
    icon: BarChart3,
    description:
      "The platform routes requests through 35+ models across 6 providers (NVIDIA NIM, Google Gemini, Anthropic Claude, Groq, Ollama, Tavily). The smart router selects the optimal model per task, with an 11-model failover chain.",
    endpoints: [
      {
        id: "model-list",
        method: "GET",
        path: "/api/agents/smart-router",
        description:
          "Returns the list of all registered agents and available models. Use this to discover agent names for the POST endpoint.",
        status: "Stable",
        auth: false,
        responseBody: `{
  "agents": [
    "leads",
    "blog-gen",
    "seo-dominator",
    "page-builder",
    "voice-chat",
    "competitor-scan",
    "brand-voice",
    "...130+ agents"
  ],
  "count": 130,
  "usage": "POST /api/agents/{agent-name} with { prompt: '...' }"
}`,
        notes:
          "The smart router classifies tasks across 19 categories and picks from 22 models. Consensus verification uses 4 independent models: Nemotron Ultra, DeepSeek V3.2, Gemma 4, and Qwen 3.",
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    icon: Webhook,
    description:
      "Trigger agent executions from external systems via webhooks. Useful for connecting Zapier, Make, n8n, or custom integrations.",
    endpoints: [
      {
        id: "webhook-trigger",
        method: "POST",
        path: "/api/agents/trigger",
        description:
          "Webhook endpoint for external automation. Accepts a JSON payload with the agent name and parameters. Authenticates via a shared secret in the Authorization header.",
        status: "Beta",
        auth: true,
        requestBody: `{
  "agent": "leads",
  "params": {
    "prompt": "Find 20 SaaS leads in healthcare",
    "url": "https://example.com"
  },
  "webhook_url": "https://your-app.com/callback"
}`,
        responseBody: `{
  "success": true,
  "runId": "trigger_xyz789",
  "message": "Agent triggered. Results will be sent to webhook_url."
}`,
        notes:
          "If webhook_url is provided, results are POSTed to that URL when execution completes. Otherwise, use the runId to poll for results.",
      },
      {
        id: "waitlist",
        method: "POST",
        path: "/api/waitlist",
        description:
          "Add an email to the early access waitlist. No authentication required. Idempotent -- duplicate emails are ignored.",
        status: "Stable",
        auth: false,
        requestBody: `{
  "email": "developer@example.com"
}`,
        responseBody: `{
  "ok": true
}`,
        notes:
          "Always returns 200 with { ok: true }, even on internal errors. This ensures the frontend never shows an error state to potential users.",
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────
   COMPONENTS
   ──────────────────────────────────────────────────────── */

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[#050505] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05] bg-[#030303]">
        <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
          {label || "json"}
        </span>
        <button
          onClick={copy}
          className="text-[10px] text-neutral-500 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          {copied ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-[13px] font-mono text-neutral-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function StatusBadgeTag({ status }: { status: StatusBadge }) {
  const styles = {
    Stable: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Beta: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Coming Soon": "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${styles[status]}`}
    >
      {status === "Stable" && <Shield className="w-2.5 h-2.5" />}
      {status === "Beta" && <Zap className="w-2.5 h-2.5" />}
      {status === "Coming Soon" && <Clock className="w-2.5 h-2.5" />}
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    POST: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${colors[method] || colors.GET}`}
    >
      {method}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <MethodBadge method={endpoint.method} />
            <code className="text-sm font-mono text-white truncate">
              {endpoint.path}
            </code>
            <StatusBadgeTag status={endpoint.status} />
            {!endpoint.auth && (
              <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                No Auth
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {endpoint.description}
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-neutral-500 shrink-0 mt-1 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expandable detail */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25 }}
          className="border-t border-white/[0.05] px-5 pb-5 space-y-4"
        >
          {endpoint.requestBody && (
            <div className="pt-4">
              <h4 className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider mb-2">
                Request Body
              </h4>
              <CodeBlock code={endpoint.requestBody} label="json -- request" />
            </div>
          )}
          <div className={endpoint.requestBody ? "" : "pt-4"}>
            <h4 className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider mb-2">
              Response
            </h4>
            <CodeBlock code={endpoint.responseBody} label="json -- response" />
          </div>
          {endpoint.notes && (
            <div className="p-3.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10">
              <p className="text-xs text-neutral-400 leading-relaxed">
                <span className="text-emerald-400 font-semibold">Note: </span>
                {endpoint.notes}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────
   SIDEBAR NAV
   ──────────────────────────────────────────────────────── */

function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      <div className="px-3 pb-2 mb-2 border-b border-white/[0.05]">
        <Link
          href="/developers"
          className="text-[10px] text-neutral-500 hover:text-neutral-300 uppercase tracking-wider font-medium transition-colors flex items-center gap-1"
        >
          <ArrowRight className="w-3 h-3 rotate-180" />
          Back to SDK
        </Link>
      </div>
      <button
        onClick={() => onNavigate("quick-start")}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active === "quick-start"
            ? "bg-emerald-500/10 text-emerald-400"
            : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
        }`}
      >
        Quick Start
      </button>
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            onClick={() => onNavigate(section.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              active === section.id
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {section.title}
          </button>
        );
      })}
      <button
        onClick={() => onNavigate("rate-limits")}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
          active === "rate-limits"
            ? "bg-emerald-500/10 text-emerald-400"
            : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        Rate Limits
      </button>
      <button
        onClick={() => onNavigate("errors")}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
          active === "errors"
            ? "bg-emerald-500/10 text-emerald-400"
            : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
        }`}
      >
        <Zap className="w-3.5 h-3.5" />
        Errors
      </button>
    </nav>
  );
}

/* ────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────── */

const CURL_EXAMPLE = `curl -X POST https://sovereignmatrix.agency/api/agents/leads \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Find 50 fintech leads in NYC",
    "confirmed": true
  }'`;

const RESPONSE_EXAMPLE = `{
  "success": true,
  "data": {
    "leads": [
      { "company": "Acme Corp", "contact": "jane@acme.com", "score": 87 },
      { "company": "Beta Inc", "contact": "john@beta.io", "score": 82 }
    ],
    "count": 50,
    "model": "gemini-2.0-flash"
  },
  "responseTimeMs": 2340
}`;

const ERROR_CODES = [
  { code: "400", description: "Bad Request -- Missing or invalid parameters." },
  {
    code: "401",
    description: "Unauthorized -- Missing or invalid Bearer token.",
  },
  {
    code: "404",
    description: "Not Found -- Agent or playbook does not exist.",
  },
  {
    code: "429",
    description:
      "Too Many Requests -- Rate limit or plan quota exceeded. Check the usage object in the response body.",
  },
  {
    code: "500",
    description:
      "Internal Server Error -- Agent execution failed. Check the error field for details.",
  },
  {
    code: "502",
    description:
      "Bad Gateway -- Upstream model provider is temporarily unavailable. Retry with exponential backoff.",
  },
  {
    code: "503",
    description:
      "Service Unavailable -- Database tables not migrated. Run the SQL migration scripts.",
  },
];

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("quick-start");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* Track which section is in view */
  useEffect(() => {
    const ids = [
      "quick-start",
      ...SECTIONS.map((s) => s.id),
      "rate-limits",
      "errors",
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#010101]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-bold text-white hover:text-emerald-400 transition-colors"
            >
              Sovereign Matrix
            </Link>
            <ChevronRight className="w-3 h-3 text-neutral-600" />
            <span className="text-sm text-neutral-400">API Docs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/developers"
              className="hidden sm:inline-flex text-xs text-neutral-400 hover:text-white transition-colors"
            >
              SDK Guide
            </Link>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors"
            >
              Get API Key <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-8">
          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-56 shrink-0 py-8 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <Sidebar active={activeSection} onNavigate={handleNavigate} />
          </aside>

          {/* Mobile nav toggle */}
          <div className="lg:hidden fixed bottom-6 right-6 z-50">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg shadow-emerald-500/20"
            >
              <Bot className="w-5 h-5" />
            </button>
            {mobileNavOpen && (
              <div className="absolute bottom-16 right-0 w-56 rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-3 shadow-2xl">
                <Sidebar active={activeSection} onNavigate={handleNavigate} />
              </div>
            )}
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0 py-8 space-y-16 pb-32">
            {/* ─── HERO ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium uppercase tracking-wider mb-5">
                <Bot className="w-3 h-3" />
                API Reference v1
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
                Sovereign Matrix API
              </h1>
              <p className="text-base text-neutral-400 max-w-2xl leading-relaxed">
                Build on 130+ autonomous AI agents. Execute agents, run
                multi-step playbooks, retrieve analytics, and trigger workflows
                -- all through a single REST API with built-in safety, rate
                limiting, and model routing.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Base URL:{" "}
                  <code className="text-neutral-300 font-mono">
                    https://sovereignmatrix.agency
                  </code>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Format: JSON
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Auth: Bearer Token (Clerk)
                </span>
              </div>
            </motion.div>

            {/* ─── QUICK START ─── */}
            <section id="quick-start">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-xl font-bold mb-1">Quick Start</h2>
                <p className="text-sm text-neutral-500 mb-6">
                  Make your first API call in under 30 seconds.
                </p>

                {/* Steps */}
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                  {[
                    {
                      step: "01",
                      title: "Get your API key",
                      desc: "Sign up and generate a key from the dashboard integrations page.",
                    },
                    {
                      step: "02",
                      title: "Make a request",
                      desc: "POST to any agent endpoint with your Bearer token and a JSON body.",
                    },
                    {
                      step: "03",
                      title: "Get results",
                      desc: "Receive structured JSON with the agent\u2019s output, model info, and timing.",
                    },
                  ].map((item, i) => (
                    <motion.div
                      key={item.step}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08, duration: 0.35 }}
                      className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]"
                    >
                      <div className="text-2xl font-black text-emerald-500/20 font-mono mb-2">
                        {item.step}
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        {item.desc}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* curl example */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider mb-2">
                      Request
                    </h4>
                    <CodeBlock code={CURL_EXAMPLE} label="bash -- curl" />
                  </div>
                  <div>
                    <h4 className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider mb-2">
                      Response
                    </h4>
                    <CodeBlock code={RESPONSE_EXAMPLE} label="json -- 200 OK" />
                  </div>
                </div>
              </motion.div>
            </section>

            {/* ─── SECTION BLOCKS ─── */}
            {SECTIONS.map((section) => {
              const SectionIcon = section.icon;
              return (
                <section key={section.id} id={section.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                  >
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <SectionIcon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <h2 className="text-xl font-bold">{section.title}</h2>
                    </div>
                    <p className="text-sm text-neutral-400 leading-relaxed mb-6 ml-11">
                      {section.description}
                    </p>

                    {/* Auth section — special content */}
                    {section.id === "authentication" && (
                      <div className="space-y-4 ml-11">
                        <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                          <h3 className="text-sm font-semibold text-white mb-3">
                            Bearer Token Authentication
                          </h3>
                          <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                            Include your API key in the{" "}
                            <code className="px-1.5 py-0.5 rounded bg-white/[0.05] text-emerald-400 text-xs font-mono">
                              Authorization
                            </code>{" "}
                            header of every request. Generate your key from the{" "}
                            <Link
                              href="/dashboard/integrations"
                              className="text-emerald-400 hover:underline"
                            >
                              dashboard integrations page
                            </Link>
                            .
                          </p>
                          <CodeBlock
                            code={`Authorization: Bearer sk_live_your_api_key`}
                            label="header"
                          />
                        </div>
                        <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                          <h3 className="text-sm font-semibold text-white mb-3">
                            Unauthenticated Endpoints
                          </h3>
                          <p className="text-sm text-neutral-400 leading-relaxed">
                            Some endpoints (marked &quot;No Auth&quot;) work
                            without a token. These are rate-limited by IP
                            address and restricted to read-only agents. Use{" "}
                            <code className="px-1.5 py-0.5 rounded bg-white/[0.05] text-emerald-400 text-xs font-mono">
                              POST /api/free/run
                            </code>{" "}
                            for unauthenticated agent access.
                          </p>
                        </div>
                        <div className="p-5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03]">
                          <h3 className="text-sm font-semibold text-amber-400 mb-2">
                            Security Best Practices
                          </h3>
                          <ul className="text-sm text-neutral-400 space-y-1.5 leading-relaxed">
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">--</span>
                              Never expose your API key in client-side code or
                              public repositories.
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">--</span>
                              Use environment variables to store your key on the
                              server.
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">--</span>
                              Rotate your key immediately if you suspect it has
                              been compromised.
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">--</span>
                              All requests pass through a 5-layer safety
                              pipeline (jailbreak detection, PII scanning,
                              content safety, quality scoring, critic review).
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Endpoint cards */}
                    {section.endpoints.length > 0 && (
                      <div className="space-y-3 ml-11">
                        {section.endpoints.map((ep) => (
                          <EndpointCard key={ep.id} endpoint={ep} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </section>
              );
            })}

            {/* ─── RATE LIMITS ─── */}
            <section id="rate-limits">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold">Rate Limits</h2>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6 ml-11">
                  Rate limits are enforced per user per day. When you exceed
                  your limit, the API returns a 429 response with your current
                  usage and an upgrade URL.
                </p>

                <div className="ml-11 space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RATE_LIMITS.map((tier, i) => (
                      <motion.div
                        key={tier.plan}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06, duration: 0.3 }}
                        className={`p-5 rounded-xl border ${tier.border} ${tier.bg} relative overflow-hidden`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className={`text-base font-bold ${tier.color}`}>
                            {tier.plan}
                          </h3>
                          {tier.price && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {tier.price}
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-mono font-bold text-white">
                          {tier.requests}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                    <h4 className="text-sm font-semibold text-white mb-2">
                      Rate Limit Headers
                    </h4>
                    <p className="text-sm text-neutral-400 mb-3 leading-relaxed">
                      Every response includes rate limit information in headers:
                    </p>
                    <CodeBlock
                      code={`X-RateLimit-Limit: 200
X-RateLimit-Remaining: 187
X-RateLimit-Reset: 1712534400
X-Free-Remaining: 2   # Only on /api/free/run`}
                      label="response headers"
                    />
                  </div>

                  <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                    <h4 className="text-sm font-semibold text-white mb-2">
                      429 Response Body
                    </h4>
                    <CodeBlock
                      code={`{
  "error": "Monthly plan limit reached",
  "usage": {
    "used": 200,
    "limit": 200,
    "plan": "starter"
  },
  "upgradeUrl": "/pricing"
}`}
                      label="json -- 429 Too Many Requests"
                    />
                  </div>
                </div>
              </motion.div>
            </section>

            {/* ─── ERRORS ─── */}
            <section id="errors">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold">Error Codes</h2>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6 ml-11">
                  The API uses standard HTTP status codes. Error responses
                  always include an{" "}
                  <code className="px-1.5 py-0.5 rounded bg-white/[0.05] text-emerald-400 text-xs font-mono">
                    error
                  </code>{" "}
                  field with a human-readable message.
                </p>
                <div className="ml-11 rounded-xl border border-white/[0.06] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="text-left px-5 py-3 text-[11px] text-neutral-500 font-semibold uppercase tracking-wider">
                          Code
                        </th>
                        <th className="text-left px-5 py-3 text-[11px] text-neutral-500 font-semibold uppercase tracking-wider">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ERROR_CODES.map((err, i) => (
                        <tr
                          key={err.code}
                          className={`border-b border-white/[0.03] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                        >
                          <td className="px-5 py-3 font-mono text-amber-400 font-bold">
                            {err.code}
                          </td>
                          <td className="px-5 py-3 text-neutral-400">
                            {err.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-11 mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.015]">
                  <h4 className="text-sm font-semibold text-white mb-2">
                    Error Response Shape
                  </h4>
                  <CodeBlock
                    code={`{
  "error": "Agent \\"nonexistent\\" not found",
  "available": ["leads", "blog-gen", "seo-dominator", "..."]
}`}
                    label="json -- 404 Not Found"
                  />
                </div>
              </motion.div>
            </section>

            {/* ─── CTA ─── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="p-8 rounded-2xl bg-gradient-to-br from-emerald-500/[0.06] to-cyan-500/[0.04] border border-emerald-500/10 text-center"
            >
              <h2 className="text-xl font-bold text-white mb-2">
                Ready to build?
              </h2>
              <p className="text-sm text-neutral-400 mb-6">
                Generate your API key and make your first call in under a
                minute.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/dashboard/integrations"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 transition-colors"
                >
                  Get API Key <ExternalLink className="w-4 h-4" />
                </Link>
                <Link
                  href="/developers"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-white font-semibold text-sm hover:bg-white/[0.03] transition-colors"
                >
                  View SDK Guide <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

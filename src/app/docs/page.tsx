"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileCode2, Copy, CheckCircle2, ChevronRight } from "lucide-react";

interface EndpointDoc {
  method: string;
  path: string;
  name: string;
  description: string;
  body?: Record<string, string>;
  curl: string;
  response: string;
  category: string;
}

const ENDPOINTS: EndpointDoc[] = [
  // ── API Gateway & Auth ──
  { method: "POST", path: "/api/v1/agents/{slug}", name: "Public API Gateway", description: "Authenticated endpoint for external integrations. Rate-limited by plan (free: 100/day, pro: 1000/day, enterprise: unlimited). API keys validated against database with SHA-256 hash.", body: { "Authorization": "Bearer sk_your_api_key", "...": "Agent-specific body" }, curl: 'curl -X POST https://sovereignmatrix.agency/api/v1/agents/leads -H "Authorization: Bearer sk_pro_abc123" -H "Content-Type: application/json" -d \'{"niche":"fintech","location":"Austin, TX"}\'', response: '{"success":true,"leads":[...],"usage":{"tokens":1234}}', category: "Gateway" },

  // ── MCP Server ──
  { method: "POST", path: "/api/mcp", name: "MCP Server (JSON-RPC)", description: "Model Context Protocol server. Connect from Claude Desktop, Claude Code, or any MCP client. Exposes 7 agent tools via JSON-RPC 2.0.", body: { jsonrpc: "2.0", method: "tools/list | tools/call", id: "1" }, curl: 'curl -X POST /api/mcp -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","method":"tools/list","id":1}\'', response: '{"jsonrpc":"2.0","result":{"tools":[{"name":"site-assassin",...},{"name":"leads",...}]},"id":1}', category: "Gateway" },
  { method: "GET", path: "/api/mcp", name: "MCP Discovery", description: "Returns server info and available tools for MCP client discovery.", body: undefined, curl: "curl https://sovereignmatrix.agency/api/mcp", response: '{"name":"sovereign-matrix","version":"1.0.0","tools":[...]}', category: "Gateway" },

  // ── Agent Teams ──
  { method: "POST", path: "/api/agents/war-room", name: "Agent Teams (War Room)", description: "Deploy a team of 4+ specialized agents that analyze in parallel, debate adversarially, and synthesize a unified battle plan. Teams: war-room, content-council, deal-room.", body: { objective: "string (required)", team: "war-room | content-council | deal-room", context: "string (optional)" }, curl: 'curl -X POST /api/agents/war-room -d \'{"objective":"Analyze competitor HubSpot","team":"war-room"}\'', response: '{"team":"War Room","synthesis":"...","perspectives":[...],"confidence":0.87,"duration":"12400ms"}', category: "Intelligence" },

  // ── Dashboard Stats ──
  { method: "GET", path: "/api/agents/dashboard-stats", name: "Dashboard Stats", description: "Real-time platform metrics — agent executions, leads, content, bookings, and cross-agent signal activity.", body: undefined, curl: "curl /api/agents/dashboard-stats", response: '{"stats":{"agentExecutions":847,"leadsGenerated":234,"contentGenerated":567},"signals":{...}}', category: "Platform" },

  { method: "POST", path: "/api/agents/ai-gateway", name: "Vercel AI Gateway", description: "Route prompts through MiniMax M2.7 with NIM fallback.", body: { messages: "[{role, content}]", model: "minimax/minimax-m2.7-highspeed" }, curl: 'curl -X POST /api/agents/ai-gateway -H "Content-Type: application/json" -d \'{"messages":[{"role":"user","content":"Hello"}]}\'', response: '{"success":true,"provider":"Vercel AI Gateway","result":{...}}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/page-builder", name: "Stitch Page Builder", description: "Generate complete HTML pages from text prompts.", body: { prompt: "string (required)" }, curl: 'curl -X POST /api/agents/page-builder -d \'{"prompt":"luxury landing page"}\'', response: '{"success":true,"html":"<!DOCTYPE html>...","provider":"NVIDIA NIM"}', category: "Builder" },
  { method: "POST", path: "/api/agents/pii-redactor", name: "PII Auto-Redactor", description: "Detect and redact personal data for GDPR/POPIA.", body: { text: "string (required)", redact: "boolean (default: true)" }, curl: 'curl -X POST /api/agents/pii-redactor -d \'{"text":"John Smith, john@email.com"}\'', response: '{"success":true,"entities_found":2,"risk_level":"HIGH","redacted_text":"[REDACTED]"}', category: "Security" },
  { method: "POST", path: "/api/agents/translate", name: "12-Language Translator", description: "Translate text to 12 languages via Riva.", body: { text: "string", target_lang: "es|fr|de|pt|zh|ja|ko|ar|hi|ru|it" }, curl: 'curl -X POST /api/agents/translate -d \'{"text":"Hello","target_lang":"es"}\'', response: '{"success":true,"target":{"lang":"es","text":"Hola"}}', category: "Outreach" },
  { method: "POST", path: "/api/agents/doc-intel", name: "Document Intelligence", description: "Embed, rerank, or search documents via NV-Embed.", body: { action: "embed|rerank|search", text: "string", query: "string" }, curl: 'curl -X POST /api/agents/doc-intel -d \'{"action":"embed","text":"AI marketing"}\'', response: '{"success":true,"vectors_generated":1,"dimensions":4096}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/image-gen", name: "Image Generator", description: "Generate images via Stable Diffusion 3 Medium.", body: { prompt: "string (required)", width: "number (max 1024)", height: "number (max 1024)" }, curl: 'curl -X POST /api/agents/image-gen -d \'{"prompt":"futuristic city"}\'', response: '{"success":true,"image":{"b64_json":"..."}}', category: "Creative" },
  { method: "POST", path: "/api/agents/voice-synth", name: "Voice Synthesizer", description: "Text-to-speech via Magpie TTS. Returns audio/mpeg.", body: { text: "string (required)", voice: "flow|zeroshot" }, curl: 'curl -X POST /api/agents/voice-synth -d \'{"text":"Hello world"}\' --output speech.mp3', response: "Binary audio/mpeg stream", category: "Creative" },
  { method: "POST", path: "/api/agents/blog-gen", name: "SEO Blog Generator", description: "Research + write 1500-word SEO articles.", body: { topic: "string (required)", keywords: "string[]", tone: "string" }, curl: 'curl -X POST /api/agents/blog-gen -d \'{"topic":"AI marketing"}\'', response: '{"success":true,"wordCount":1500,"html":"...","seo":{...}}', category: "Content" },
  { method: "POST", path: "/api/agents/case-study", name: "Case Study Generator", description: "Generate polished case studies from client metrics.", body: { clientName: "string (required)", industry: "string", metrics: "object" }, curl: 'curl -X POST /api/agents/case-study -d \'{"clientName":"Acme Corp"}\'', response: '{"success":true,"html":"...","wordCount":800}', category: "Content" },
  { method: "POST", path: "/api/agents/swarm", name: "Multi-Agent Swarm", description: "3 models attack the same problem, jury synthesizes.", body: { task: "string (required)", jury: "boolean (default: true)" }, curl: 'curl -X POST /api/agents/swarm -d \'{"task":"Best marketing strategy for SaaS"}\'', response: '{"success":true,"jury_verdict":"...","results":[...]}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/chain-reactor", name: "Chain Reactor", description: "Run pre-built agent chains: lead-to-close, content-blitz, security-audit.", body: { chain: "string (required)", input: "object" }, curl: 'curl -X POST /api/agents/chain-reactor -d \'{"chain":"content-blitz","input":{"topic":"AI"}}\'', response: '{"success":true,"steps_completed":3,"results":[...]}', category: "Orchestration" },
  { method: "POST", path: "/api/agents/nemoclaw", name: "NemoClaw Control", description: "Deploy, execute, heal, or terminate guardrailed agents.", body: { action: "deploy|execute|heal|terminate", config: "object" }, curl: 'curl -X POST /api/agents/nemoclaw -d \'{"action":"deploy","config":{"name":"Bot1"}}\'', response: '{"success":true,"agent":{"id":"nclaw-...","status":"active"}}', category: "Security" },
  { method: "POST", path: "/api/agents/comms", name: "Agent Comms Bus", description: "Send messages between agents with optional auto-execute.", body: { from: "string", to: "string", type: "task|result|alert", payload: "object" }, curl: 'curl -X POST /api/agents/comms -d \'{"from":"pii","to":"translate","payload":{"text":"Hello"}}\'', response: '{"success":true,"message":{...}}', category: "Orchestration" },
  { method: "POST", path: "/api/agents/scheduler", name: "Scheduled Jobs", description: "Trigger or toggle cron-based agent automation.", body: { action: "trigger|toggle|cron", jobId: "string" }, curl: 'curl -X POST /api/agents/scheduler -d \'{"action":"trigger","jobId":"weekly-content"}\'', response: '{"success":true,"job":"Weekly Content Blitz","result":{...}}', category: "Automation" },
  { method: "POST", path: "/api/agents/whitelabel", name: "White-Label", description: "Create branded deployments for agency reselling.", body: { action: "create|list", config: "object" }, curl: 'curl -X POST /api/agents/whitelabel -d \'{"action":"create","config":{"agency_name":"MyAgency","domain":"myagency.com"}}\'', response: '{"success":true,"config":{...}}', category: "Platform" },
  { method: "POST", path: "/api/agents/marketplace", name: "Agent Marketplace", description: "Browse and deploy pre-built agent templates.", body: { action: "create|deploy", template: "object" }, curl: 'curl -X POST /api/agents/marketplace -d \'{"action":"deploy","template":{"id":"sales-closer"}}\'', response: '{"success":true,"deployed_from":"Sales Closer Bot"}', category: "Platform" },
  { method: "GET", path: "/api/agents/analytics", name: "Agent Analytics", description: "Get usage statistics and recent activity.", body: undefined, curl: "curl /api/agents/analytics", response: '{"total_calls_today":42,"top_agents":[...]}', category: "Platform" },
  { method: "GET", path: "/api/agents/replays", name: "Execution Replays", description: "Get step-by-step audit trails for agent executions.", body: undefined, curl: "curl /api/agents/replays", response: '{"stats":{...},"recent_replays":[...]}', category: "Platform" },

  // ── Additional Core Agents ──
  { method: "POST", path: "/api/agents/voice-chat", name: "Voice Chat", description: "Real-time voice conversation agent using NVIDIA Nemotron. Supports customer-support, sales, receptionist, and appointment contexts.", body: { text: "string (required)", context: "customer-support | sales | receptionist | appointment", voice_style: "professional | casual | warm" }, curl: 'curl -X POST /api/agents/voice-chat -d \'{"text":"I need to book an appointment","context":"appointment"}\'', response: '{"success":true,"response":"...","model":"nemotron-voicechat","estimated_duration_seconds":4}', category: "Voice" },
  { method: "POST", path: "/api/agents/vision", name: "Vision Analysis", description: "Analyze images with Qwen 3.5 VLM. Modes: analyze, ocr, chart, audit.", body: { image_url: "string (required)", question: "string", mode: "analyze | ocr | chart | audit" }, curl: 'curl -X POST /api/agents/vision -d \'{"image_url":"https://...","mode":"ocr"}\'', response: '{"success":true,"result":"...","model":"Qwen 3.5 VLM"}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/embed", name: "Text Embeddings", description: "Generate vector embeddings using NVIDIA NV-EmbedQA for RAG and similarity search.", body: { text: "string | string[] (required)", model: "string" }, curl: 'curl -X POST /api/agents/embed -d \'{"text":"Your document text here"}\'', response: '{"success":true,"embeddings":[[0.123,...]],"dimensions":1024}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/rerank", name: "Document Reranking", description: "Rerank search results by relevance using NVIDIA NV-RerankQA.", body: { query: "string (required)", passages: "string[] (required)" }, curl: 'curl -X POST /api/agents/rerank -d \'{"query":"AI agents","passages":["doc1","doc2"]}\'', response: '{"success":true,"rankings":[{"index":0,"score":0.95},...]}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/translate", name: "Translation", description: "Translate text between languages using NIM models.", body: { text: "string (required)", target: "string (required)", source: "string" }, curl: 'curl -X POST /api/agents/translate -d \'{"text":"Hello world","target":"es"}\'', response: '{"success":true,"translated":"Hola mundo","source":"en","target":"es"}', category: "Content" },
  { method: "POST", path: "/api/agents/pii-guard", name: "PII Detection", description: "Scan text for personally identifiable information (emails, phones, SSN, credit cards).", body: { text: "string (required)" }, curl: 'curl -X POST /api/agents/pii-guard -d \'{"text":"Contact john@example.com at 555-0123"}\'', response: '{"success":true,"entities":[{"type":"email","value":"[REDACTED]"}],"redacted":"Contact [EMAIL] at [PHONE]"}', category: "Safety" },
  { method: "POST", path: "/api/agents/deep-think", name: "Deep Reasoning", description: "Extended thinking mode with step-by-step reasoning. Uses Claude with thinking blocks or DeepSeek R1.", body: { prompt: "string (required)", budget_tokens: "number (default: 10000)" }, curl: 'curl -X POST /api/agents/deep-think -d \'{"prompt":"Analyze the market opportunity for AI agents in South Africa"}\'', response: '{"success":true,"thinking":"...","result":"...","model":"claude-sonnet-4-6"}', category: "Intelligence" },
  { method: "POST", path: "/api/agents/image-gen", name: "Image Generation", description: "Generate images via Black Forest Labs FLUX.1.", body: { prompt: "string (required)", width: "number", height: "number" }, curl: 'curl -X POST /api/agents/image-gen -d \'{"prompt":"Modern office with AI robots working"}\'', response: '{"success":true,"imageUrl":"https://...","model":"flux-1"}', category: "Content" },
  { method: "GET", path: "/api/health", name: "Health Check", description: "Platform health status including all AI providers, database, and circuit breaker states.", body: undefined, curl: "curl https://sovereignmatrix.agency/api/health", response: '{"status":"ok","services":{"db":"ok","nim":"ok","gemini":"ok","claude":"ok","groq":"ok"}}', category: "Platform" },
  { method: "POST", path: "/api/demo/analyze", name: "Public Demo", description: "Try AI without signup. 5 free requests per IP per hour. Accepts a prompt or URL to analyze.", body: { prompt: "string", url: "string" }, curl: 'curl -X POST /api/demo/analyze -d \'{"prompt":"What is AI?"}\'', response: '{"response":"...","model":"sovereign-ai"}', category: "Gateway" },
];

const CATEGORIES = ["All", ...new Set(ENDPOINTS.map(e => e.category))];

export default function DocsPage() {
  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = filter === "All" ? ENDPOINTS : ENDPOINTS.filter(e => e.category === filter);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-neutral-800 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-[0.2em]">API Reference</h1>
                <p className="text-neutral-500 text-xs uppercase tracking-widest">{ENDPOINTS.length} Endpoints · MCP + REST · All Agent APIs</p>
              </div>
            </div>
            <Link href="/" className="text-xs text-neutral-600 hover:text-white transition-colors">← Back</Link>
          </div>
        </header>

        {/* Auth Guide */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Authentication</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            All <code className="text-emerald-400">/api/v1/</code> endpoints require a Bearer token. Get your API key from <code className="text-emerald-400">Dashboard → Settings → API Keys</code>. Keys are SHA-256 hashed and validated against the database with expiry and revocation support.
          </p>
          <pre className="bg-black/50 border border-emerald-500/10 rounded-lg p-3 text-[10px] text-neutral-400 overflow-x-auto">Authorization: Bearer sk_pro_your_key_here</pre>
          <p className="text-xs text-neutral-500">Rate limits: Free (100/day) · Pro (1,000/day) · Enterprise (unlimited)</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-gpu ${filter === cat ? "bg-[#10b981] text-white border-[#10b981]" : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600"}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(ep => {
            const isExpanded = expanded === ep.path;
            return (
              <div key={ep.path} className="bg-neutral-950 border border-neutral-800 overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : ep.path)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-neutral-900 transition-gpu">
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${ep.method === "GET" ? "bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30" : "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30"}`}>{ep.method}</span>
                  <code className="text-xs text-white flex-1">{ep.path}</code>
                  <span className="text-[9px] text-neutral-600 uppercase tracking-widest hidden md:block">{ep.category}</span>
                  <ChevronRight className={`w-4 h-4 text-neutral-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="border-t border-neutral-800 p-4 space-y-4 animate-in fade-in duration-200">
                    <div>
                      <h3 className="text-sm font-bold mb-1">{ep.name}</h3>
                      <p className="text-xs text-neutral-500">{ep.description}</p>
                    </div>
                    {ep.body && (
                      <div>
                        <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-2">Request Body</p>
                        <div className="bg-black border border-neutral-800 p-3">
                          {Object.entries(ep.body).map(([k, v]) => (
                            <div key={k} className="flex gap-4 py-1 text-[11px]">
                              <code className="text-[#10b981] font-bold w-24">{k}</code>
                              <span className="text-neutral-500">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] text-neutral-500 uppercase tracking-widest">cURL Example</p>
                        <button onClick={() => copyToClipboard(ep.curl, ep.path)} className="text-[9px] text-neutral-500 hover:text-white flex items-center gap-1">
                          {copied === ep.path ? <><CheckCircle2 className="w-3 h-3 text-[#00ff66]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </button>
                      </div>
                      <pre className="bg-black border border-neutral-800 p-3 text-[10px] text-neutral-400 overflow-x-auto">{ep.curl}</pre>
                    </div>
                    <div>
                      <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-2">Response</p>
                      <pre className="bg-black border border-neutral-800 p-3 text-[10px] text-neutral-400 overflow-x-auto">{ep.response}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

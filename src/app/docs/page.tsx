"use client";

import React, { useState } from "react";
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
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
              <FileCode2 className="w-6 h-6 text-[#00B7FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">API Reference</h1>
              <p className="text-neutral-500 text-xs uppercase tracking-widest">{ENDPOINTS.length} Endpoints · All Agent APIs Documented</p>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-gpu ${filter === cat ? "bg-[#00B7FF] text-white border-[#00B7FF]" : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600"}`}>
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
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${ep.method === "GET" ? "bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30" : "bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/30"}`}>{ep.method}</span>
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
                              <code className="text-[#00B7FF] font-bold w-24">{k}</code>
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

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileCode2, Copy, CheckCircle2, ChevronRight, BookOpen, Webhook, Crown, Heart } from "lucide-react";

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

interface PlaybookDoc {
  id: string;
  name: string;
  tagline: string;
  category: string;
  agentCount: number;
  estimatedTime: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
  guarantee?: string;
}

const PLAYBOOK_DOCS: PlaybookDoc[] = [
  { id: "lead-blitz", name: "Lead Blitz", tagline: "50 qualified leads + outreach in minutes", category: "growth", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "niche", label: "Target Industry", type: "text", required: true }, { key: "location", label: "Location", type: "text", required: true }, { key: "product", label: "Your Product/Service", type: "text", required: true }], guarantee: "5+ qualified companies with contact angles or the run doesn't count" },
  { id: "competitor-takedown", name: "Competitor Takedown", tagline: "Full competitive analysis + counter-strategy", category: "intelligence", agentCount: 3, estimatedTime: "3-5 min", fields: [{ key: "url", label: "Competitor URL", type: "url", required: true }, { key: "your_url", label: "Your Website (optional)", type: "url", required: false }], guarantee: "5+ counter-positioning strategies with specific action items or re-run free" },
  { id: "content-machine", name: "Content Machine", tagline: "SEO blog + social posts from one topic", category: "content", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "topic", label: "Blog Topic", type: "text", required: true }, { key: "tone", label: "Tone", type: "select", required: true }, { key: "keywords", label: "Target Keywords (optional)", type: "text", required: false }], guarantee: "1,500+ word blog post + 3 social posts or re-run free" },
  { id: "proposal-blaster", name: "Proposal Blaster", tagline: "Client proposal + case study in one click", category: "operations", agentCount: 2, estimatedTime: "2-4 min", fields: [{ key: "client", label: "Client Company Name", type: "text", required: true }, { key: "service", label: "Service Being Proposed", type: "text", required: true }, { key: "budget", label: "Budget Range (optional)", type: "text", required: false }] },
  { id: "seo-domination", name: "SEO Domination", tagline: "Full audit + content strategy + keyword plan", category: "growth", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "url", label: "Your Website URL", type: "url", required: true }, { key: "keywords", label: "Target Keywords", type: "text", required: true }] },
  { id: "brand-forensics", name: "Brand Forensics", tagline: "Analyze any brand's voice, positioning & gaps", category: "intelligence", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "url", label: "Brand Website URL", type: "url", required: true }, { key: "industry", label: "Industry Context", type: "text", required: true }] },
  { id: "funnel-autopsy", name: "Funnel Autopsy", tagline: "Find exactly where your funnel leaks", category: "growth", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "url", label: "Landing Page URL", type: "url", required: true }, { key: "goal", label: "Funnel Goal", type: "text", required: true }] },
  { id: "ghost-fleet", name: "Apollo Ghost Fleet", tagline: "Mass outreach campaign from scratch", category: "growth", agentCount: 3, estimatedTime: "3-5 min", fields: [{ key: "niche", label: "Target Audience", type: "text", required: true }, { key: "location", label: "Region", type: "text", required: true }, { key: "product", label: "What You're Selling", type: "textarea", required: true }, { key: "tone", label: "Email Tone", type: "select", required: true }] },
  { id: "meeting-prep", name: "Meeting Prep", tagline: "Walk into every meeting fully armed", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "company_name", label: "Company Name", type: "text", required: true }, { key: "meeting_type", label: "Meeting Type", type: "select", required: true }, { key: "notes", label: "Additional Notes (optional)", type: "textarea", required: false }] },
  { id: "weekly-report", name: "Weekly Report", tagline: "Auto-generate your client status report", category: "operations", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "client_name", label: "Client Name", type: "text", required: true }, { key: "period", label: "Reporting Period", type: "select", required: true }, { key: "highlights", label: "Key Highlights (optional)", type: "textarea", required: false }] },
  { id: "contract-review", name: "Contract Review", tagline: "AI-powered legal risk analysis", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "contract_text", label: "Contract Text", type: "textarea", required: true }, { key: "party_name", label: "Other Party Name", type: "text", required: true }] },
  { id: "ad-campaign", name: "Ad Campaign Builder", tagline: "Full ad creative suite from one brief", category: "growth", agentCount: 3, estimatedTime: "3-4 min", fields: [{ key: "product", label: "Product/Service", type: "text", required: true }, { key: "audience", label: "Target Audience", type: "text", required: true }, { key: "platform", label: "Ad Platform", type: "select", required: true }, { key: "budget", label: "Monthly Budget (optional)", type: "text", required: false }] },
  { id: "onboard-client", name: "Onboarding Accelerator", tagline: "Set up a new client in under 5 minutes", category: "operations", agentCount: 3, estimatedTime: "3-5 min", fields: [{ key: "client_url", label: "Client Website URL", type: "url", required: true }, { key: "client_name", label: "Client Name", type: "text", required: true }, { key: "service", label: "Service Being Offered", type: "text", required: true }] },
  { id: "property-listing", name: "Property Listing Generator", tagline: "Photos to listing in 60 seconds", category: "operations", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "property_address", label: "Property Address", type: "text", required: true }, { key: "property_type", label: "Property Type", type: "select", required: true }, { key: "key_features", label: "Key Features", type: "textarea", required: true }, { key: "price", label: "Asking Price (optional)", type: "text", required: false }] },
  { id: "open-house-followup", name: "Open House Follow-Up", tagline: "Automated nurture after every showing", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "property_address", label: "Property Address", type: "text", required: true }, { key: "attendee_count", label: "Number of Attendees", type: "text", required: true }, { key: "feedback_notes", label: "Feedback Notes (optional)", type: "textarea", required: false }] },
  { id: "market-analysis", name: "Neighborhood Market Analysis", tagline: "Comparable sales + trend analysis", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "neighborhood", label: "Neighborhood / Area", type: "text", required: true }, { key: "property_type", label: "Property Type", type: "select", required: true }, { key: "radius", label: "Search Radius (optional)", type: "text", required: false }] },
  { id: "seller-cma", name: "Seller CMA Report", tagline: "Comparative market analysis in minutes", category: "operations", agentCount: 2, estimatedTime: "2-4 min", fields: [{ key: "property_address", label: "Property Address", type: "text", required: true }, { key: "bedrooms", label: "Bedrooms", type: "text", required: true }, { key: "square_meters", label: "Square Meters", type: "text", required: true }, { key: "condition", label: "Property Condition", type: "select", required: true }] },
  { id: "case-research", name: "Case Law Research", tagline: "AI-powered legal research brief", category: "operations", agentCount: 2, estimatedTime: "3-5 min", fields: [{ key: "legal_question", label: "Legal Question", type: "textarea", required: true }, { key: "jurisdiction", label: "Jurisdiction", type: "text", required: true }, { key: "case_type", label: "Case Type", type: "select", required: true }] },
  { id: "client-intake", name: "Client Intake Qualifier", tagline: "Qualify new clients before the first call", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "client_name", label: "Client Name", type: "text", required: true }, { key: "matter_type", label: "Matter Type", type: "text", required: true }, { key: "urgency", label: "Urgency", type: "select", required: true }, { key: "initial_notes", label: "Initial Notes (optional)", type: "textarea", required: false }] },
  { id: "discovery-analyzer", name: "Discovery Document Analyzer", tagline: "Analyze thousands of pages in minutes", category: "operations", agentCount: 2, estimatedTime: "3-5 min", fields: [{ key: "document_text", label: "Document Text", type: "textarea", required: true }, { key: "case_summary", label: "Case Summary", type: "text", required: true }, { key: "looking_for", label: "What to Look For", type: "textarea", required: true }] },
  { id: "legal-letter", name: "Legal Letter Drafter", tagline: "Professional legal correspondence", category: "operations", agentCount: 2, estimatedTime: "2-3 min", fields: [{ key: "letter_type", label: "Letter Type", type: "select", required: true }, { key: "recipient", label: "Recipient", type: "text", required: true }, { key: "facts", label: "Relevant Facts", type: "textarea", required: true }, { key: "desired_outcome", label: "Desired Outcome", type: "text", required: true }] },
  { id: "job-description", name: "Job Description Writer", tagline: "Inclusive, compelling job posts", category: "growth", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "role_title", label: "Role Title", type: "text", required: true }, { key: "department", label: "Department", type: "text", required: true }, { key: "seniority", label: "Seniority Level", type: "select", required: true }, { key: "key_requirements", label: "Key Requirements", type: "textarea", required: true }, { key: "company_culture", label: "Company Culture (optional)", type: "textarea", required: false }] },
  { id: "candidate-screen", name: "Candidate Screening Agent", tagline: "Score and rank candidates automatically", category: "growth", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "job_requirements", label: "Job Requirements", type: "textarea", required: true }, { key: "candidate_info", label: "Candidate Info", type: "textarea", required: true }, { key: "must_haves", label: "Must-Have Qualifications", type: "text", required: true }] },
  { id: "interview-kit", name: "Interview Question Generator", tagline: "Structured interviews that find the best hire", category: "growth", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "role_title", label: "Role Title", type: "text", required: true }, { key: "competencies", label: "Competencies to Assess", type: "textarea", required: true }, { key: "interview_type", label: "Interview Type", type: "select", required: true }] },
  { id: "offer-letter", name: "Offer Letter Drafter", tagline: "Professional offers in one click", category: "growth", agentCount: 2, estimatedTime: "1-2 min", fields: [{ key: "candidate_name", label: "Candidate Name", type: "text", required: true }, { key: "role_title", label: "Role Title", type: "text", required: true }, { key: "salary", label: "Salary / Compensation", type: "text", required: true }, { key: "start_date", label: "Start Date", type: "text", required: true }, { key: "benefits", label: "Benefits (optional)", type: "textarea", required: false }] },
];

const PLAYBOOK_CATEGORY_LABELS: Record<string, string> = {
  growth: "Growth & Leads",
  content: "Content Creation",
  intelligence: "Intelligence",
  operations: "Operations",
};

const ENDPOINTS: EndpointDoc[] = [
  // ── Coordinator (Primary Orchestration) ──
  { method: "POST", path: "/api/agents/coordinator", name: "Coordinator — Free-form Goal", description: "Send a plain-English goal and the coordinator decomposes it into an agent pipeline, selects the right agents, and executes them in sequence. The primary entry point for all multi-agent orchestration.", body: { goal: "string (required) — plain-English business objective", auto_execute: "boolean (default: true) — execute immediately or return plan only" }, curl: 'curl -X POST https://sovereignmatrix.agency/api/agents/coordinator -H "Content-Type: application/json" -d \'{"goal":"Find 20 fintech leads in London and draft outreach emails","auto_execute":true}\'', response: '{"success":true,"plan":{"steps":[{"agent":"leads","status":"complete"},{"agent":"email-sequence","status":"complete"}]},"results":[...],"duration_ms":18200}', category: "Orchestration" },
  { method: "POST", path: "/api/agents/coordinator (playbook)", name: "Coordinator — Playbook Mode", description: "Execute a pre-configured playbook by ID. The coordinator validates required fields, resolves step templates, and runs the agent chain. See the Playbooks section below for all 25 available playbooks and their fields.", body: { playbook_id: "string (required) — e.g. lead-blitz, competitor-takedown", inputs: "Record<string, string> (required) — field values matching the playbook schema", auto_execute: "boolean (default: true) — execute immediately or return plan only" }, curl: 'curl -X POST https://sovereignmatrix.agency/api/agents/coordinator -H "Content-Type: application/json" -d \'{"playbook_id":"lead-blitz","inputs":{"niche":"fintech","location":"London","product":"AI-powered CRM"},"auto_execute":true}\'', response: '{"success":true,"playbook":"Lead Blitz","steps_completed":2,"results":[{"agent":"leads","output":{...}},{"agent":"email-sequence","output":{...}}],"duration_ms":24000}', category: "Orchestration" },

  // ── Webhook Trigger Engine ──
  { method: "POST", path: "/api/agents/trigger", name: "Webhook Trigger — Playbook Mode", description: "Receive webhooks from Zapier, Make, n8n, or any HTTP client and trigger a playbook execution. Auth via api_key field (no Clerk required). Includes audit trail with trigger IDs.", body: { trigger_type: "string (webhook | cron | event, default: webhook)", playbook_id: "string (required) — playbook to execute", inputs: "Record<string, string> (required) — playbook field values", api_key: "string (required) — WEBHOOK_API_KEY", auto_execute: "boolean (default: true)" }, curl: 'curl -X POST https://sovereignmatrix.agency/api/agents/trigger -H "Content-Type: application/json" -d \'{"trigger_type":"webhook","playbook_id":"lead-blitz","inputs":{"niche":"fintech","location":"London","product":"AI CRM"},"api_key":"your-webhook-key","auto_execute":true}\'', response: '{"trigger_id":"trig_1712345678_abc123","mode":"playbook","playbook_id":"lead-blitz","playbook_name":"Lead Blitz","duration_ms":24000,"success":true}', category: "Automation" },
  { method: "POST", path: "/api/agents/trigger (agent)", name: "Webhook Trigger — Agent Mode", description: "Trigger any single agent directly via webhook. Useful for simple automations that don't need a full playbook.", body: { agent: "string (required) — agent name (e.g. smart-router, leads)", prompt: "string (required) — task for the agent", api_key: "string (required) — WEBHOOK_API_KEY" }, curl: 'curl -X POST https://sovereignmatrix.agency/api/agents/trigger -H "Content-Type: application/json" -d \'{"agent":"smart-router","prompt":"Analyze this company: acme.com","api_key":"your-webhook-key"}\'', response: '{"trigger_id":"trig_1712345678_xyz789","mode":"agent","agent":"smart-router","duration_ms":4200,"success":true,"result":{...}}', category: "Automation" },
  { method: "GET", path: "/api/agents/trigger", name: "Webhook Trigger — Docs", description: "Returns the trigger engine documentation including available playbooks, agents, and authentication details.", body: undefined, curl: "curl https://sovereignmatrix.agency/api/agents/trigger", response: '{"name":"Sovereign Matrix -- Webhook Trigger Engine","version":"1.0.0","endpoints":{...},"available_playbooks":[...],"available_agents":[...]}', category: "Automation" },

  // ── Founders Program ──
  { method: "GET", path: "/api/founders", name: "Founders Program — Status", description: "Check the Founders Program status: total slots, claimed count, remaining slots, and whether the current authenticated user is a founder. Public endpoint.", body: undefined, curl: "curl https://sovereignmatrix.agency/api/founders", response: '{"program":"Sovereign Matrix Founders","totalSlots":10,"claimed":3,"remaining":7,"isFounder":false,"benefits":["10,000 agent runs/month","All 25 playbooks","All 35+ AI models","Priority support","Founding Member badge","Free forever while active"]}', category: "Platform" },
  { method: "POST", path: "/api/founders", name: "Founders Program — Claim Slot", description: "Claim a founder slot (requires Clerk authentication). First 10 users get enterprise-level access for free: 10,000 runs/month, all playbooks, all models, priority support. Returns 410 Gone if all slots are claimed.", body: undefined, curl: 'curl -X POST https://sovereignmatrix.agency/api/founders -H "Cookie: __session=your_clerk_session"', response: '{"success":true,"message":"Welcome to the Founders Program! You\'re Founding Member #4.","plan":"founder","slotNumber":4,"remaining":6,"benefits":["10,000 agent runs/month","All playbooks unlocked","All AI models","Free forever while active"]}', category: "Platform" },

  // ── Health ──
  { method: "GET", path: "/api/health/ping", name: "Health Ping", description: "Ultra-lightweight uptime check for monitoring services (Better Stack, Uptime Robot, Pingdom). Returns 200 with DB latency if healthy, 503 if database is unreachable. No auth required.", body: undefined, curl: "curl https://sovereignmatrix.agency/api/health/ping", response: '{"status":"healthy","db":"connected","latency_ms":12,"timestamp":"2026-04-04T12:00:00.000Z","version":"2.1.0"}', category: "Platform" },

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
    <main className="min-h-screen bg-black text-white p-6 md:p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-neutral-800 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-[0.2em]">API Reference</h1>
                <p className="text-neutral-500 text-xs uppercase tracking-widest">{ENDPOINTS.length} Endpoints · 129 Agents · 25 Playbooks · MCP + REST</p>
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
          {filtered.map((ep, idx) => {
            const epKey = `${ep.method}-${ep.path}-${idx}`;
            const isExpanded = expanded === epKey;
            return (
              <div key={epKey} className="bg-neutral-950 border border-neutral-800 overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : epKey)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-neutral-900 transition-gpu">
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
                        <button onClick={() => copyToClipboard(ep.curl, epKey)} className="text-[9px] text-neutral-500 hover:text-white flex items-center gap-1">
                          {copied === epKey ? <><CheckCircle2 className="w-3 h-3 text-[#00ff66]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
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

        {/* ── Playbooks Section ── */}
        <div className="border-t border-neutral-800 pt-8 space-y-6" id="playbooks">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.15em]">Playbooks</h2>
              <p className="text-neutral-500 text-xs uppercase tracking-widest">{PLAYBOOK_DOCS.length} Pre-built Workflows · 2-5 min execution · Output guarantees</p>
            </div>
          </div>

          <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-violet-400 uppercase tracking-widest">How Playbooks Work</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Playbooks are pre-configured multi-agent pipelines. Pick a business outcome, fill in 2-4 fields, and the coordinator assembles the right agent swarm automatically.
              Execute via the <code className="text-violet-400">POST /api/agents/coordinator</code> endpoint with a <code className="text-violet-400">playbook_id</code>, or trigger via webhook at <code className="text-violet-400">POST /api/agents/trigger</code>.
            </p>
            <pre className="bg-black/50 border border-violet-500/10 rounded-lg p-3 text-[10px] text-neutral-400 overflow-x-auto">{`curl -X POST /api/agents/coordinator \\
  -H "Content-Type: application/json" \\
  -d '{"playbook_id":"lead-blitz","inputs":{"niche":"fintech","location":"London","product":"AI CRM"},"auto_execute":true}'`}</pre>
          </div>

          {Object.entries(PLAYBOOK_CATEGORY_LABELS).map(([catKey, catLabel]) => {
            const catPlaybooks = PLAYBOOK_DOCS.filter(p => p.category === catKey);
            if (catPlaybooks.length === 0) return null;
            return (
              <div key={catKey} className="space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-2">{catLabel} ({catPlaybooks.length})</h3>
                {catPlaybooks.map(pb => {
                  const pbKey = `pb-${pb.id}`;
                  const isExpanded = expanded === pbKey;
                  return (
                    <div key={pb.id} className="bg-neutral-950 border border-neutral-800 overflow-hidden">
                      <button onClick={() => setExpanded(isExpanded ? null : pbKey)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-neutral-900 transition-gpu">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/30">{pb.agentCount} agents</span>
                        <div className="flex-1 min-w-0">
                          <code className="text-xs text-white">{pb.name}</code>
                          <span className="text-[10px] text-neutral-600 ml-2 hidden md:inline">{pb.tagline}</span>
                        </div>
                        <span className="text-[9px] text-neutral-600 uppercase tracking-widest hidden md:block">{pb.estimatedTime}</span>
                        <ChevronRight className={`w-4 h-4 text-neutral-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>
                      {isExpanded && (
                        <div className="border-t border-neutral-800 p-4 space-y-4 animate-in fade-in duration-200">
                          <div>
                            <h4 className="text-sm font-bold mb-1">{pb.name}</h4>
                            <p className="text-xs text-neutral-500">{pb.tagline}</p>
                            <div className="flex gap-4 mt-2">
                              <span className="text-[9px] text-neutral-600">ID: <code className="text-violet-400">{pb.id}</code></span>
                              <span className="text-[9px] text-neutral-600">Agents: {pb.agentCount}</span>
                              <span className="text-[9px] text-neutral-600">Time: {pb.estimatedTime}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-2">Input Fields</p>
                            <div className="bg-black border border-neutral-800 p-3">
                              {pb.fields.map(f => (
                                <div key={f.key} className="flex gap-4 py-1 text-[11px]">
                                  <code className="text-violet-400 font-bold w-32">{f.key}</code>
                                  <span className="text-neutral-600 w-16">{f.type}</span>
                                  <span className="text-neutral-500">{f.label}{f.required ? "" : " (optional)"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {pb.guarantee && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                              <p className="text-[9px] text-emerald-400 uppercase tracking-widest mb-1">Output Guarantee</p>
                              <p className="text-xs text-neutral-400">{pb.guarantee}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mb-2">Example</p>
                            <pre className="bg-black border border-neutral-800 p-3 text-[10px] text-neutral-400 overflow-x-auto">{`curl -X POST /api/agents/coordinator \\
  -H "Content-Type: application/json" \\
  -d '{"playbook_id":"${pb.id}","inputs":{${pb.fields.filter(f => f.required).map(f => `"${f.key}":"..."`).join(",")}},"auto_execute":true}'`}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Webhook Trigger Section ── */}
        <div className="border-t border-neutral-800 pt-8 space-y-6" id="webhooks">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Webhook className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.15em]">Webhook Trigger Engine</h2>
              <p className="text-neutral-500 text-xs uppercase tracking-widest">Zapier · Make · n8n · Custom HTTP · No Clerk auth required</p>
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">External Automation</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The trigger engine receives webhooks from external services and automatically executes playbooks or individual agents.
              Authentication uses an <code className="text-amber-400">api_key</code> field in the request body (matched against the <code className="text-amber-400">WEBHOOK_API_KEY</code> environment variable).
              No Clerk session required — designed for machine-to-machine calls.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/50 border border-amber-500/10 rounded-lg p-4 space-y-2">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Playbook Mode</p>
                <pre className="text-[10px] text-neutral-400 overflow-x-auto">{`POST /api/agents/trigger
{
  "trigger_type": "webhook",
  "playbook_id": "lead-blitz",
  "inputs": {
    "niche": "fintech",
    "location": "London",
    "product": "AI CRM"
  },
  "api_key": "your-key",
  "auto_execute": true
}`}</pre>
              </div>
              <div className="bg-black/50 border border-amber-500/10 rounded-lg p-4 space-y-2">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Agent Mode</p>
                <pre className="text-[10px] text-neutral-400 overflow-x-auto">{`POST /api/agents/trigger
{
  "agent": "smart-router",
  "prompt": "Analyze acme.com",
  "api_key": "your-key"
}`}</pre>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Integration Guides</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["Zapier", "Make", "n8n", "Custom HTTP"].map(tool => (
                  <div key={tool} className="bg-black/50 border border-neutral-800 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-neutral-400">{tool}</p>
                    <p className="text-[9px] text-neutral-600">Point webhook at POST /api/agents/trigger</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-neutral-600">Every trigger execution is logged with a trigger ID, timestamp, mode, status, duration, and source IP. Last 500 entries retained.</p>
          </div>
        </div>

        {/* ── Founders Program Section ── */}
        <div className="border-t border-neutral-800 pt-8 space-y-6" id="founders">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.15em]">Founders Program</h2>
              <p className="text-neutral-500 text-xs uppercase tracking-widest">10 slots · Enterprise-level access · Free forever</p>
            </div>
          </div>

          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-pink-400 uppercase tracking-widest">First 10 Users Get Enterprise for Free</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The Founders Program gives the first 10 users enterprise-level access at no cost. Check availability with <code className="text-pink-400">GET /api/founders</code> and claim your slot with <code className="text-pink-400">POST /api/founders</code> (requires Clerk auth).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Benefits</p>
                <ul className="space-y-1">
                  {["10,000 agent runs/month (enterprise-level)", "All 25 playbooks + industry packs", "All 35+ AI models", "Priority support", "Founding Member badge", "Free forever while active"].map(b => (
                    <li key={b} className="text-[10px] text-neutral-400 flex items-start gap-2">
                      <Heart className="w-3 h-3 text-pink-400 mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-2">Requirements</p>
                <ul className="space-y-1">
                  {["Provide honest product feedback", "Allow anonymized case study use", "Share a testimonial if you find value"].map(r => (
                    <li key={r} className="text-[10px] text-neutral-400 flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-black/50 border border-pink-500/10 rounded-lg p-4 space-y-2">
                <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Check Status</p>
                <pre className="text-[10px] text-neutral-400 overflow-x-auto">curl https://sovereignmatrix.agency/api/founders</pre>
              </div>
              <div className="bg-black/50 border border-pink-500/10 rounded-lg p-4 space-y-2">
                <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Claim Slot</p>
                <pre className="text-[10px] text-neutral-400 overflow-x-auto">{`curl -X POST https://sovereignmatrix.agency/api/founders \\
  -H "Cookie: __session=your_clerk_session"`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* ── Platform Stats Footer ── */}
        <div className="border-t border-neutral-800 pt-6 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Agents", value: "129" },
              { label: "Playbooks", value: "25" },
              { label: "AI Models", value: "65+" },
              { label: "Providers", value: "6" },
            ].map(stat => (
              <div key={stat.label} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-black text-emerald-400">{stat.value}</p>
                <p className="text-[9px] text-neutral-600 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

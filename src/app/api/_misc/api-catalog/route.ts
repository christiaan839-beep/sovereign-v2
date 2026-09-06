import { NextResponse } from "next/server";
import { PLAYBOOKS, PLAYBOOK_CATEGORIES } from "@/lib/playbooks";

/**
 * API CATALOG — Auto-generated documentation endpoint
 *
 * Returns the full platform capability manifest:
 * - All playbooks with their fields and agent chains
 * - All available agents
 * - Platform stats
 *
 * Public endpoint — used by docs page, partner integrations, and investors.
 */

const AGENT_CATALOG = [
  { name: "smart-router", category: "core", description: "Routes any prompt to the best AI model automatically" },
  { name: "leads", category: "growth", description: "Find and qualify B2B prospects by niche and location" },
  { name: "blog-gen", category: "content", description: "Generate SEO-optimized blog posts with anti-slop quality" },
  { name: "email-sequence", category: "growth", description: "Draft multi-touch email outreach campaigns" },
  { name: "seo-dominator", category: "growth", description: "Comprehensive SEO audit — technical, on-page, backlinks" },
  { name: "site-assassin", category: "intelligence", description: "Deep website analysis — messaging, positioning, tech stack" },
  { name: "competitor-scan", category: "intelligence", description: "Competitive intelligence and market analysis" },
  { name: "brand-voice", category: "content", description: "Brand voice analysis and consistency enforcement" },
  { name: "brand-audit", category: "intelligence", description: "Comprehensive brand audit across all touchpoints" },
  { name: "proposal-generator", category: "operations", description: "Generate professional business proposals" },
  { name: "case-study", category: "content", description: "Create compelling case studies with metrics" },
  { name: "contract-analyzer", category: "operations", description: "Legal document review with risk analysis" },
  { name: "client-report", category: "operations", description: "Generate client performance reports" },
  { name: "funnel-xray", category: "growth", description: "Sales funnel analysis and conversion optimization" },
  { name: "ad-report", category: "growth", description: "Advertising performance analysis and optimization" },
  { name: "organic-content", category: "content", description: "Organic content strategy and calendar generation" },
  { name: "deep-think", category: "core", description: "Complex reasoning and multi-step analysis" },
  { name: "omni-search", category: "core", description: "AI-synthesized research across multiple sources" },
  { name: "vision", category: "core", description: "Image and screenshot analysis" },
  { name: "translate", category: "core", description: "Multi-language translation" },
  { name: "embed", category: "core", description: "Generate text embeddings for semantic search" },
  { name: "doc-intel", category: "operations", description: "Document analysis and information extraction" },
  { name: "voice-synth", category: "communications", description: "Text-to-speech voice synthesis" },
  { name: "voice-closer", category: "communications", description: "AI-powered sales call execution" },
  { name: "image-gen", category: "content", description: "AI image generation via FLUX" },
  { name: "code-agent", category: "core", description: "Code generation, review, and debugging" },
  { name: "coordinator", category: "core", description: "Multi-agent pipeline orchestration from plain English" },
];

export async function GET() {
  return NextResponse.json({
    platform: "Sovereign Matrix",
    version: "2.1.0",
    description: "Autonomous AI agent platform — 140 specialized agents, 20 AI models, zero per-token cost",

    stats: {
      totalAgents: AGENT_CATALOG.length,
      totalPlaybooks: PLAYBOOKS.length,
      totalModels: 39,
      supportedProviders: ["NVIDIA NIM", "Google Gemini", "Anthropic Claude", "Groq", "DeepSeek", "Ollama"],
    },

    playbooks: PLAYBOOKS.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      category: p.category,
      agentCount: p.agentCount,
      estimatedTime: p.estimatedTime,
      fields: p.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options,
      })),
      agentChain: p.steps.map((s) => s.agent),
    })),

    playbookCategories: PLAYBOOK_CATEGORIES,

    agents: AGENT_CATALOG,

    agentsByCategory: Object.fromEntries(
      [...new Set(AGENT_CATALOG.map((a) => a.category))].map((cat) => [
        cat,
        AGENT_CATALOG.filter((a) => a.category === cat).map((a) => a.name),
      ])
    ),

    endpoints: {
      coordinator: {
        method: "POST",
        path: "/api/agents/coordinator",
        description: "Execute a playbook or free-form goal",
        body: {
          goal: "string (free-form mode)",
          playbook_id: "string (playbook mode)",
          inputs: "Record<string, string> (playbook field values)",
          auto_execute: "boolean (true to run immediately)",
        },
      },
      agents: {
        method: "POST",
        path: "/api/agents/{agent-name}",
        description: "Execute a single agent",
        body: { prompt: "string", confirmed: "boolean" },
      },
      health: {
        method: "GET",
        path: "/api/health/ping",
        description: "Uptime check — returns 200 if healthy, 503 if degraded",
      },
      usage: {
        method: "GET",
        path: "/api/usage",
        description: "Authenticated user's usage metrics and billing info",
      },
    },

    pricing: {
      free: { price: 0, runs: 50, description: "Try the platform" },
      array: { price: 49, runs: 500, description: "For solo operators" },
      node: { price: 199, runs: 2000, description: "For growing agencies" },
      enterprise: { price: 499, runs: 10000, description: "Unlimited scale" },
    },
  });
}

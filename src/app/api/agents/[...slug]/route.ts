import { NextRequest, NextResponse } from "next/server";

/**
 * UNIFIED AGENT ROUTER — Single serverless function for ALL 117 agents.
 *
 * Instead of 117 separate Lambda functions (which exceeds Vercel's free tier limit),
 * this catch-all route dynamically loads the correct agent handler based on the URL slug.
 *
 * URL: /api/agents/smart-router → loads src/app/api/_agents/smart-router/route.ts
 * URL: /api/agents/blog-gen → loads src/app/api/_agents/blog-gen/route.ts
 *
 * This is a single serverless function that handles all agent requests.
 */

// Build a registry of all agent handlers at module load time
const agentHandlers: Record<string, { POST?: Function; GET?: Function; PUT?: Function; DELETE?: Function }> = {};

// Dynamically import all agent route files
function getAgentHandler(slug: string) {
  if (agentHandlers[slug]) return agentHandlers[slug];

  try {
    // Dynamic require from the _agents directory
    const modulePath = `@/app/api/_agents/${slug}/route`;
    const mod = require(modulePath);
    agentHandlers[slug] = mod;
    return mod;
  } catch {
    return null;
  }
}

// Pre-register known agents for faster cold starts
const KNOWN_AGENTS = [
  "smart-router", "god-brain", "blog-gen", "leads", "seo-dominator",
  "site-assassin", "voice-synth", "voice-closer", "code-agent", "code-reviewer",
  "content", "content-safety", "collab-room", "workflows", "marketplace",
  "nemoclaw", "nemoclaw-setup", "page-builder", "image-gen", "imagen",
  "analytics", "audit", "benchmark", "memory", "orchestrator",
  "email-sequence", "closer", "comms", "competitive-radar",
  "deep-think", "reasoning-chain", "vision", "vision-analyze", "ocr",
  "embed", "rerank", "omni-search", "grounded-search", "translate",
  "voice", "voice-chat", "voice-assistant", "webhook-gateway", "weekly-report",
  "auto-heal", "scheduler", "pipeline", "swarm", "agentic-chain",
  "feedback", "social-router", "telegram-router", "pii-redactor", "pii-guard",
  "doc-intel", "doc-analyst", "proposal-generator", "case-study", "brand-voice",
  "brand-audit", "ad-report", "ads", "seo", "video-gen", "cosmos-video",
  "flux-image", "creative-director", "filmmaker", "design",
  "reputation", "organic-content", "programmatic-seo", "funnel-xray",
  "contract-analyzer", "support-bot", "client-report", "whitelabel",
  "workflow-engine", "ai-gateway", "abm-artillery", "booking", "calendar",
  "agentic-planner", "auto-onboard", "billing", "chain-reactor",
  "claw-queue", "claude-think", "competitor", "competitor-scan",
  "computer-use", "deepseek-r1", "digital-human", "email-onboard",
  "firecrawl", "florence-ocr", "flywheel", "ghost-fleet", "gliner-pii",
  "meta-prompt", "meeting-notes", "meeting-transcriber", "multilingual-voice",
  "nemotron-omni", "nemotron3-super", "outbound", "page-builder-stream",
  "rag-pipeline", "replays", "url-context", "vertex-search", "verticals",
  "visual-reason", "voicechat", "asr", "code-sandbox"
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const handler = getAgentHandler(agentName);
  if (!handler?.POST) {
    return NextResponse.json(
      { error: `Agent "${agentName}" not found`, available: KNOWN_AGENTS.slice(0, 20) },
      { status: 404 }
    );
  }

  try {
    return await handler.POST(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${agentName}" failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const handler = getAgentHandler(agentName);
  if (!handler?.GET) {
    // Return agent list for discovery
    return NextResponse.json({
      agents: KNOWN_AGENTS,
      count: KNOWN_AGENTS.length,
      usage: "POST /api/agents/{agent-name} with { prompt: '...' }",
    });
  }

  try {
    return await handler.GET(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${agentName}" GET failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const handler = getAgentHandler(slug.join("/"));
  if (!handler?.PUT) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.PUT(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${slug.join("/")}" PUT failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const handler = getAgentHandler(slug.join("/"));
  if (!handler?.DELETE) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.DELETE(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${slug.join("/")}" DELETE failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { quickAuth } from "@/lib/agent-auth";
import { detectJailbreak } from "@/lib/jailbreak-detect";
import { checkContentSafety } from "@/lib/content-safety";

/**
 * UNIFIED AGENT ROUTER — Single serverless function for ALL 117 agents.
 *
 * Instead of 117 separate Lambda functions (which exceeds Vercel's free tier limit),
 * this catch-all route dynamically loads the correct agent handler based on the URL slug.
 *
 * URL: /api/agents/smart-router → loads src/app/api/_agents/smart-router/route.ts
 * URL: /api/agents/blog-gen → loads src/app/api/_agents/blog-gen/route.ts
 *
 * SECURITY: All requests are authenticated via Clerk before reaching individual handlers.
 * Internal-only requests (from other agents via X-Sovereign-Internal header) bypass auth.
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

  // Authenticate — skip for internal agent-to-agent calls
  const internalToken = req.headers.get("X-Sovereign-Internal");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "v1-proxy";
  const isInternal = internalToken === expectedSecret && expectedSecret !== "v1-proxy";
  if (!isInternal) {
    const authError = await quickAuth(req, agentName);
    if (authError) return authError;
  }

  const handler = getAgentHandler(agentName);
  if (!handler?.POST) {
    return NextResponse.json(
      { error: `Agent "${agentName}" not found`, available: KNOWN_AGENTS.slice(0, 20) },
      { status: 404 }
    );
  }

  // ── GATEWAY-LEVEL SECURITY: Jailbreak + Content Safety on ALL agents ──
  // This catches attacks even on legacy agents that don't use createAgentRoute
  try {
    const clonedReq = req.clone();
    const body = await clonedReq.json().catch(() => null);
    if (body) {
      // Extract the primary text input (check common field names)
      const textInput = body.prompt || body.input || body.message || body.task || body.text || body.query || "";
      if (typeof textInput === "string" && textInput.length > 10) {
        // Jailbreak detection (fast path: regex, slow path: NIM model)
        const jailbreak = await detectJailbreak(textInput).catch(() => ({ blocked: false }));
        if (jailbreak.blocked) {
          return NextResponse.json(
            { error: "Request blocked by security system. Input flagged as prompt injection." },
            { status: 403 }
          );
        }

        // Content safety check (NIM model)
        const safety = await checkContentSafety(textInput).catch(() => ({ safe: true }));
        if (!safety.safe) {
          return NextResponse.json(
            { error: "Content blocked by safety filter." },
            { status: 403 }
          );
        }
      }
    }
  } catch {
    // Security checks failed — continue to agent (fail-open on check errors, fail-closed on detection)
  }

  // ── EXECUTE AGENT with error recovery ──
  try {
    const response = await handler.POST(req);
    response.headers.set("X-Powered-By", "Sovereign Matrix");
    response.headers.set("X-Agent", agentName);
    return response;
  } catch (err) {
    console.error(`[agent-router] ${agentName} failed:`, err);

    // Auto-recovery: if the agent crashed, return a structured error
    return NextResponse.json(
      {
        error: `Agent "${agentName}" encountered an error and will retry on next request.`,
        recovery: "automatic",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  // Authenticate GET requests too
  const internalToken = req.headers.get("X-Sovereign-Internal");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "v1-proxy";
  const isInternal = internalToken === expectedSecret && expectedSecret !== "v1-proxy";
  if (!isInternal) {
    const authError = await quickAuth(req, agentName);
    if (authError) return authError;
  }

  const handler = getAgentHandler(agentName);
  if (!handler?.GET) {
    return NextResponse.json({
      agents: KNOWN_AGENTS,
      count: KNOWN_AGENTS.length,
      usage: "POST /api/agents/{agent-name} with { prompt: '...' }",
    });
  }

  try {
    return await handler.GET(req);
  } catch (err) {
    console.error(`[agent-router] ${agentName} GET failed:`, err);
    return NextResponse.json(
      { error: `Agent "${agentName}" GET failed` },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const internalToken = req.headers.get("X-Sovereign-Internal");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "v1-proxy";
  const isInternal = internalToken === expectedSecret && expectedSecret !== "v1-proxy";
  if (!isInternal) {
    const authError = await quickAuth(req, agentName);
    if (authError) return authError;
  }

  const handler = getAgentHandler(agentName);
  if (!handler?.PUT) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.PUT(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${agentName}" PUT failed` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const internalToken = req.headers.get("X-Sovereign-Internal");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "v1-proxy";
  const isInternal = internalToken === expectedSecret && expectedSecret !== "v1-proxy";
  if (!isInternal) {
    const authError = await quickAuth(req, agentName);
    if (authError) return authError;
  }

  const handler = getAgentHandler(agentName);
  if (!handler?.DELETE) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.DELETE(req);
  } catch (err) {
    return NextResponse.json(
      { error: `Agent "${slug.join("/")}" DELETE failed` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { AGENT_REGISTRY } from "../registry";
import { buildAgentResume, serializeAgentResume } from "@/lib/agent-resume";

/**
 * UNIFIED AGENT ROUTER — Single serverless function for ALL 223 agents.
 *
 * Uses a static import registry (registry.ts) so webpack bundles all agent
 * modules into this serverless function. This is required for Vercel
 * compatibility — dynamic import() with webpackIgnore doesn't work because
 * the modules aren't included in the bundle.
 *
 * URL: /api/agents/smart-router → loads from AGENT_REGISTRY["smart-router"]
 */

const KNOWN_AGENTS = Object.keys(AGENT_REGISTRY);

// Cache loaded modules to avoid re-importing on every request
const loadedModules: Record<string, Awaited<ReturnType<(typeof AGENT_REGISTRY)[string]>>> = {};

async function getAgentHandler(slug: string) {
  if (loadedModules[slug]) return loadedModules[slug];

  const loader = AGENT_REGISTRY[slug];
  if (!loader) return null;

  try {
    const mod = await loader();
    loadedModules[slug] = mod;
    return mod;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const handler = await getAgentHandler(agentName);
  if (!handler?.POST) {
    return NextResponse.json(
      {
        error: `Agent "${agentName}" not found`,
        total_agents: KNOWN_AGENTS.length,
        sample: KNOWN_AGENTS.slice(0, 10),
        docs: "/api/agents",
        tip: "Use GET /api/agents for the full registered agent list.",
      },
      { status: 404 }
    );
  }

  try {
    const start = Date.now();
    const response = await handler.POST(req);
    const duration = Date.now() - start;
    response.headers.set("X-Powered-By", "Sovereign Matrix");
    response.headers.set("X-Agent", agentName);
    response.headers.set("X-Response-Time", `${duration}ms`);
    response.headers.set("Cache-Control", "no-store"); // Agent responses are dynamic, never cache
    return response;
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

  // ── .agent.md discovery endpoint ──
  // Agents expose a portable resume at `/api/agents/<slug>.agent.md` and
  // at `/api/agents/<slug>/resume`. The resume is front-matter + markdown
  // describing inputs, outputs, tier, and example requests — machine-readable
  // enough for Claude Code / Cursor agent discovery.
  const isResumeRequest =
    agentName.endsWith(".agent.md") ||
    (slug.length >= 2 && slug[slug.length - 1] === "resume");
  if (isResumeRequest) {
    const bareSlug = agentName.endsWith(".agent.md")
      ? agentName.slice(0, -".agent.md".length)
      : slug.slice(0, -1).join("/");
    const resume = buildAgentResume(bareSlug);
    if (!resume) {
      return new NextResponse(
        `# Agent not found\n\nSlug \`${bareSlug}\` is not registered. See GET /api/agents for the full list.\n`,
        { status: 404, headers: { "Content-Type": "text/markdown; charset=utf-8" } },
      );
    }
    return new NextResponse(serializeAgentResume(resume), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        // Slightly cacheable — resumes change only when code changes.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  const handler = await getAgentHandler(agentName);
  if (!handler?.GET) {
    return NextResponse.json({
      agents: KNOWN_AGENTS,
      count: KNOWN_AGENTS.length,
      usage: "POST /api/agents/{agent-name} with { prompt: '...' }",
      discover: {
        resume_endpoint: "GET /api/agents/<slug>.agent.md",
        example: "/api/agents/leads.agent.md",
      },
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
  const handler = await getAgentHandler(slug.join("/"));
  if (!handler?.PUT) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.PUT(req);
  } catch (err) {
    return NextResponse.json(
      { error: `PUT failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const handler = await getAgentHandler(slug.join("/"));
  if (!handler?.DELETE) return NextResponse.json({ error: "Method not supported" }, { status: 405 });
  try {
    return await handler.DELETE(req);
  } catch (err) {
    return NextResponse.json(
      { error: `DELETE failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

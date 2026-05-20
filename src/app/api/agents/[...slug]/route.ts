import { NextRequest, NextResponse } from "next/server";
import { AGENT_REGISTRY } from "../registry";
import { runWithBudgetAndAudit } from "@/lib/execution-budget";
import { auth } from "@clerk/nextjs/server";
import crypto from "node:crypto";

/**
 * UNIFIED AGENT ROUTER — Single serverless function for ALL 126 agents.
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
const loadedModules: Record<
  string,
  Awaited<ReturnType<(typeof AGENT_REGISTRY)[string]>>
> = {};

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const handler = await getAgentHandler(agentName);
  if (!handler?.POST) {
    return NextResponse.json(
      {
        error: `Agent "${agentName}" not found`,
        available: KNOWN_AGENTS.slice(0, 30),
      },
      { status: 404 },
    );
  }

  try {
    // Wave-107: wrap the handler in a per-request execution budget so
    // wave-106's kill-switch actually fires. Every internal ai() call,
    // every checkpoint() touchpoint inside the handler meters against
    // the same per-request limits. Runaway loops return 429 with a
    // structured trip reason; the audit row captures the killed
    // request for SRE postmortem.
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const { userId } = await auth().catch(() => ({ userId: null }));

    const start = Date.now();
    const result = await runWithBudgetAndAudit<NextResponse>(
      { userId: userId ?? null, requestId },
      async () => {
        const res = await handler.POST!(req);
        return res as NextResponse;
      },
    );
    const duration = Date.now() - start;

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Agent execution exceeded per-request budget",
          reason: result.reason,
          agent: agentName,
          requestId,
        },
        { status: result.status, headers: result.headers },
      );
    }

    const response = result.value;
    response.headers.set("X-Powered-By", "Sovereign Matrix");
    response.headers.set("X-Agent", agentName);
    response.headers.set("X-Response-Time", `${duration}ms`);
    response.headers.set("X-Sovereign-Request-Id", requestId);
    response.headers.set("Cache-Control", "no-store"); // Agent responses are dynamic, never cache
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error: `Agent "${agentName}" failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const agentName = slug.join("/");

  const handler = await getAgentHandler(agentName);
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
    return NextResponse.json(
      {
        error: `Agent "${agentName}" GET failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const handler = await getAgentHandler(slug.join("/"));
  if (!handler?.PUT)
    return NextResponse.json(
      { error: "Method not supported" },
      { status: 405 },
    );
  try {
    return await handler.PUT(req);
  } catch (err) {
    return NextResponse.json(
      {
        error: `PUT failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const handler = await getAgentHandler(slug.join("/"));
  if (!handler?.DELETE)
    return NextResponse.json(
      { error: "Method not supported" },
      { status: 405 },
    );
  try {
    return await handler.DELETE(req);
  } catch (err) {
    return NextResponse.json(
      {
        error: `DELETE failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

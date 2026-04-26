import { NextResponse } from "next/server";
import crypto from "crypto";
import { getBaseUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * WEBHOOK GATEWAY — External trigger point for Zapier, Make, n8n,
 * and any HTTP client to invoke agents via webhooks.
 *
 * Auth: x-api-key header compared against WEBHOOK_API_KEY (timing-safe).
 * Fail-closed: returns 503 if WEBHOOK_API_KEY is unset (prevents anonymous
 * denial-of-wallet against Anthropic/NIM via mapped agents).
 */

const log = createLogger("webhook-gateway");

const AGENT_MAP: Record<string, string> = {
  translate: "/api/_agents/translate",
  "pii-redactor": "/api/_agents/pii-redactor",
  "gliner-pii": "/api/_agents/gliner-pii",
  "blog-gen": "/api/_agents/blog-gen",
  "page-builder": "/api/_agents/page-builder",
  "image-gen": "/api/_agents/image-gen",
  "voice-synth": "/api/_agents/voice-synth",
  voicechat: "/api/_agents/voicechat",
  "cosmos-video": "/api/_agents/cosmos-video",
  "case-study": "/api/_agents/case-study",
  swarm: "/api/_agents/swarm",
  "chain-reactor": "/api/_agents/chain-reactor",
  "doc-intel": "/api/_agents/doc-intel",
  "florence-ocr": "/api/_agents/florence-ocr",
  "abm-artillery": "/api/_agents/abm-artillery",
  nemoclaw: "/api/_agents/nemoclaw",
  marketplace: "/api/_agents/marketplace",
};

const limiter = rateLimit({ interval: 60, limit: 30 });

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  // Rate limit before any work
  const limited = await limiter.check(request);
  if (limited) return limited;

  // ── Fail-closed API key check ──
  const expectedKey = process.env.WEBHOOK_API_KEY;
  if (!expectedKey) {
    log.error("WEBHOOK_API_KEY not configured — refusing all requests");
    return NextResponse.json(
      { error: "Webhook gateway disabled: WEBHOOK_API_KEY not configured." },
      { status: 503 },
    );
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!timingSafeEquals(apiKey, expectedKey)) {
    return NextResponse.json(
      { error: "Invalid API key. Set x-api-key header." },
      { status: 401 },
    );
  }

  let body: { agent?: string; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agent, payload } = body;
  if (!agent || typeof agent !== "string") {
    return NextResponse.json(
      { error: "agent is required.", available_agents: Object.keys(AGENT_MAP) },
      { status: 400 },
    );
  }

  const endpoint = AGENT_MAP[agent];
  if (!endpoint) {
    return NextResponse.json(
      {
        error: `Unknown agent: ${agent}`,
        available_agents: Object.keys(AGENT_MAP),
      },
      { status: 404 },
    );
  }

  const baseUrl = getBaseUrl();
  const startTime = Date.now();

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward gateway identity so downstream agents can attribute usage
        "x-webhook-source": "gateway",
      },
      body: JSON.stringify(payload || {}),
    });

    const result = await res.json();

    return NextResponse.json({
      success: true,
      agent,
      duration_ms: Date.now() - startTime,
      result,
    });
  } catch (error) {
    log.error("agent dispatch failed", { agent, error: String(error) });
    return NextResponse.json(
      { error: "Webhook gateway error", details: String(error) },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Webhook Gateway — Active",
    description:
      "External trigger point for Zapier, Make, n8n, and HTTP clients.",
    auth: "Set x-api-key header with your WEBHOOK_API_KEY",
    available_agents: Object.keys(AGENT_MAP),
    example: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "YOUR_KEY" },
      body: {
        agent: "translate",
        payload: { text: "Hello", target_lang: "es" },
      },
    },
  });
}

import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * WEBHOOK GATEWAY — External trigger point for Zapier, Make, n8n,
 * and any HTTP client to invoke agents via webhooks.
 * 
 * Uses a simple API key in the x-api-key header for auth.
 * Routes to any agent by name.
 */

const AGENT_MAP: Record<string, string> = {
  "translate": "/api/_agents/translate",
  "pii-redactor": "/api/_agents/pii-redactor",
  "gliner-pii": "/api/_agents/gliner-pii",
  "blog-gen": "/api/_agents/blog-gen",
  "page-builder": "/api/_agents/page-builder",
  "image-gen": "/api/_agents/image-gen",
  "voice-synth": "/api/_agents/voice-synth",
  "voicechat": "/api/_agents/voicechat",
  "cosmos-video": "/api/_agents/cosmos-video",
  "case-study": "/api/_agents/case-study",
  "swarm": "/api/_agents/swarm",
  "chain-reactor": "/api/_agents/chain-reactor",
  "doc-intel": "/api/_agents/doc-intel",
  "florence-ocr": "/api/_agents/florence-ocr",
  "abm-artillery": "/api/_agents/abm-artillery",
  "nemoclaw": "/api/_agents/nemoclaw",
  "marketplace": "/api/_agents/marketplace",
};

export async function POST(request: Request) {
  try {
    // API key auth
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.WEBHOOK_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: "Invalid API key. Set x-api-key header." }, { status: 401 });
    }

    const { agent, payload } = await request.json();

    if (!agent) {
      return NextResponse.json({
        error: "agent is required.",
        available_agents: Object.keys(AGENT_MAP),
      }, { status: 400 });
    }

    const endpoint = AGENT_MAP[agent];
    if (!endpoint) {
      return NextResponse.json({
        error: `Unknown agent: ${agent}`,
        available_agents: Object.keys(AGENT_MAP),
      }, { status: 404 });
    }

    const baseUrl = getBaseUrl();

    const startTime = Date.now();
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    return NextResponse.json({ error: "Webhook gateway error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Webhook Gateway — Active",
    description: "External trigger point for Zapier, Make, n8n, and HTTP clients.",
    auth: "Set x-api-key header with your WEBHOOK_API_KEY",
    available_agents: Object.keys(AGENT_MAP),
    example: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "YOUR_KEY" },
      body: { agent: "translate", payload: { text: "Hello", target_lang: "es" } },
    },
  });
}

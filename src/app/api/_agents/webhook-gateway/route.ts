import { NextResponse } from "next/server";

/**
 * WEBHOOK GATEWAY — External trigger point for Zapier, Make, n8n,
 * and any HTTP client to invoke agents via webhooks.
 * 
 * Uses a simple API key in the x-api-key header for auth.
 * Routes to any agent by name.
 */

const AGENT_MAP: Record<string, string> = {
  "translate": "/api/agents/translate",
  "pii-redactor": "/api/agents/pii-redactor",
  "gliner-pii": "/api/agents/gliner-pii",
  "blog-gen": "/api/agents/blog-gen",
  "page-builder": "/api/agents/page-builder",
  "image-gen": "/api/agents/image-gen",
  "voice-synth": "/api/agents/voice-synth",
  "voicechat": "/api/agents/voicechat",
  "cosmos-video": "/api/agents/cosmos-video",
  "case-study": "/api/agents/case-study",
  "swarm": "/api/agents/swarm",
  "chain-reactor": "/api/agents/chain-reactor",
  "doc-intel": "/api/agents/doc-intel",
  "florence-ocr": "/api/agents/florence-ocr",
  "abm-artillery": "/api/agents/abm-artillery",
  "nemoclaw": "/api/agents/nemoclaw",
  "marketplace": "/api/agents/marketplace",
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

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

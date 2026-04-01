import { NextRequest, NextResponse } from "next/server";

/**
 * SOVEREIGN MATRIX MCP SERVER — Model Context Protocol endpoint.
 *
 * Exposes internal agent capabilities as MCP tools that external clients
 * (Claude Desktop, Claude Code, etc.) can discover and invoke via JSON-RPC.
 *
 * Protocol: MCP JSON-RPC 2.0 over HTTP POST
 * Spec: https://modelcontextprotocol.io
 */

// ── Tool Definitions ──

interface MCPToolParam {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, MCPToolParam>;
    required: string[];
  };
}

const TOOLS: MCPTool[] = [
  {
    name: "site-assassin",
    description:
      "Scrape and analyze any website URL. Identifies UX weaknesses, conversion killers, mobile issues, and scores the site. Can also generate a superior landing page clone.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The target website URL to analyze" },
        mode: {
          type: "string",
          description: "Analysis mode",
          enum: ["analyze", "clone-superior"],
          default: "analyze",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "smart-router",
    description:
      "Intelligent AI model router. Classifies a task and selects the optimal open-source model from a registry of 20+ models, then executes the prompt. Can also just return routing metadata without execution.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The prompt to route and execute" },
        task_type: {
          type: "string",
          description: "Explicit task type (auto-detected from prompt if omitted)",
          enum: [
            "translation", "code-generation", "content-writing", "analysis",
            "email", "safety", "voice", "legal", "debate", "summarization",
            "deep-reasoning", "vision", "agentic", "long-context",
            "software-engineering", "architecture", "ocr", "transcription",
            "fast-chat", "math", "video-understanding",
          ],
        },
        priority: {
          type: "string",
          description: "Optimize for speed or quality",
          enum: ["speed", "quality"],
          default: "quality",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "leads",
    description:
      "B2B lead prospecting engine. Generates targeted business prospects for a given niche and location, identifies their marketing gaps, and drafts hyper-personalized cold emails.",
    inputSchema: {
      type: "object",
      properties: {
        niche: { type: "string", description: "Business niche or industry (e.g., 'roofing contractors', 'dental clinics')" },
        location: { type: "string", description: "Target geographic location (e.g., 'Austin, TX', 'London, UK')" },
      },
      required: ["niche", "location"],
    },
  },
  {
    name: "content-generate",
    description:
      "Content factory that generates blog posts, email sequences, social media packs, or video scripts on demand.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Type of content to generate",
          enum: ["blog", "email", "social", "video"],
        },
        topic: { type: "string", description: "Topic or subject for blog posts and video scripts" },
        keywords: { type: "string", description: "Comma-separated SEO keywords (for blog action)" },
        tone: { type: "string", description: "Writing tone (e.g., 'professional', 'casual', 'aggressive')" },
        product: { type: "string", description: "Product name (for email sequences)" },
        audience: { type: "string", description: "Target audience (for email and social)" },
        platforms: { type: "string", description: "Comma-separated platforms (for social action, e.g., 'twitter,linkedin,instagram')" },
      },
      required: ["action"],
    },
  },
  {
    name: "competitor",
    description:
      "Deep competitive intelligence analysis. Identifies competitor strengths, weaknesses, market gaps, pricing vulnerabilities, and generates a battle plan using Porter's Five Forces + Blue Ocean Strategy.",
    inputSchema: {
      type: "object",
      properties: {
        competitorUrl: { type: "string", description: "Competitor website URL" },
        competitorName: { type: "string", description: "Competitor business name" },
        yourBusiness: { type: "string", description: "Your business name or description" },
        industry: { type: "string", description: "Industry vertical (e.g., 'Marketing technology')" },
      },
      required: [],
    },
  },
  {
    name: "seo-audit",
    description:
      "SEO domination toolkit. Runs competitor X-ray analysis, content gap detection, schema markup audits, or Google Business Profile optimization.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "SEO action to perform",
          enum: ["xray", "gap", "schema", "gbp"],
        },
        url: { type: "string", description: "Target URL (for xray and schema actions)" },
        urls: { type: "string", description: "Comma-separated competitor URLs (for xray action)" },
        business: { type: "string", description: "Business name (for xray and gbp actions)" },
        domain: { type: "string", description: "Your domain (for gap action)" },
        competitors: { type: "string", description: "Comma-separated competitor domains (for gap action)" },
        niche: { type: "string", description: "Business niche (for gap action)" },
        businessType: { type: "string", description: "Type of business (for schema action)" },
        location: { type: "string", description: "Business location (for gbp action)" },
        services: { type: "string", description: "Comma-separated services offered (for gbp action)" },
      },
      required: ["action"],
    },
  },
  {
    name: "voice-synth",
    description:
      "Text-to-speech voice synthesis. Converts text to audio using NVIDIA Magpie TTS (free) or ElevenLabs (premium). Returns audio generation status and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to synthesize into speech" },
        voice: {
          type: "string",
          description: "Voice style",
          enum: ["flow", "zeroshot"],
          default: "flow",
        },
        speed: { type: "string", description: "Speech speed multiplier (e.g., '1.0', '1.5')" },
        provider: {
          type: "string",
          description: "TTS provider",
          enum: ["magpie", "elevenlabs"],
          default: "magpie",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "code-execute",
    description: "Execute Python code in a secure cloud sandbox. Returns stdout output and any generated visualizations.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code to execute" },
        libraries: { type: "array", items: { type: "string" }, description: "Python packages to install before execution" },
      },
      required: ["code"],
    },
  },
  {
    name: "data-analyze",
    description: "Analyze data by describing the task in plain English. Generates and executes Python code automatically.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Natural language description of the analysis to perform" },
        data: { type: "string", description: "CSV or JSON data to analyze (optional)" },
      },
      required: ["task"],
    },
  },
];

// ── JSON-RPC Types ──

interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: string | number | null;
}

// ── Internal Agent Caller ──

async function callAgent(
  agentSlug: string,
  body: Record<string, unknown>,
  baseUrl: string
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}/api/agents/${agentSlug}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";

  // Voice-synth returns audio, not JSON
  if (contentType.includes("audio/")) {
    return {
      success: true,
      message: "Audio generated successfully",
      contentType,
      byteLength: res.headers.get("content-length"),
      provider: res.headers.get("x-provider") || "unknown",
      model: res.headers.get("x-model") || "unknown",
    };
  }

  return res.json();
}

// ── Tool Call Router ──

function buildAgentPayload(
  toolName: string,
  args: Record<string, unknown>
): { slug: string; body: Record<string, unknown> } {
  switch (toolName) {
    case "site-assassin":
      return {
        slug: "site-assassin",
        body: { url: args.url, mode: args.mode || "analyze" },
      };

    case "smart-router":
      return {
        slug: "smart-router",
        body: {
          prompt: args.prompt,
          task_type: args.task_type,
          priority: args.priority || "quality",
        },
      };

    case "leads":
      return {
        slug: "leads",
        body: {
          action: "prospect",
          params: { niche: args.niche, location: args.location },
        },
      };

    case "content-generate": {
      const params: Record<string, unknown> = {};
      if (args.topic) params.topic = args.topic;
      if (args.tone) params.tone = args.tone;
      if (args.product) params.product = args.product;
      if (args.audience) params.audience = args.audience;
      if (args.keywords) params.keywords = String(args.keywords).split(",").map(k => k.trim());
      if (args.platforms) params.platforms = String(args.platforms).split(",").map(p => p.trim());
      return {
        slug: "content",
        body: { action: args.action, params },
      };
    }

    case "competitor":
      return {
        slug: "competitor",
        body: {
          competitorUrl: args.competitorUrl,
          competitorName: args.competitorName,
          yourBusiness: args.yourBusiness,
          industry: args.industry,
        },
      };

    case "seo-audit": {
      const seoParams: Record<string, unknown> = {};
      if (args.url) seoParams.url = args.url;
      if (args.business) seoParams.business = args.business;
      if (args.businessType) seoParams.businessType = args.businessType;
      if (args.domain) seoParams.domain = args.domain;
      if (args.niche) seoParams.niche = args.niche;
      if (args.location) seoParams.location = args.location;
      if (args.urls) seoParams.urls = String(args.urls).split(",").map(u => u.trim());
      if (args.competitors) seoParams.competitors = String(args.competitors).split(",").map(c => c.trim());
      if (args.services) seoParams.services = String(args.services).split(",").map(s => s.trim());
      return {
        slug: "seo",
        body: { action: args.action, params: seoParams },
      };
    }

    case "voice-synth":
      return {
        slug: "voice-synth",
        body: {
          text: args.text,
          voice: args.voice || "flow",
          speed: args.speed ? parseFloat(String(args.speed)) : 1.0,
          provider: args.provider || "magpie",
        },
      };

    case "code-execute":
      return {
        slug: "code-sandbox",
        body: {
          action: "execute",
          code: args.code,
          libraries: args.libraries,
        },
      };

    case "data-analyze":
      return {
        slug: "code-sandbox",
        body: {
          action: "analyze",
          task: args.task,
          data: args.data,
        },
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ── MCP Protocol Handlers ──

function handleInitialize(id: string | number): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: {
        name: "sovereign-matrix",
        version: "1.0.0",
      },
    },
    id,
  };
}

function handleToolsList(id: string | number): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    result: { tools: TOOLS },
    id,
  };
}

async function handleToolsCall(
  params: Record<string, unknown>,
  baseUrl: string,
  id: string | number
): Promise<JSONRPCResponse> {
  const toolName = params.name as string;
  const args = (params.arguments as Record<string, unknown>) || {};

  if (!toolName) {
    return {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Missing tool name in params.name" },
      id,
    };
  }

  const toolExists = TOOLS.find(t => t.name === toolName);
  if (!toolExists) {
    return {
      jsonrpc: "2.0",
      error: {
        code: -32602,
        message: `Unknown tool: "${toolName}"`,
        data: { available: TOOLS.map(t => t.name) },
      },
      id,
    };
  }

  try {
    const { slug, body } = buildAgentPayload(toolName, args);
    const result = await callAgent(slug, body, baseUrl);

    return {
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
      id,
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      id,
    };
  }
}

// ── HTTP Handler ──

export async function POST(req: NextRequest) {
  try {
    const body: JSONRPCRequest = await req.json();

    // Validate JSON-RPC envelope
    if (body.jsonrpc !== "2.0" || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32600, message: "Invalid JSON-RPC request. Required: jsonrpc='2.0' and method." },
          id: body?.id ?? null,
        },
        { status: 400 }
      );
    }

    const baseUrl = new URL(req.url).origin;

    let response: JSONRPCResponse;

    switch (body.method) {
      case "initialize":
        response = handleInitialize(body.id);
        break;

      case "notifications/initialized":
        // Client acknowledgment — no response needed, but return success
        response = { jsonrpc: "2.0", result: {}, id: body.id };
        break;

      case "tools/list":
        response = handleToolsList(body.id);
        break;

      case "tools/call":
        response = await handleToolsCall(body.params || {}, baseUrl, body.id);
        break;

      default:
        response = {
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: "${body.method}"`,
            data: { available: ["initialize", "tools/list", "tools/call"] },
          },
          id: body.id,
        };
    }

    return NextResponse.json(response, {
      headers: {
        "X-Powered-By": "Sovereign Matrix MCP",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        },
        id: null,
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "sovereign-matrix",
    version: "1.0.0",
    protocol: "MCP JSON-RPC 2.0",
    description: "Sovereign Matrix agent capabilities exposed as MCP tools",
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    usage: {
      endpoint: "POST /api/mcp",
      format: '{ "jsonrpc": "2.0", "method": "tools/list", "id": 1 }',
      methods: ["initialize", "tools/list", "tools/call"],
    },
  });
}

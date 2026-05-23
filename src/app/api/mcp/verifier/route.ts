/**
 * POST /api/mcp/verifier — public verifier MCP server.
 *
 * Sovereign as a tool in every Claude Desktop / Claude Code / Cursor /
 * Continue.dev install. Installation requires one config-file line and
 * no auth — the verifier is open-CORS by design, so an MCP server
 * fronting it can be too.
 *
 * Why a separate route from /api/mcp:
 *   - /api/mcp exposes internal agent capabilities (site-assassin,
 *     content generators, code execution, etc.) that require
 *     authentication for the underlying agents.
 *   - This route exposes ONLY the verifier-track tools (the platform's
 *     moat made portable). No auth, no rate-limited per-tenant logic,
 *     no API key. A compliance auditor or curious dev can install
 *     this server and run it against Sovereign's production verifier
 *     immediately.
 *   - Splitting the route prevents internal-tool noise from polluting
 *     the tools/list response that public clients see.
 *
 * Protocol: MCP JSON-RPC 2.0 over HTTP POST. Spec:
 *   https://modelcontextprotocol.io/specification
 *
 * Installation instructions (Claude Desktop ~/Library/Application
 * Support/Claude/claude_desktop_config.json or equivalent for Cursor):
 *
 *   {
 *     "mcpServers": {
 *       "sovereign-verifier": {
 *         "type": "http",
 *         "url": "https://sovereignmatrix.agency/api/mcp/verifier"
 *       }
 *     }
 *   }
 *
 * Tools exposed:
 *   - verify_receipt:        recompute HMAC + return {valid}
 *   - fetch_receipt:         return canonical + signature for a receipt id
 *   - latest_public_receipt: return the freshest public receipt
 *   - recent_public_receipts: return the last N public receipts (feed)
 *
 * Cache: each tool call hits the same underlying API the rest of the
 * platform uses, which has its own edge cache. The MCP route itself
 * is uncacheable (JSON-RPC requests are not idempotent at the
 * protocol level — even though every tool exposed here happens to be).
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/* ─── JSON-RPC types ──────────────────────────────────────────── */

interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: number | string | null;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/* ─── Tool catalog ────────────────────────────────────────────── */

const TOOLS = [
  {
    name: "verify_receipt",
    description:
      "Verify a Sovereign agent-run receipt against the public verifier endpoint. Recomputes HMAC-SHA256 over the canonical projection and returns whether the signature is valid. The same endpoint used by the embed badge — no auth, no API key.",
    inputSchema: {
      type: "object",
      properties: {
        canonical: {
          type: "string",
          description:
            "The receipt's canonical projection — a deterministic JSON string. Get it from /api/agent-runs/<id> or paste from /r/<id>.",
        },
        signature: {
          type: "string",
          description:
            "The receipt's HMAC signature in 'v1=<hex>' form (or just the hex digest).",
        },
      },
      required: ["canonical", "signature"],
    },
  },
  {
    name: "fetch_receipt",
    description:
      "Fetch a Sovereign agent-run receipt by ID. Returns the receipt's canonical projection, signature, agent name, model used, duration, and timestamps — enough to verify the receipt locally or paste it into any other MCP client. Visibility-gated: only public/unlisted receipts are returned.",
    inputSchema: {
      type: "object",
      properties: {
        receipt_id: {
          type: "string",
          description:
            "Receipt id (UUID-ish, 32-40 hex chars with optional dashes). Looks like 'a1b2c3...' or '12345678-abcd-...'.",
        },
      },
      required: ["receipt_id"],
    },
  },
  {
    name: "latest_public_receipt",
    description:
      "Return the freshest public receipt on the Sovereign platform. Useful for 'show me what was just signed' demos in AI tools, or as a seed for verification walkthroughs.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "recent_public_receipts",
    description:
      "Return a feed of the most recent public receipts (block-explorer-style). Each row includes agent name, model, duration, and signature fingerprint — enough to render a UI without exposing the actual HMAC. Caller should fetch_receipt for full data.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "How many receipts to return (1-50, default 10).",
          default: 10,
        },
      },
      required: [],
    },
  },
];

/* ─── Handlers ────────────────────────────────────────────────── */

function handleInitialize(id: JSONRPCRequest["id"]): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: {
        name: "sovereign-verifier",
        version: "1.0.0",
      },
    },
  };
}

function handleToolsList(id: JSONRPCRequest["id"]): JSONRPCResponse {
  return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
}

async function handleToolsCall(
  params: Record<string, unknown>,
  baseUrl: string,
  id: JSONRPCRequest["id"],
): Promise<JSONRPCResponse> {
  const name = String(params.name ?? "");
  const args = (params.arguments ?? {}) as Record<string, unknown>;

  try {
    let payload: unknown;

    switch (name) {
      case "verify_receipt": {
        const canonical = String(args.canonical ?? "");
        const signature = String(args.signature ?? "");
        if (!canonical || !signature) {
          throw new Error("Both `canonical` and `signature` are required.");
        }
        // Wave 116 carve-out: same-deployment self-call to /api/verify.
        // baseUrl is the operator-controlled deployment URL (never user-
        // supplied), so SSRF risk is zero. Tests mock `fetch` directly to
        // assert the forwarded payload; wrapping in outboundFetch would
        // require an SSRF-aware test-mode shim — deferred. Self-call URL
        // shape is the explicit M1 carve-out class.
        // eslint-disable-next-line no-restricted-syntax
        const res = await fetch(`${baseUrl}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonical, signature }),
        });
        payload = await res.json();
        break;
      }

      case "fetch_receipt": {
        const receiptId = String(args.receipt_id ?? "");
        if (!/^[0-9a-f-]{32,40}$/i.test(receiptId)) {
          throw new Error(
            "`receipt_id` must be 32-40 hex chars with optional dashes.",
          );
        }
        // eslint-disable-next-line no-restricted-syntax -- same-deployment self-call (M1 carve-out, see above)
        const res = await fetch(`${baseUrl}/api/agent-runs/${receiptId}`);
        if (res.status === 404) {
          throw new Error(
            "Receipt not found, or it's marked private. Only public/unlisted receipts are fetchable here.",
          );
        }
        payload = await res.json();
        break;
      }

      case "latest_public_receipt": {
        // eslint-disable-next-line no-restricted-syntax -- same-deployment self-call (M1 carve-out)
        const res = await fetch(`${baseUrl}/api/agent-runs/latest-public`);
        payload = await res.json();
        break;
      }

      case "recent_public_receipts": {
        const rawLimit = Number(args.limit ?? 10);
        const limit = Math.min(Math.max(1, Math.floor(rawLimit) || 10), 50);
        // eslint-disable-next-line no-restricted-syntax -- same-deployment self-call (M1 carve-out)
        const res = await fetch(
          `${baseUrl}/api/agent-runs/recent-public?limit=${limit}`,
        );
        payload = await res.json();
        break;
      }

      default:
        throw new Error(
          `Unknown tool: "${name}". Available: ${TOOLS.map((t) => t.name).join(", ")}.`,
        );
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      },
    };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/* ─── HTTP entry points ───────────────────────────────────────── */

// Open CORS so any MCP client running in a browser or a non-Sovereign
// origin can call this endpoint directly. Same contract as
// /api/verify itself.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version",
};

// Generous limit — MCP clients can chain a few tool calls per
// conversation turn. 120/min is plenty for honest usage and still
// caps a runaway client.
const limiter = rateLimit({ interval: 60, limit: 120 });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: JSONRPCRequest | undefined;
  try {
    body = (await req.json()) as JSONRPCRequest;
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: invalid JSON" },
        id: null,
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message:
            "Invalid JSON-RPC: jsonrpc must be '2.0' and method is required.",
        },
        id: body?.id ?? null,
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const baseUrl = new URL(req.url).origin;

  let response: JSONRPCResponse;
  switch (body.method) {
    case "initialize":
      response = handleInitialize(body.id);
      break;
    case "notifications/initialized":
      response = { jsonrpc: "2.0", id: body.id, result: {} };
      break;
    case "tools/list":
      response = handleToolsList(body.id);
      break;
    case "tools/call":
      response = await handleToolsCall(body.params ?? {}, baseUrl, body.id);
      break;
    default:
      response = {
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32601,
          message: `Method not found: "${body.method}"`,
          data: {
            available: ["initialize", "tools/list", "tools/call"],
          },
        },
      };
  }

  return NextResponse.json(response, { headers: CORS_HEADERS });
}

/**
 * GET — discovery + installation docs. Hitting the URL in a browser
 * gives anyone exploring the MCP-server catalog a self-contained
 * description of what's here and how to wire it.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      name: "sovereign-verifier",
      version: "1.0.0",
      description:
        "Public MCP server for verifying Sovereign Matrix agent-run receipts. No auth required.",
      protocol: "MCP JSON-RPC 2.0 over HTTP",
      spec: "https://modelcontextprotocol.io/specification",
      endpoint: `${origin}/api/mcp/verifier`,
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      install: {
        claudeDesktop: {
          path: "~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%\\Claude\\claude_desktop_config.json (Windows)",
          snippet: {
            mcpServers: {
              "sovereign-verifier": {
                type: "http",
                url: `${origin}/api/mcp/verifier`,
              },
            },
          },
        },
        claudeCode: {
          path: "~/.claude.json (or project .mcp.json)",
          snippet: {
            mcpServers: {
              "sovereign-verifier": {
                type: "http",
                url: `${origin}/api/mcp/verifier`,
              },
            },
          },
        },
        cursor: {
          path: "~/.cursor/mcp.json",
          snippet: {
            mcpServers: {
              "sovereign-verifier": {
                url: `${origin}/api/mcp/verifier`,
              },
            },
          },
        },
      },
      links: {
        spec: `${origin}/spec`,
        verifier: `${origin}/api/verify`,
        explorer: `${origin}/explorer`,
        trust: `${origin}/trust`,
      },
    },
    { headers: CORS_HEADERS },
  );
}

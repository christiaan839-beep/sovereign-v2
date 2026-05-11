/**
 * Tests for POST /api/mcp/verifier — public MCP server.
 *
 * The protocol surface is the contract MCP clients (Claude Desktop,
 * Cursor, etc.) consume — once a single client installs against it,
 * the JSON-RPC shape is effectively frozen. Pin every property.
 *
 * Properties covered:
 *   - JSON-RPC envelope: jsonrpc=2.0, id round-trips, method dispatch
 *   - initialize returns the right protocolVersion + serverInfo
 *   - tools/list returns the catalog (4 tools, schema shape)
 *   - tools/call dispatches to each of the 4 tools and proxies to the
 *     underlying API
 *   - tools/call rejects malformed input per tool (bad receipt_id format,
 *     missing required args)
 *   - unknown method → -32601 with `available` hint
 *   - bad JSON → -32700
 *   - OPTIONS returns 204 with CORS headers
 *   - GET returns a self-describing discovery payload
 *
 * The internal /api/verify and /api/agent-runs/* endpoints are stubbed
 * via a fetch mock so the test runs offline.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ check: () => Promise.resolve(null) }),
}));

async function loadRoute() {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  return await import("@/app/api/mcp/verifier/route");
}

function jsonRpc(
  method: string,
  params?: Record<string, unknown>,
  id: number | string | null = 1,
) {
  return new Request("http://x/api/mcp/verifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
  });
}

describe("POST /api/mcp/verifier", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe("envelope + dispatch", () => {
    it("rejects body with wrong jsonrpc version", async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request("http://x/api/mcp/verifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "1.0", method: "tools/list", id: 1 }),
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe(-32600);
    });

    it("rejects malformed JSON with -32700", async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        new Request("http://x/api/mcp/verifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
      );
      const body = await res.json();
      expect(body.error.code).toBe(-32700);
    });

    it("returns -32601 with `available` hint on unknown method", async () => {
      const { POST } = await loadRoute();
      const res = await POST(jsonRpc("tools/fakemethod", {}));
      const body = await res.json();
      expect(body.error.code).toBe(-32601);
      expect(body.error.data.available).toContain("tools/call");
    });

    it("round-trips the request id", async () => {
      const { POST } = await loadRoute();
      const res = await POST(jsonRpc("initialize", {}, "req-abc"));
      const body = await res.json();
      expect(body.id).toBe("req-abc");
    });

    it("acknowledges notifications/initialized with empty result", async () => {
      const { POST } = await loadRoute();
      const res = await POST(jsonRpc("notifications/initialized", {}));
      const body = await res.json();
      expect(body.result).toEqual({});
    });
  });

  describe("initialize", () => {
    it("returns protocolVersion 2024-11-05 + serverInfo", async () => {
      const { POST } = await loadRoute();
      const res = await POST(jsonRpc("initialize", {}));
      const body = await res.json();
      expect(body.result.protocolVersion).toBe("2024-11-05");
      expect(body.result.serverInfo).toEqual({
        name: "sovereign-verifier",
        version: "1.0.0",
      });
      expect(body.result.capabilities.tools).toBeDefined();
    });
  });

  describe("tools/list", () => {
    it("returns the 4-tool catalog with valid inputSchema shape", async () => {
      const { POST } = await loadRoute();
      const res = await POST(jsonRpc("tools/list", {}));
      const body = await res.json();
      const names = body.result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual([
        "verify_receipt",
        "fetch_receipt",
        "latest_public_receipt",
        "recent_public_receipts",
      ]);
      for (const t of body.result.tools) {
        expect(t.inputSchema.type).toBe("object");
        expect(t.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe("tools/call → verify_receipt", () => {
    it("proxies canonical+signature to /api/verify", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true }), { status: 200 }),
      );
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "verify_receipt",
          arguments: {
            canonical: '{"v":1,"id":"abc"}',
            signature: "v1=deadbeef",
          },
        }),
      );
      const body = await res.json();
      expect(body.result.content[0].type).toBe("text");
      const parsed = JSON.parse(body.result.content[0].text);
      expect(parsed.valid).toBe(true);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("http://x/api/verify");
      expect((init as RequestInit).method).toBe("POST");
    });

    it("returns -32000 when required args are missing", async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "verify_receipt",
          arguments: { canonical: "x" },
        }),
      );
      const body = await res.json();
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toContain("required");
    });
  });

  describe("tools/call → fetch_receipt", () => {
    it("rejects malformed receipt_id (must be hex/dash format)", async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "fetch_receipt",
          arguments: { receipt_id: "not-a-valid-id-at-all" },
        }),
      );
      const body = await res.json();
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toMatch(/32-40 hex/);
    });

    it("proxies a valid receipt_id to /api/agent-runs/<id>", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "abc", canonical: "{}", signature: "v1=ff" }),
          { status: 200 },
        ),
      );
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "fetch_receipt",
          arguments: {
            receipt_id: "00000000-0000-0000-0000-000000000abc",
          },
        }),
      );
      const body = await res.json();
      const parsed = JSON.parse(body.result.content[0].text);
      expect(parsed.id).toBe("abc");
      expect(fetchMock.mock.calls[0]![0]).toBe(
        "http://x/api/agent-runs/00000000-0000-0000-0000-000000000abc",
      );
    });

    it("surfaces a clear error on 404 (private or missing receipt)", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response("not found", { status: 404 }),
      );
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "fetch_receipt",
          arguments: {
            receipt_id: "00000000-0000-0000-0000-00000000abcd",
          },
        }),
      );
      const body = await res.json();
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toMatch(/not found|private/i);
    });
  });

  describe("tools/call → latest_public_receipt + recent_public_receipts", () => {
    it("calls /api/agent-runs/latest-public with no args", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ receipt: null }), { status: 200 }),
      );
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "latest_public_receipt",
          arguments: {},
        }),
      );
      const body = await res.json();
      expect(body.result.content[0].type).toBe("text");
      expect(fetchMock.mock.calls[0]![0]).toBe(
        "http://x/api/agent-runs/latest-public",
      );
    });

    it("clamps recent_public_receipts limit to [1, 50]", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ count: 0, receipts: [] }), {
          status: 200,
        }),
      );
      const { POST } = await loadRoute();

      // default → 10
      await POST(
        jsonRpc("tools/call", {
          name: "recent_public_receipts",
          arguments: {},
        }),
      );
      expect(fetchMock.mock.calls[0]![0]).toContain("limit=10");

      // 9999 → 50
      await POST(
        jsonRpc("tools/call", {
          name: "recent_public_receipts",
          arguments: { limit: 9999 },
        }),
      );
      expect(fetchMock.mock.calls[1]![0]).toContain("limit=50");

      // 0 → 1
      await POST(
        jsonRpc("tools/call", {
          name: "recent_public_receipts",
          arguments: { limit: 0 },
        }),
      );
      expect(fetchMock.mock.calls[2]![0]).toContain("limit=1");
    });

    it("rejects unknown tool name", async () => {
      const { POST } = await loadRoute();
      const res = await POST(
        jsonRpc("tools/call", {
          name: "summon_unicorn",
          arguments: {},
        }),
      );
      const body = await res.json();
      expect(body.error.code).toBe(-32000);
      expect(body.error.message).toMatch(/Unknown tool/);
    });
  });

  describe("HTTP-side surfaces", () => {
    it("OPTIONS returns 204 with CORS headers", async () => {
      const { OPTIONS } = await loadRoute();
      const res = await OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    });

    it("GET returns self-describing discovery payload", async () => {
      const { GET } = await loadRoute();
      const res = await GET(
        new Request("https://example.test/api/mcp/verifier"),
      );
      const body = await res.json();
      expect(body.name).toBe("sovereign-verifier");
      expect(body.tools).toHaveLength(4);
      expect(body.install.claudeDesktop.snippet.mcpServers).toBeDefined();
      // The discovery payload should self-reference the request origin,
      // not the canonical host — preview deploys and white-label
      // domains must produce valid configs.
      expect(body.endpoint).toBe("https://example.test/api/mcp/verifier");
    });
  });
});

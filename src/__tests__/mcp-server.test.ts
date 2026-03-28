/**
 * MCP Server Tests
 *
 * Validates the Model Context Protocol JSON-RPC endpoint:
 * GET returns server info, POST handles tools/list, errors, and unknown methods.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
  },
}));

describe("MCP GET endpoint", () => {
  it("should return server info with tools list", async () => {
    const mod = await import("@/app/api/mcp/route");
    const res = await mod.GET();
    const data = await res.json();
    expect(data.name).toBe("sovereign-matrix");
    expect(data.version).toBe("1.0.0");
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThan(0);
  });

  it("should list available methods in usage", async () => {
    const mod = await import("@/app/api/mcp/route");
    const res = await mod.GET();
    const data = await res.json();
    expect(data.usage.methods).toContain("tools/list");
    expect(data.usage.methods).toContain("initialize");
  });

  it("all tools in GET response should have name and description", async () => {
    const mod = await import("@/app/api/mcp/route");
    const res = await mod.GET();
    const data = await res.json();
    for (const tool of data.tools) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
    }
  });
});

describe("MCP POST endpoint", () => {
  it("tools/list should return array of tools", async () => {
    const mod = await import("@/app/api/mcp/route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    });
    const res = await mod.POST(req as never);
    const data = await res.json();
    expect(data.jsonrpc).toBe("2.0");
    expect(Array.isArray(data.result.tools)).toBe(true);
  });

  it("all tools should have name, description, inputSchema", async () => {
    const mod = await import("@/app/api/mcp/route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 2 }),
    });
    const res = await mod.POST(req as never);
    const data = await res.json();
    for (const tool of data.result.tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("tools list should include site-assassin, smart-router, leads", async () => {
    const mod = await import("@/app/api/mcp/route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 3 }),
    });
    const res = await mod.POST(req as never);
    const data = await res.json();
    const names = data.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("site-assassin");
    expect(names).toContain("smart-router");
    expect(names).toContain("leads");
  });

  it("should return error for invalid jsonrpc version", async () => {
    const mod = await import("@/app/api/mcp/route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "1.0", method: "tools/list", id: 4 }),
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(-32600);
  });

  it("should return method-not-found for unknown method", async () => {
    const mod = await import("@/app/api/mcp/route");
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "unknown/method", id: 5 }),
    });
    const res = await mod.POST(req as never);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(-32601);
  });
});

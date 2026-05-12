/**
 * Tests for src/lib/tool-registry.ts — typed function-calling.
 *
 * The registry is the Tier-1 primitive that turns describe-only agents
 * into act-capable ones. These tests lock the contracts that make it
 * safe to deploy: name validation, duplicate prevention, three-tier
 * approval (autonomous / confirm / restricted), input validation,
 * error-wrapped dispatch, and JSON-serializable output.
 *
 * Pure module + side-effecting `execute` callbacks: we register
 * fixture tools per test, never share state across cases.
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  describeToolForModel,
  parseToolCallOutput,
  type ToolContext,
  type ToolDefinition,
} from "../tool-registry";

const STD_CTX: ToolContext = {
  userId: "user-1",
  tenantId: "tenant-1",
  agentSlug: "test-agent",
};

function makeReadOnlyTool(): ToolDefinition<{ q: string }, { hits: number }> {
  return {
    name: "search",
    description: "Search a public index. Read-only.",
    inputSchema: z.object({ q: z.string().min(1).max(500) }),
    tier: 1,
    execute: async (input) => ({ hits: input.q.length }),
  };
}

function makeWriteTool(): ToolDefinition<
  { to: string; body: string },
  { sent: boolean }
> {
  return {
    name: "send_email",
    description: "Send an email to the named recipient.",
    inputSchema: z.object({
      to: z.string().email(),
      body: z.string().min(1).max(20_000),
    }),
    tier: 2,
    execute: async () => ({ sent: true }),
  };
}

function makeAdminTool(): ToolDefinition<{ id: string }, { deleted: boolean }> {
  return {
    name: "delete_resource",
    description: "Permanently delete a tenant resource. Admin-only.",
    inputSchema: z.object({ id: z.string().uuid() }),
    tier: 3,
    execute: async () => ({ deleted: true }),
  };
}

describe("ToolRegistry.register", () => {
  it("accepts a well-formed tool", () => {
    const r = new ToolRegistry();
    expect(() => r.register(makeReadOnlyTool())).not.toThrow();
    expect(r.list().map((t) => t.name)).toEqual(["search"]);
  });

  it("rejects duplicate names", () => {
    const r = new ToolRegistry();
    r.register(makeReadOnlyTool());
    expect(() => r.register(makeReadOnlyTool())).toThrow(/already registered/);
  });

  it("rejects names that violate the slug regex", () => {
    const r = new ToolRegistry();
    const bad: ToolDefinition = {
      name: "bad name with spaces",
      description: "x",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    };
    expect(() => r.register(bad)).toThrow(/must match/);
  });

  it("rejects empty names", () => {
    const r = new ToolRegistry();
    const bad: ToolDefinition = {
      name: "",
      description: "x",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    };
    expect(() => r.register(bad)).toThrow(/must match/);
  });

  it("returns the tools in alphabetical order from list()", () => {
    const r = new ToolRegistry();
    r.register({
      name: "zebra",
      description: "z",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    });
    r.register({
      name: "alpha",
      description: "a",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    });
    expect(r.list().map((t) => t.name)).toEqual(["alpha", "zebra"]);
  });
});

describe("ToolRegistry.call — dispatch + tier policy", () => {
  it("dispatches a Tier-1 tool inline and returns ok with timing", async () => {
    const r = new ToolRegistry();
    r.register(makeReadOnlyTool());
    const result = await r.call("search", { q: "hello" }, STD_CTX);
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.output).toEqual({ hits: 5 });
      expect(typeof result.ms).toBe("number");
      expect(result.ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns unknown-tool when the slug isn't registered", async () => {
    const r = new ToolRegistry();
    const result = await r.call("ghost", { q: "x" }, STD_CTX);
    expect(result.outcome).toBe("unknown-tool");
  });

  it("returns input-invalid (not ok) when args fail validation", async () => {
    const r = new ToolRegistry();
    r.register(makeReadOnlyTool());
    const longQ = "x".repeat(1000);
    const result = await r.call("search", { q: longQ }, STD_CTX);
    expect(result.outcome).toBe("input-invalid");
    if (result.outcome === "input-invalid") {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].path).toBe("q");
    }
  });

  it("returns input-invalid when required args are missing", async () => {
    const r = new ToolRegistry();
    r.register(makeReadOnlyTool());
    const result = await r.call("search", {}, STD_CTX);
    expect(result.outcome).toBe("input-invalid");
  });

  it("wraps thrown errors from execute() as execution-failed", async () => {
    const r = new ToolRegistry();
    r.register({
      name: "exploding",
      description: "Always throws.",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => {
        throw new Error("kaboom");
      },
    });
    const result = await r.call("exploding", {}, STD_CTX);
    expect(result.outcome).toBe("execution-failed");
    if (result.outcome === "execution-failed") {
      expect(result.message).toBe("kaboom");
    }
  });

  it("returns requires-confirmation for Tier-2 without an approvalToken", async () => {
    const r = new ToolRegistry();
    r.register(makeWriteTool());
    const result = await r.call(
      "send_email",
      { to: "a@b.com", body: "hi" },
      STD_CTX,
    );
    expect(result.outcome).toBe("requires-confirmation");
    if (result.outcome === "requires-confirmation") {
      expect(result.tier).toBe(2);
      expect(result.preview).toEqual({ to: "a@b.com", body: "hi" });
    }
  });

  it("dispatches Tier-2 when an approvalToken is supplied", async () => {
    const r = new ToolRegistry();
    r.register(makeWriteTool());
    const result = await r.call(
      "send_email",
      { to: "a@b.com", body: "hi" },
      { ...STD_CTX, approvalToken: "confirm-xyz" },
    );
    expect(result.outcome).toBe("ok");
  });

  it("returns restricted for Tier-3 when user is not on admin allowlist", async () => {
    const r = new ToolRegistry();
    r.register(makeAdminTool());
    const result = await r.call(
      "delete_resource",
      { id: "5a1f7c1f-9d4b-4c0a-8e7c-2f3d4e5b6a7c" },
      STD_CTX,
    );
    expect(result.outcome).toBe("restricted");
    if (result.outcome === "restricted") {
      expect(result.tier).toBe(3);
      expect(result.reason).toContain("admin");
    }
  });

  it("dispatches Tier-3 when user is on admin allowlist", async () => {
    const r = new ToolRegistry();
    r.register(makeAdminTool()).grantAdmin("admin-1");
    const result = await r.call(
      "delete_resource",
      { id: "5a1f7c1f-9d4b-4c0a-8e7c-2f3d4e5b6a7c" },
      { ...STD_CTX, userId: "admin-1" },
    );
    expect(result.outcome).toBe("ok");
  });

  it("admin allowlist check comes BEFORE input validation", async () => {
    const r = new ToolRegistry();
    r.register(makeAdminTool());
    const result = await r.call(
      "delete_resource",
      { id: "not-a-uuid" },
      STD_CTX,
    );
    expect(result.outcome).toBe("restricted");
  });

  it("passes the identity context through to execute()", async () => {
    const spy = vi.fn(async (_input: unknown, ctx: ToolContext) => ({
      sawTenant: ctx.tenantId,
      sawUser: ctx.userId,
      sawAgent: ctx.agentSlug,
    }));
    const r = new ToolRegistry();
    r.register({
      name: "echo_ctx",
      description: "Echo identity for testing.",
      inputSchema: z.object({}),
      tier: 1,
      execute: spy,
    });
    const result = await r.call("echo_ctx", {}, STD_CTX);
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.output).toEqual({
        sawTenant: "tenant-1",
        sawUser: "user-1",
        sawAgent: "test-agent",
      });
    }
  });

  it("returns a JSON-serializable result for every outcome (receipt contract)", async () => {
    const r = new ToolRegistry();
    r.register(makeReadOnlyTool());
    r.register(makeWriteTool());
    r.register(makeAdminTool());

    const okResult = await r.call("search", { q: "x" }, STD_CTX);
    const invalidResult = await r.call("search", { q: "" }, STD_CTX);
    const confirmResult = await r.call(
      "send_email",
      { to: "a@b.com", body: "hi" },
      STD_CTX,
    );
    const restrictedResult = await r.call(
      "delete_resource",
      { id: "5a1f7c1f-9d4b-4c0a-8e7c-2f3d4e5b6a7c" },
      STD_CTX,
    );
    const unknownResult = await r.call("ghost", {}, STD_CTX);

    for (const r2 of [
      okResult,
      invalidResult,
      confirmResult,
      restrictedResult,
      unknownResult,
    ]) {
      const round = JSON.parse(JSON.stringify(r2));
      expect(round).toEqual(r2);
    }
  });
});

describe("describeToolForModel", () => {
  it("produces a single-tool description block with tier annotation", () => {
    const out = describeToolForModel(makeReadOnlyTool());
    expect(out).toContain("- search");
    expect(out).toContain("[tier 1]");
    expect(out).toContain("Search a public index");
    expect(out).toContain("q");
  });

  it("handles tools with no shape (z.object({}) edge case)", () => {
    const def: ToolDefinition = {
      name: "ping",
      description: "Health check.",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({ ok: true }),
    };
    const out = describeToolForModel(def);
    expect(out).toContain("- ping");
    expect(out).toContain("[tier 1]");
  });
});

describe("ToolRegistry.describeForModel", () => {
  it("returns a placeholder string when no tools are registered", () => {
    const r = new ToolRegistry();
    expect(r.describeForModel()).toBe("No tools available.");
  });

  it("emits an alphabetically-sorted tool list (prompt-cache stability)", () => {
    const r = new ToolRegistry();
    r.register({
      name: "zebra",
      description: "z",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    });
    r.register({
      name: "alpha",
      description: "a",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => ({}),
    });
    const out = r.describeForModel();
    expect(out.indexOf("alpha")).toBeLessThan(out.indexOf("zebra"));
  });
});

describe("parseToolCallOutput", () => {
  it("parses a clean tool-call envelope", () => {
    const raw = JSON.stringify({
      toolCalls: [{ name: "search", args: { q: "hello" } }],
    });
    const parsed = parseToolCallOutput(raw);
    expect(parsed?.toolCalls).toHaveLength(1);
    expect(parsed?.toolCalls[0].name).toBe("search");
  });

  it("strips code fences before parsing", () => {
    const raw = '```json\n{"toolCalls":[{"name":"search","args":{}}]}\n```';
    const parsed = parseToolCallOutput(raw);
    expect(parsed?.toolCalls[0].name).toBe("search");
  });

  it("accepts a finalAnswer alongside zero tool calls (terminal turn)", () => {
    const raw = JSON.stringify({
      toolCalls: [],
      finalAnswer: "Paris.",
    });
    const parsed = parseToolCallOutput(raw);
    expect(parsed?.finalAnswer).toBe("Paris.");
    expect(parsed?.toolCalls).toEqual([]);
  });

  it("returns null when the output isn't a tool-call envelope", () => {
    expect(parseToolCallOutput("Just a plain answer.")).toBeNull();
    expect(parseToolCallOutput("")).toBeNull();
  });

  it("returns null when the JSON parses but the shape is wrong", () => {
    expect(parseToolCallOutput('{"wrongKey":1}')).toBeNull();
  });

  it("caps the number of tool calls per turn at 10 (DoS guard)", () => {
    const tooMany = Array.from({ length: 100 }, () => ({
      name: "search",
      args: { q: "x" },
    }));
    const raw = JSON.stringify({ toolCalls: tooMany });
    expect(parseToolCallOutput(raw)).toBeNull();
  });
});

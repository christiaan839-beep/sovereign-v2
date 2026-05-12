/**
 * Tests for src/lib/tool-registry.ts — Cook 36 typed function calling.
 *
 * Contracts under test:
 *
 *   - Registration: duplicate name throws; name pattern enforced.
 *   - describeForModel(): stable alphabetical ordering, includes every tool.
 *   - call() dispatch outcomes:
 *       - unknown-tool   when name isn't registered
 *       - input-invalid  when args fail the Zod schema (with messages)
 *       - requires-confirmation  for Tier 2 without approvalToken
 *       - restricted  for Tier 3 without admin grant
 *       - ok          on happy path
 *       - error       when execute() throws
 *   - Tier-3 admin gate runs BEFORE input validation
 *     (non-admin can't fingerprint via bad args).
 *   - Tool results are JSON-serializable (receipt-friendly).
 *   - parseToolCallOutput():
 *       - code-fence stripping (```json ... ```)
 *       - 10-call DoS cap
 *       - non-JSON returns null instead of throwing
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  parseToolCallOutput,
  MAX_TOOL_CALLS_PER_STEP,
  type ToolContext,
  type ToolDefinition,
} from "../tool-registry";

const CTX: ToolContext = {
  userId: "user-1",
  tenantId: "tenant-1",
  agentSlug: "test",
};

function makeT1(name = "ping"): ToolDefinition<{ msg: string }, { ok: true }> {
  return {
    name,
    description: "Test tier-1 tool",
    inputSchema: z.object({ msg: z.string().min(1) }),
    tier: 1,
    execute: async () => ({ ok: true }),
  };
}

describe("ToolRegistry — registration", () => {
  it("registers tools and lists them alphabetically", () => {
    const r = new ToolRegistry();
    r.register(makeT1("zulu"));
    r.register(makeT1("alpha"));
    r.register(makeT1("mike"));
    expect(r.list()).toEqual(["alpha", "mike", "zulu"]);
  });

  it("throws on duplicate registration", () => {
    const r = new ToolRegistry();
    r.register(makeT1("dup"));
    expect(() => r.register(makeT1("dup"))).toThrow(/already registered/);
  });

  it("rejects names that violate the snake_case regex", () => {
    const r = new ToolRegistry();
    expect(() => r.register(makeT1("BadName"))).toThrow(/must match/);
    expect(() => r.register(makeT1("0starts-digit"))).toThrow(/must match/);
    expect(() => r.register(makeT1("with space"))).toThrow(/must match/);
  });

  it("get() returns undefined for unknown names", () => {
    const r = new ToolRegistry();
    expect(r.get("nope")).toBeUndefined();
  });
});

describe("ToolRegistry — describeForModel", () => {
  it("emits a stable, alphabetically-sorted tool list block", () => {
    const r = new ToolRegistry();
    r.register(makeT1("beta"));
    r.register(makeT1("alpha"));
    const desc = r.describeForModel();
    expect(desc).toContain("─── TOOL USE ───");
    expect(desc).toContain("toolCalls");
    expect(desc).toContain("finalAnswer");
    expect(desc.indexOf("alpha")).toBeLessThan(desc.indexOf("beta"));
  });

  it("emits a sane placeholder when no tools are registered", () => {
    const r = new ToolRegistry();
    expect(r.describeForModel()).toContain("no tools registered");
  });
});

describe("ToolRegistry — dispatch", () => {
  it("returns unknown-tool when the name isn't registered", async () => {
    const r = new ToolRegistry();
    const result = await r.call("missing", {}, CTX);
    expect(result.outcome).toBe("unknown-tool");
    if (result.outcome === "unknown-tool") {
      expect(result.tool).toBe("missing");
    }
  });

  it("returns input-invalid with structured issues when args fail validation", async () => {
    const r = new ToolRegistry().register(makeT1("ping"));
    const result = await r.call("ping", { msg: "" }, CTX);
    expect(result.outcome).toBe("input-invalid");
    if (result.outcome === "input-invalid") {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns ok with the tool's output on the happy path", async () => {
    const r = new ToolRegistry().register(makeT1("ping"));
    const result = await r.call("ping", { msg: "hi" }, CTX);
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.output).toEqual({ ok: true });
    }
  });

  it("returns error when execute() throws", async () => {
    const r = new ToolRegistry();
    r.register({
      name: "bomb",
      description: "Throws.",
      inputSchema: z.object({}),
      tier: 1,
      execute: async () => {
        throw new Error("kaboom");
      },
    });
    const result = await r.call("bomb", {}, CTX);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.message).toContain("kaboom");
    }
  });
});

describe("ToolRegistry — Tier 2 (requires-confirmation)", () => {
  it("returns requires-confirmation when approvalToken is missing", async () => {
    const r = new ToolRegistry();
    r.register({
      name: "save",
      description: "Save something.",
      inputSchema: z.object({ x: z.string() }),
      tier: 2,
      execute: async () => ({ saved: true }),
    });
    const result = await r.call("save", { x: "ok" }, CTX);
    expect(result.outcome).toBe("requires-confirmation");
  });

  it("dispatches when approvalToken is present", async () => {
    const r = new ToolRegistry();
    r.register({
      name: "save",
      description: "Save something.",
      inputSchema: z.object({ x: z.string() }),
      tier: 2,
      execute: async () => ({ saved: true }),
    });
    const result = await r.call(
      "save",
      { x: "ok" },
      { ...CTX, approvalToken: "tok-123" },
    );
    expect(result.outcome).toBe("ok");
  });
});

describe("ToolRegistry — Tier 3 admin gate", () => {
  it("returns restricted when the caller is not in the admin set", async () => {
    const r = new ToolRegistry();
    r.register({
      name: "nuke",
      description: "Nukes things.",
      inputSchema: z.object({ confirm: z.literal("YES") }),
      tier: 3,
      execute: async () => ({ nuked: true }),
    });
    const result = await r.call("nuke", { confirm: "YES" }, CTX);
    expect(result.outcome).toBe("restricted");
    if (result.outcome === "restricted") {
      expect(result.tier).toBe(3);
    }
  });

  it("runs the admin gate BEFORE input validation (anti-fingerprint)", async () => {
    const execute = vi.fn();
    const r = new ToolRegistry();
    r.register({
      name: "nuke",
      description: "Nukes things.",
      inputSchema: z.object({ confirm: z.literal("YES") }),
      tier: 3,
      execute,
    });
    // Non-admin with malformed args MUST receive restricted (not
    // input-invalid) — otherwise the error message leaks the schema.
    const result = await r.call("nuke", { confirm: "bogus" }, CTX);
    expect(result.outcome).toBe("restricted");
    expect(execute).not.toHaveBeenCalled();
  });

  it("dispatches when admin is granted", async () => {
    const r = new ToolRegistry().grantAdmin("admin-1");
    r.register({
      name: "nuke",
      description: "Nukes things.",
      inputSchema: z.object({ confirm: z.literal("YES") }),
      tier: 3,
      execute: async () => ({ nuked: true }),
    });
    const result = await r.call(
      "nuke",
      { confirm: "YES" },
      { ...CTX, userId: "admin-1" },
    );
    expect(result.outcome).toBe("ok");
  });
});

describe("ToolRegistry — JSON serializability of results", () => {
  it("every result variant round-trips through JSON.stringify", async () => {
    const r = new ToolRegistry().register(makeT1("ping"));
    const variants = [
      await r.call("unknown", {}, CTX),
      await r.call("ping", { msg: "" }, CTX),
      await r.call("ping", { msg: "hi" }, CTX),
    ];
    for (const v of variants) {
      expect(() => JSON.parse(JSON.stringify(v))).not.toThrow();
    }
  });
});

describe("parseToolCallOutput", () => {
  it("parses a plain JSON envelope", () => {
    const out = parseToolCallOutput(
      '{"toolCalls":[{"name":"a","args":{}}],"finalAnswer":"hi"}',
    );
    expect(out).not.toBeNull();
    expect(out?.toolCalls.length).toBe(1);
    expect(out?.finalAnswer).toBe("hi");
  });

  it("strips ```json code fences", () => {
    const out = parseToolCallOutput(
      '```json\n{"toolCalls":[],"finalAnswer":"done"}\n```',
    );
    expect(out?.finalAnswer).toBe("done");
  });

  it("returns null on non-JSON / unparseable output", () => {
    expect(parseToolCallOutput("just text")).toBeNull();
    expect(parseToolCallOutput("{not json")).toBeNull();
    expect(parseToolCallOutput("[]")).toBeNull(); // not an object
  });

  it("rejects envelopes exceeding the per-step tool-call cap", () => {
    const tooMany = {
      toolCalls: Array(MAX_TOOL_CALLS_PER_STEP + 1).fill({
        name: "a",
        args: {},
      }),
    };
    expect(parseToolCallOutput(JSON.stringify(tooMany))).toBeNull();
  });
});

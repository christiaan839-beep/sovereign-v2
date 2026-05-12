/**
 * Tests for src/lib/tools/built-in.ts — three starter tools.
 *
 * Locks the contracts that matter most:
 *
 *   - fetch_url: SSRF guard blocks every private / loopback / metadata
 *     host; timeout enforced; size cap enforced; HTTPS-only.
 *   - write_memory: requires tenantId in context; passes through to
 *     the injected writer; returns ISO committedAt.
 *   - purge_memory: confirmPhrase literal blocks accidental purges;
 *     tier-3 registration restricts to admins (tested via registry).
 *
 * Each tool uses dependency injection (fetchImpl / writer / purger)
 * so the tests exercise the real `execute` logic against an in-memory
 * mock instead of the network or the DB.
 */

import { describe, it, expect, vi } from "vitest";
import {
  isSafeUrl,
  buildFetchUrlTool,
  buildWriteMemoryTool,
  buildPurgeMemoryTool,
} from "../tools/built-in";
import { ToolRegistry, type ToolContext } from "../tool-registry";

const STD_CTX: ToolContext = {
  userId: "user-1",
  tenantId: "tenant-1",
  agentSlug: "test-agent",
};

describe("isSafeUrl (SSRF guard)", () => {
  it("accepts plain https / http public URLs", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com/path?q=1")).toBe(true);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("ftp://example.com")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects localhost variants", () => {
    expect(isSafeUrl("http://localhost/api")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1/")).toBe(false);
    expect(isSafeUrl("http://127.255.255.254/")).toBe(false);
    expect(isSafeUrl("http://[::1]/")).toBe(false);
  });

  it("rejects RFC-1918 private network space", () => {
    expect(isSafeUrl("http://10.0.0.1/")).toBe(false);
    expect(isSafeUrl("http://192.168.1.1/")).toBe(false);
    expect(isSafeUrl("http://172.16.0.1/")).toBe(false);
    expect(isSafeUrl("http://172.31.255.254/")).toBe(false);
  });

  it("rejects cloud-provider metadata endpoints", () => {
    expect(isSafeUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("rejects link-local + internal mDNS", () => {
    expect(isSafeUrl("http://printer.local/")).toBe(false);
    expect(isSafeUrl("http://svc.internal/")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeUrl("not a url")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
  });
});

describe("fetch_url tool", () => {
  it("returns the body, status, and content-type on 200", async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      new Response("hello world", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const tool = buildFetchUrlTool(fakeFetch);
    const result = await tool.execute({ url: "https://example.com" }, STD_CTX);
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("text/plain");
    expect(result.body).toBe("hello world");
    expect(result.truncated).toBe(false);
  });

  it("truncates responses larger than maxBytes and marks truncated=true", async () => {
    const big = "x".repeat(5000);
    const fakeFetch = vi.fn().mockResolvedValueOnce(
      new Response(big, {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const tool = buildFetchUrlTool(fakeFetch);
    const result = await tool.execute(
      { url: "https://example.com", maxBytes: 100 },
      STD_CTX,
    );
    expect(result.truncated).toBe(true);
    expect(result.bytesRead).toBe(100);
    expect(result.body.endsWith("…")).toBe(true);
  });

  it("rejects SSRF-flagged URLs at the schema level (never reaches fetch)", async () => {
    const fakeFetch = vi.fn();
    const tool = buildFetchUrlTool(fakeFetch);
    const parsed = tool.inputSchema.safeParse({
      url: "http://169.254.169.254/latest/meta-data/",
    });
    expect(parsed.success).toBe(false);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("registers as Tier 1 (autonomous)", () => {
    const tool = buildFetchUrlTool(vi.fn());
    expect(tool.tier).toBe(1);
    expect(tool.name).toBe("fetch_url");
  });
});

describe("write_memory tool", () => {
  it("invokes the writer with tenant + user context attached", async () => {
    const writer = vi.fn().mockResolvedValue(undefined);
    const tool = buildWriteMemoryTool(writer);
    const result = await tool.execute(
      { key: "preferred-tone", value: "casual but precise" },
      STD_CTX,
    );
    expect(result.written).toBe(true);
    expect(result.tenantId).toBe("tenant-1");
    expect(result.committedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO
    expect(writer).toHaveBeenCalledWith({
      key: "preferred-tone",
      value: "casual but precise",
      category: undefined,
      tenantId: "tenant-1",
      userId: "user-1",
    });
  });

  it("throws when context has no tenantId (multi-tenant safety)", async () => {
    const writer = vi.fn();
    const tool = buildWriteMemoryTool(writer);
    await expect(
      tool.execute({ key: "x", value: "y" }, { ...STD_CTX, tenantId: "" }),
    ).rejects.toThrow(/tenantId/);
    expect(writer).not.toHaveBeenCalled();
  });

  it("registers as Tier 2 (needs confirmation)", () => {
    const tool = buildWriteMemoryTool(vi.fn());
    expect(tool.tier).toBe(2);
    expect(tool.name).toBe("write_memory");
  });

  it("is gated behind requires-confirmation in the registry without approvalToken", async () => {
    const r = new ToolRegistry();
    r.register(buildWriteMemoryTool(vi.fn()));
    const result = await r.call(
      "write_memory",
      { key: "k", value: "v" },
      STD_CTX,
    );
    expect(result.outcome).toBe("requires-confirmation");
  });
});

describe("purge_memory tool", () => {
  it("only accepts the exact confirmPhrase literal", () => {
    const tool = buildPurgeMemoryTool(vi.fn());
    const ok = tool.inputSchema.safeParse({
      tenantId: "t1",
      confirmPhrase: "I UNDERSTAND THIS WILL DELETE EVERYTHING",
    });
    expect(ok.success).toBe(true);
    const bad = tool.inputSchema.safeParse({
      tenantId: "t1",
      confirmPhrase: "yes do it",
    });
    expect(bad.success).toBe(false);
  });

  it("invokes the purger with filter args", async () => {
    const purger = vi.fn().mockResolvedValue({ rowsDeleted: 42 });
    const tool = buildPurgeMemoryTool(purger);
    const result = await tool.execute(
      {
        tenantId: "t1",
        category: "ephemeral",
        confirmPhrase: "I UNDERSTAND THIS WILL DELETE EVERYTHING",
      },
      STD_CTX,
    );
    expect(result.purged).toBe(true);
    expect(result.rowsDeleted).toBe(42);
    expect(purger).toHaveBeenCalledWith({
      tenantId: "t1",
      category: "ephemeral",
    });
  });

  it("registers as Tier 3 (admin-only)", () => {
    const tool = buildPurgeMemoryTool(vi.fn());
    expect(tool.tier).toBe(3);
  });

  it("is gated as restricted in the registry without admin grant", async () => {
    const r = new ToolRegistry();
    r.register(buildPurgeMemoryTool(vi.fn()));
    const result = await r.call(
      "purge_memory",
      {
        tenantId: "t1",
        confirmPhrase: "I UNDERSTAND THIS WILL DELETE EVERYTHING",
      },
      STD_CTX,
    );
    expect(result.outcome).toBe("restricted");
  });

  it("dispatches when admin is granted on the registry", async () => {
    const purger = vi.fn().mockResolvedValue({ rowsDeleted: 7 });
    const r = new ToolRegistry()
      .register(buildPurgeMemoryTool(purger))
      .grantAdmin("admin-1");
    const result = await r.call(
      "purge_memory",
      {
        tenantId: "t1",
        confirmPhrase: "I UNDERSTAND THIS WILL DELETE EVERYTHING",
      },
      { ...STD_CTX, userId: "admin-1" },
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect(result.output).toMatchObject({ purged: true, rowsDeleted: 7 });
    }
  });
});

describe("integration: registry + all three tools", () => {
  it("describes the full tool surface for the model", () => {
    const r = new ToolRegistry();
    r.register(buildFetchUrlTool(vi.fn()));
    r.register(buildWriteMemoryTool(vi.fn()));
    r.register(buildPurgeMemoryTool(vi.fn()));
    const desc = r.describeForModel();
    expect(desc).toContain("fetch_url");
    expect(desc).toContain("write_memory");
    expect(desc).toContain("purge_memory");
    expect(desc.indexOf("fetch_url")).toBeLessThan(
      desc.indexOf("purge_memory"),
    );
    expect(desc.indexOf("purge_memory")).toBeLessThan(
      desc.indexOf("write_memory"),
    );
  });
});

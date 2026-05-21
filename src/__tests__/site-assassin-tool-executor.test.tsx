/**
 * Wave-113 site-assassin tool executor tests.
 *
 * Mirrors the wave-110 competitor-scan test file: exercises the
 * tool executor in isolation by calling it the same way
 * claudeToolUse would. The executor MUST NOT throw — Claude reads
 * the error string from the tool result and decides how to recover.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  searchMemoryMock,
  storeMemoryMock,
  outboundFetchMock,
  nimChatMock,
  dnsLookupMock,
  resolvedHostIsSafeMock,
  claudeToolUseMock,
  researchAiMock,
} = vi.hoisted(() => ({
  searchMemoryMock: vi.fn(),
  storeMemoryMock: vi.fn(),
  outboundFetchMock: vi.fn(),
  nimChatMock: vi.fn(),
  dnsLookupMock: vi.fn(),
  resolvedHostIsSafeMock: vi.fn(),
  claudeToolUseMock: vi.fn(),
  researchAiMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("@/lib/vector-memory", () => ({
  searchMemory: searchMemoryMock,
  storeMemory: storeMemoryMock,
}));
vi.mock("@/lib/ai", () => ({
  research_ai: researchAiMock,
  claudeToolUse: claudeToolUseMock,
}));
vi.mock("@/lib/nvidia", () => ({
  nimChat: nimChatMock,
}));
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetch: outboundFetchMock,
}));
vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));
vi.mock("@/lib/safe-host", () => ({
  resolvedHostIsSafe: resolvedHostIsSafeMock,
}));
vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (config: unknown) => config,
}));

import {
  buildToolExecutor,
  POST as siteAssassinConfig,
  type SiteAssassinContext,
} from "@/app/api/_agents/site-assassin/route";

// createAgentRoute is mocked to return its config object, so the
// exported POST is actually the config — its `.handler` is the inner
// async function we want to test for response shape.
const handler = (
  siteAssassinConfig as unknown as {
    handler: (args: {
      input: Record<string, unknown>;
      userId: string;
      pastContextAsPrompt: () => string;
    }) => Promise<Record<string, unknown>>;
  }
).handler;

function freshCtx(): SiteAssassinContext {
  return {
    userId: "user-test",
    target: "https://example.com",
    report: null,
    trace: [],
  };
}

beforeEach(() => {
  searchMemoryMock.mockReset();
  storeMemoryMock.mockReset();
  outboundFetchMock.mockReset();
  nimChatMock.mockReset();
  dnsLookupMock.mockReset();
  resolvedHostIsSafeMock.mockReset();
  claudeToolUseMock.mockReset();
  researchAiMock.mockReset();
  dnsLookupMock.mockResolvedValue({ address: "93.184.216.34", family: 4 });
  resolvedHostIsSafeMock.mockReturnValue(true);
});

describe("buildToolExecutor — search_past_audits", () => {
  it("returns 'no prior audits' when memory is empty", async () => {
    searchMemoryMock.mockResolvedValueOnce([]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_audits", { query: "homepage" });
    expect(searchMemoryMock).toHaveBeenCalledWith("user-test", "homepage", 2);
    expect(result).toContain("No prior audits");
  });

  it("formats hits with defensive markers (wave-110.1 H1 pattern)", async () => {
    searchMemoryMock.mockResolvedValueOnce([
      {
        content: "Mobile CTA below fold (CRITICAL)",
        agentName: "site-assassin",
        similarity: 0.78,
        createdAt: "2026-05-15T00:00:00Z",
      },
    ]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_audits", { query: "mobile" });
    expect(result).toContain("<past_audit");
    expect(result).toContain('untrusted="true"');
    expect(result).toContain("Mobile CTA below fold");
    expect(result).toContain("</past_audit>");
  });

  it("anon userId skips entirely (cross-tenant defense)", async () => {
    const ctx = { ...freshCtx(), userId: "anon" };
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_audits", { query: "x" });
    expect(result).toContain("Memory disabled");
    expect(searchMemoryMock).not.toHaveBeenCalled();
  });
});

describe("buildToolExecutor — fetch_page", () => {
  it("rejects non-https URLs", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "http://example.com" });
    expect(result).toContain("ERROR");
    expect(result).toContain("https://");
  });

  it("rejects URLs whose DNS resolves to a private IP (wave-107.2)", async () => {
    dnsLookupMock.mockResolvedValueOnce({ address: "10.0.0.5", family: 4 });
    resolvedHostIsSafeMock.mockReturnValueOnce(false);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", {
      url: "https://evil.example.com",
    });
    expect(result).toContain("ERROR");
    expect(result).toContain("private");
    expect(outboundFetchMock).not.toHaveBeenCalled();
  });

  it("strips HTML and caps to 6000 chars", async () => {
    outboundFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: "<html><script>x()</script><body><h1>Hero</h1><p>Buy now</p></body></html>",
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).not.toContain("<");
    expect(result).not.toContain("script");
    expect(result).toContain("Hero");
  });

  it("returns error string on non-2xx", async () => {
    outboundFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      body: "",
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).toContain("ERROR");
    expect(result).toContain("404");
  });

  it("catches outboundFetch throws without bubbling", async () => {
    outboundFetchMock.mockRejectedValueOnce(new Error("network down"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).toContain("ERROR");
    expect(result).toContain("network down");
  });
});

describe("buildToolExecutor — run_ux_analysis", () => {
  it("rejects empty content", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("run_ux_analysis", {
      content: "",
      target_url: "https://example.com",
    });
    expect(result).toContain("ERROR");
    expect(result).toContain("non-trivial");
  });

  it("calls nimChat and returns the analysis (capped)", async () => {
    nimChatMock.mockResolvedValueOnce(
      JSON.stringify({ ux_score: 60, weaknesses: [] }),
    );
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("run_ux_analysis", {
      content:
        "Hero section with prominent CTA. Pricing tiers below. Testimonials section. About us text. Footer with social links. " +
        "Multiple H1 tags detected. Mobile viewport meta tag present. Form fields use placeholder-only labels.",
      target_url: "https://example.com",
    });
    expect(nimChatMock).toHaveBeenCalled();
    expect(result).toContain("ux_score");
  });

  it("returns error string on nimChat throw (no propagation)", async () => {
    nimChatMock.mockRejectedValueOnce(new Error("NIM down"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("run_ux_analysis", {
      content:
        "Hero section with prominent CTA. Pricing tiers below. Testimonials section. About us text. Footer with social links. " +
        "Multiple H1 tags detected. Mobile viewport meta tag present. Form fields use placeholder-only labels.",
      target_url: "https://example.com",
    });
    expect(result).toContain("ERROR");
    expect(result).toContain("NIM down");
  });
});

describe("buildToolExecutor — store_finding", () => {
  it("writes a finding to vector memory", async () => {
    storeMemoryMock.mockResolvedValueOnce(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", {
      finding: "Mobile CTA buried below fold",
      severity: "CRITICAL",
    });
    expect(storeMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "site-assassin",
      "[CRITICAL] Mobile CTA buried below fold",
      expect.objectContaining({
        target: "https://example.com",
        severity: "CRITICAL",
        kind: "site-assassin-finding",
      }),
    );
    expect(result).toContain("stored");
  });

  it("rejects empty findings", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", {
      finding: "  ",
      severity: "MEDIUM",
    });
    expect(result).toContain("ERROR");
    expect(storeMemoryMock).not.toHaveBeenCalled();
  });

  it("skips write entirely for anon userId", async () => {
    const ctx = { ...freshCtx(), userId: "anon" };
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", { finding: "x" });
    expect(result).toContain("NOT stored");
    expect(storeMemoryMock).not.toHaveBeenCalled();
  });
});

describe("buildToolExecutor — finalize_audit", () => {
  it("mutates ctx.report with the structured audit", async () => {
    const ctx = freshCtx();
    expect(ctx.report).toBeNull();
    const exec = buildToolExecutor(ctx);
    const result = await exec("finalize_audit", {
      ux_score: 72,
      weaknesses: [
        { issue: "CTA buried", severity: "HIGH", fix: "Move above fold" },
      ],
      conversion_killers: ["Long form"],
      speed_estimate: "medium",
      mobile_score: 55,
      overall_verdict: "Conversion-blocked by mobile UX flaws.",
    });
    expect(ctx.report).not.toBeNull();
    expect(ctx.report?.ux_score).toBe(72);
    expect(ctx.report?.weaknesses).toHaveLength(1);
    expect(ctx.report?.mobile_score).toBe(55);
    expect(result).toContain("End the loop");
  });

  it("coerces missing array fields safely", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_audit", {
      ux_score: 50,
      speed_estimate: "fast",
      mobile_score: 80,
      overall_verdict: "OK",
    });
    expect(ctx.report?.weaknesses).toEqual([]);
    expect(ctx.report?.conversion_killers).toEqual([]);
  });
});

describe("buildToolExecutor — unknown tool + trace bookkeeping", () => {
  it("returns error string on unknown tool name (no throw)", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("not_a_real_tool", {});
    expect(result).toContain("unknown tool");
    expect(ctx.trace[0].output).toContain("unknown tool");
  });

  it("appends every tool call to ctx.trace with capped output", async () => {
    searchMemoryMock.mockResolvedValueOnce([]);
    storeMemoryMock.mockResolvedValueOnce(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("search_past_audits", { query: "x" });
    await exec("store_finding", {
      finding: "y".repeat(1000),
      severity: "LOW",
    });
    expect(ctx.trace).toHaveLength(2);
    expect(ctx.trace[1].output.length).toBeLessThanOrEqual(400);
  });

  it("caps trace at 50 entries (wave-113.1 L1 — unbounded-trace fix)", async () => {
    searchMemoryMock.mockResolvedValue([]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    for (let i = 0; i < 60; i++) {
      await exec("search_past_audits", { query: `q${i}` });
    }
    expect(ctx.trace.length).toBeLessThanOrEqual(50);
  });
});

// ── Wave-113.1 M1 fix: handler response shape ────────────────────────────
//
// The handler must NEVER return `success: true` when the tool-use loop
// failed or the audit had to be synthesized. Consumers (UI badges,
// downstream jobs, billing) rely on `success` to mean "real result".
describe("site-assassin handler — wave-113.1 success/degraded contract", () => {
  it("returns success=true, degraded=false when finalize_audit fires", async () => {
    claudeToolUseMock.mockImplementationOnce(
      async (
        _p,
        _t,
        _s,
        _max,
        exec: (n: string, i: Record<string, unknown>) => Promise<string>,
      ) => {
        await exec("finalize_audit", {
          ux_score: 72,
          weaknesses: [
            { issue: "buried CTA", severity: "HIGH", fix: "move it" },
          ],
          conversion_killers: ["long form"],
          speed_estimate: "medium",
          mobile_score: 55,
          overall_verdict: "needs work",
        });
        return "done";
      },
    );
    const res = await handler({
      input: { url: "https://example.com", mode: "analyze" },
      userId: "user-1",
      pastContextAsPrompt: () => "",
    });
    expect(res.success).toBe(true);
    expect(res.degraded).toBe(false);
    expect(res.error).toBeUndefined();
    expect((res.audit as { ux_score: number }).ux_score).toBe(72);
  });

  it("returns success=false, degraded=true when claudeToolUse throws", async () => {
    claudeToolUseMock.mockRejectedValueOnce(new Error("kill-switch tripped"));
    const res = await handler({
      input: { url: "https://example.com", mode: "analyze" },
      userId: "user-1",
      pastContextAsPrompt: () => "",
    });
    expect(res.success).toBe(false);
    expect(res.degraded).toBe(true);
    expect(res.error).toContain("kill-switch tripped");
    // Synthesized fallback report still returned so callers don't crash.
    expect((res.audit as { ux_score: number }).ux_score).toBe(0);
  });

  it("returns success=false, degraded=true when finalize_audit never fires", async () => {
    claudeToolUseMock.mockResolvedValueOnce("loop ended without finalize");
    const res = await handler({
      input: { url: "https://example.com", mode: "analyze" },
      userId: "user-1",
      pastContextAsPrompt: () => "",
    });
    expect(res.success).toBe(false);
    expect(res.degraded).toBe(true);
    expect(res.error).toBeUndefined();
    expect((res.audit as { ux_score: number }).ux_score).toBe(0);
  });
});

/**
 * Wave-110 competitor-scan tool executor tests.
 *
 * The agent is now a multi-step claudeToolUse loop. The actual Claude
 * call requires the Anthropic SDK + an API key, so we can't unit-test
 * the full loop here — instead we test the TOOL EXECUTOR in isolation
 * by calling it the same way claudeToolUse would.
 *
 * Each test pins one tool's contract:
 *   - search_past_scans → vector-memory search + result formatting
 *   - web_research      → research_ai pipe-through with graceful errors
 *   - fetch_page        → outboundFetch + HTML stripping + caps
 *   - store_finding     → vector-memory write + validation
 *   - finalize_report   → mutates ctx.report (terminates the loop)
 *
 * The executor MUST NOT throw — Claude reads the error string from
 * the tool result and decides how to recover. A thrown executor
 * would abort the entire claudeToolUse loop, defeating the design.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  searchMemoryMock,
  storeMemoryMock,
  researchAiMock,
  outboundFetchMock,
  dnsLookupMock,
  resolvedHostIsSafeMock,
} = vi.hoisted(() => ({
  searchMemoryMock: vi.fn(),
  storeMemoryMock: vi.fn(),
  researchAiMock: vi.fn(),
  outboundFetchMock: vi.fn(),
  dnsLookupMock: vi.fn(),
  resolvedHostIsSafeMock: vi.fn(),
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
  claudeToolUse: vi.fn(),
}));
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetch: outboundFetchMock,
  scraperUserAgent: () => "Mozilla/5.0 (compatible; SovereignBot/1.0)",
}));
vi.mock("node:dns/promises", () => ({
  lookup: dnsLookupMock,
}));
vi.mock("@/lib/federation-puller", () => ({
  resolvedHostIsSafe: resolvedHostIsSafeMock,
}));
vi.mock("@/lib/agent-factory", () => ({
  // Avoid the full agent-factory pipeline — we just need the
  // exported helpers from the route module.
  createAgentRoute: (config: unknown) => config,
}));

import {
  buildToolExecutor,
  type CompetitorScanContext,
} from "@/app/api/_agents/competitor-scan/route";

function freshCtx(): CompetitorScanContext {
  return {
    userId: "user-test",
    target: "ExampleCorp",
    report: null,
    trace: [],
  };
}

beforeEach(() => {
  searchMemoryMock.mockReset();
  storeMemoryMock.mockReset();
  researchAiMock.mockReset();
  outboundFetchMock.mockReset();
  dnsLookupMock.mockReset();
  resolvedHostIsSafeMock.mockReset();
  // Default DNS+safety mocks: hostname resolves to a public IP that
  // passes the safety check. Individual tests override.
  dnsLookupMock.mockResolvedValue({ address: "93.184.216.34", family: 4 });
  resolvedHostIsSafeMock.mockReturnValue(true);
});

describe("buildToolExecutor — search_past_scans", () => {
  it("returns a 'no prior scans' message when memory is empty", async () => {
    searchMemoryMock.mockResolvedValueOnce([]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_scans", {
      query: "ExampleCorp pricing",
    });
    expect(searchMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "ExampleCorp pricing",
      3,
    );
    expect(result).toContain("No prior scans");
    expect(ctx.trace).toHaveLength(1);
    expect(ctx.trace[0].tool).toBe("search_past_scans");
  });

  it('wraps hits in <past_finding untrusted="true"> markers (wave-110.1 H1 fix)', async () => {
    // The defensive markers tell Claude (via the system prompt) to
    // treat the embedded text as facts, never as instructions. This
    // closes the prompt-injection via memory vector flagged by the
    // wave-110 security review.
    searchMemoryMock.mockResolvedValueOnce([
      {
        content: "ExampleCorp raised pricing 30% in May 2026",
        agentName: "competitor-scan",
        similarity: 0.87,
        createdAt: "2026-05-15T00:00:00Z",
      },
      {
        content: "ExampleCorp lost their enterprise sales lead",
        agentName: "competitor-scan",
        similarity: 0.71,
        createdAt: "2026-05-10T00:00:00Z",
      },
    ]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_scans", { query: "pricing" });
    expect(result).toContain("<past_finding");
    expect(result).toContain('untrusted="true"');
    expect(result).toContain("0.87");
    expect(result).toContain("0.71");
    expect(result).toContain("ExampleCorp raised pricing");
    expect(result).toContain("</past_finding>");
  });

  it("returns 'Memory disabled' on anon userId (wave-110.1 M1)", async () => {
    const ctx = { ...freshCtx(), userId: "anon" };
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_scans", { query: "x" });
    expect(result).toContain("Memory disabled");
    expect(searchMemoryMock).not.toHaveBeenCalled();
  });

  it("returns 'Memory disabled' on empty userId (wave-110.1 M1)", async () => {
    const ctx = { ...freshCtx(), userId: "" };
    const exec = buildToolExecutor(ctx);
    const result = await exec("search_past_scans", { query: "x" });
    expect(result).toContain("Memory disabled");
    expect(searchMemoryMock).not.toHaveBeenCalled();
  });

  it("falls back to ctx.target when query is missing", async () => {
    searchMemoryMock.mockResolvedValueOnce([]);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("search_past_scans", {});
    expect(searchMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "ExampleCorp",
      3,
    );
  });
});

describe("buildToolExecutor — web_research", () => {
  it("returns truncated research output", async () => {
    researchAiMock.mockResolvedValueOnce("a".repeat(10_000));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("web_research", { query: "competitor reviews" });
    expect(researchAiMock).toHaveBeenCalled();
    // Truncated to 6000 chars per the executor contract.
    expect(result.length).toBeLessThanOrEqual(6000);
  });

  it("returns a graceful error string when research_ai throws (does NOT throw)", async () => {
    researchAiMock.mockRejectedValueOnce(new Error("Tavily down"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("web_research", { query: "x" });
    expect(result).toContain("Web research unavailable");
    expect(result).toContain("Tavily down");
  });
});

describe("buildToolExecutor — fetch_page", () => {
  it("rejects non-https URLs", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "http://example.com/x" });
    expect(result).toContain("ERROR");
    expect(result).toContain("https://");
    expect(outboundFetchMock).not.toHaveBeenCalled();
  });

  it("strips HTML tags + scripts and caps to 6000 chars", async () => {
    const html =
      "<html><head><script>alert('xss')</script><style>.x{}</style></head><body><h1>Pricing</h1><p>$99/mo</p></body></html>";
    outboundFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: html,
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).not.toContain("<");
    expect(result).not.toContain("alert");
    expect(result).toContain("Pricing");
    expect(result).toContain("$99/mo");
  });

  it("returns an error string on non-2xx without throwing", async () => {
    outboundFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      body: "",
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).toContain("ERROR");
    expect(result).toContain("403");
  });

  it("catches SSRF / network errors from outboundFetch without throwing", async () => {
    outboundFetchMock.mockRejectedValueOnce(new Error("blocked: RFC1918"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", { url: "https://example.com" });
    expect(result).toContain("ERROR");
    expect(result).toContain("blocked");
  });

  it("Wave-110.1 H2: rejects hostnames that resolve to private IPs (DNS rebinding defense)", async () => {
    // Public-looking hostname that A-records to an RFC1918 address —
    // the classic DNS-rebinding shape. isSafeUrl's string regex
    // can't catch this; the resolved-IP check has to.
    dnsLookupMock.mockResolvedValueOnce({ address: "10.0.0.5", family: 4 });
    resolvedHostIsSafeMock.mockReturnValueOnce(false);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", {
      url: "https://evil.example.com/x",
    });
    expect(result).toContain("ERROR");
    expect(result).toContain("private");
    expect(outboundFetchMock).not.toHaveBeenCalled();
  });

  it("Wave-110.1 H2: rejects when DNS lookup fails (no fail-open)", async () => {
    dnsLookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("fetch_page", {
      url: "https://nonexistent.example",
    });
    expect(result).toContain("ERROR");
    expect(result).toContain("DNS check failed");
    expect(outboundFetchMock).not.toHaveBeenCalled();
  });
});

describe("buildToolExecutor — store_finding", () => {
  it("writes a finding to vector memory and confirms", async () => {
    storeMemoryMock.mockResolvedValueOnce(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", {
      finding: "ExampleCorp moved off monthly billing in May 2026",
      category: "pricing",
    });
    expect(storeMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "competitor-scan",
      "ExampleCorp moved off monthly billing in May 2026",
      { target: "ExampleCorp", category: "pricing" },
    );
    expect(result).toContain("stored");
  });

  it("reports backend unavailability without throwing", async () => {
    storeMemoryMock.mockResolvedValueOnce(false);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", { finding: "x" });
    expect(result).toContain("NOT stored");
  });

  it("rejects empty findings", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", { finding: "  " });
    expect(result).toContain("ERROR");
    expect(storeMemoryMock).not.toHaveBeenCalled();
  });

  it("skips write entirely for anon userId (wave-110.1 M1)", async () => {
    const ctx = { ...freshCtx(), userId: "anon" };
    const exec = buildToolExecutor(ctx);
    const result = await exec("store_finding", { finding: "f" });
    expect(result).toContain("NOT stored");
    expect(result).toContain("anonymous");
    expect(storeMemoryMock).not.toHaveBeenCalled();
  });
});

describe("buildToolExecutor — finalize_report", () => {
  it("mutates ctx.report and instructs the agent to end the loop", async () => {
    const ctx = freshCtx();
    expect(ctx.report).toBeNull();
    const exec = buildToolExecutor(ctx);
    const result = await exec("finalize_report", {
      threat_level: "HIGH",
      data_grounded: true,
      vulnerabilities: ["weak pricing tier"],
      counter_strategies: ["offer free tier"],
      positioning_angles: ["faster setup", "better support", "open source"],
    });
    expect(ctx.report).not.toBeNull();
    expect(ctx.report?.threat_level).toBe("HIGH");
    expect(ctx.report?.vulnerabilities).toEqual(["weak pricing tier"]);
    expect(result).toContain("End the loop");
  });

  it("coerces missing array fields to empty arrays (no crash on bad input)", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_report", {
      threat_level: "LOW",
      data_grounded: false,
      // missing: vulnerabilities, counter_strategies, positioning_angles
    });
    expect(ctx.report?.vulnerabilities).toEqual([]);
    expect(ctx.report?.counter_strategies).toEqual([]);
    expect(ctx.report?.positioning_angles).toEqual([]);
  });
});

describe("buildToolExecutor — unknown tool name", () => {
  it("returns an error string instead of throwing", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const result = await exec("not_a_real_tool", {});
    expect(result).toContain("unknown tool");
    expect(ctx.trace[0].output).toContain("unknown tool");
  });
});

describe("buildToolExecutor — trace bookkeeping", () => {
  it("appends every tool call to ctx.trace with input + summarised output", async () => {
    searchMemoryMock.mockResolvedValueOnce([]);
    storeMemoryMock.mockResolvedValueOnce(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("search_past_scans", { query: "q1" });
    await exec("store_finding", { finding: "f1", category: "pricing" });
    expect(ctx.trace).toHaveLength(2);
    expect(ctx.trace[0].input).toEqual({ query: "q1" });
    expect(ctx.trace[1].input).toEqual({
      finding: "f1",
      category: "pricing",
    });
  });

  it("caps trace output strings at 400 chars to keep payload bounded", async () => {
    researchAiMock.mockResolvedValueOnce("x".repeat(5000));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("web_research", { query: "x" });
    expect(ctx.trace[0].output.length).toBeLessThanOrEqual(400);
  });
});

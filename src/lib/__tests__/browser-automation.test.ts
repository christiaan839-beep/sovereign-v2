/**
 * Tests for src/lib/tools/browser-automation.ts — Cook 61.
 *
 *   - Schema: action discriminated-union enforces shape per kind.
 *   - SSRF-blocked navigate URLs rejected at schema level.
 *   - Action cap enforced.
 *   - Per-step timeout caps applied.
 *   - Registry: Tier-3 gating + admin grant happy path.
 *   - Screenshot output truncated when oversize.
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildBrowserAutomationTool,
  truncateStepResult,
  BROWSER_CONSTANTS,
  type BrowserRunner,
} from "../tools/browser-automation";
import { ToolRegistry, type ToolContext } from "../tool-registry";

const CTX: ToolContext = {
  userId: "user-1",
  tenantId: "t-1",
  agentSlug: "browser",
};

const CONFIRM = "I CONFIRM BROWSER AUTOMATION";

describe("schema gating", () => {
  it("rejects unknown action kind", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        actions: [{ kind: "destroy" }],
        confirmBrowserUse: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("rejects SSRF-flagged navigate URL", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        actions: [
          { kind: "navigate", url: "http://169.254.169.254/latest/meta-data/" },
        ],
        confirmBrowserUse: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("rejects more than MAX_ACTIONS actions", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    const tooMany = Array.from(
      { length: BROWSER_CONSTANTS.MAX_ACTIONS + 1 },
      () => ({
        kind: "screenshot" as const,
      }),
    );
    expect(
      tool.inputSchema.safeParse({
        actions: tooMany,
        confirmBrowserUse: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("rejects perStepTimeoutMs above the hard cap", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        actions: [{ kind: "screenshot" }],
        perStepTimeoutMs: BROWSER_CONSTANTS.MAX_STEP_TIMEOUT_MS + 1,
        confirmBrowserUse: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("requires confirmBrowserUse literal", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        actions: [{ kind: "screenshot" }],
      }).success,
    ).toBe(false);
  });

  it("registers as Tier 3 with the expected name", () => {
    const tool = buildBrowserAutomationTool(vi.fn());
    expect(tool.tier).toBe(3);
    expect(tool.name).toBe("browser_session");
  });
});

describe("execution + truncation", () => {
  it("invokes runner with resolved per-step timeout", async () => {
    const runner: BrowserRunner = vi.fn().mockResolvedValue({
      steps: [{ kind: "screenshot", ok: true, result: "tiny", durationMs: 10 }],
      finalUrl: "https://example.com/",
      partialFailure: false,
    });
    const tool = buildBrowserAutomationTool(runner);
    const out = await tool.execute(
      {
        actions: [{ kind: "screenshot" }],
        confirmBrowserUse: CONFIRM,
      },
      CTX,
    );
    expect(out.ok).toBe(true);
    expect(out.allSuccess).toBe(true);
    expect(runner).toHaveBeenCalledWith([{ kind: "screenshot" }], {
      perStepTimeoutMs: BROWSER_CONSTANTS.DEFAULT_STEP_TIMEOUT_MS,
    });
  });

  it("marks ok=false when any step failed", async () => {
    const runner: BrowserRunner = vi.fn().mockResolvedValue({
      steps: [
        { kind: "navigate", ok: true, durationMs: 50 },
        {
          kind: "click",
          ok: false,
          error: "selector not found",
          durationMs: 12,
        },
      ],
      finalUrl: "https://example.com/",
      partialFailure: true,
    });
    const tool = buildBrowserAutomationTool(runner);
    const out = await tool.execute(
      {
        actions: [
          { kind: "navigate", url: "https://example.com" },
          { kind: "click", selector: "#missing" },
        ],
        confirmBrowserUse: CONFIRM,
      },
      CTX,
    );
    expect(out.ok).toBe(false);
  });

  it("truncates screenshot results larger than SCREENSHOT_MAX_BYTES", () => {
    const big = "x".repeat(BROWSER_CONSTANTS.SCREENSHOT_MAX_BYTES + 100);
    const step = truncateStepResult({
      kind: "screenshot",
      ok: true,
      result: big,
      durationMs: 100,
    });
    expect(step.result!.length).toBeLessThan(big.length);
    expect(step.result!.includes("[truncated 100 bytes]")).toBe(true);
  });

  it("does NOT truncate non-screenshot results", () => {
    const step = truncateStepResult({
      kind: "navigate",
      ok: true,
      result: "x".repeat(BROWSER_CONSTANTS.SCREENSHOT_MAX_BYTES + 100),
      durationMs: 1,
    });
    expect(step.result!.length).toBe(
      BROWSER_CONSTANTS.SCREENSHOT_MAX_BYTES + 100,
    );
  });
});

describe("registry gating", () => {
  it("non-admin caller is restricted", async () => {
    const r = new ToolRegistry();
    r.register(buildBrowserAutomationTool(vi.fn()));
    const result = await r.call(
      "browser_session",
      {
        actions: [{ kind: "screenshot" }],
        confirmBrowserUse: CONFIRM,
      },
      CTX,
    );
    expect(result.outcome).toBe("restricted");
  });

  it("admin caller dispatches successfully", async () => {
    const runner: BrowserRunner = vi.fn().mockResolvedValue({
      steps: [{ kind: "screenshot", ok: true, durationMs: 1 }],
      finalUrl: null,
      partialFailure: false,
    });
    const r = new ToolRegistry()
      .register(buildBrowserAutomationTool(runner))
      .grantAdmin("admin-1");
    const result = await r.call(
      "browser_session",
      {
        actions: [{ kind: "screenshot" }],
        confirmBrowserUse: CONFIRM,
      },
      { ...CTX, userId: "admin-1" },
    );
    expect(result.outcome).toBe("ok");
  });
});

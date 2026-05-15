/**
 * Tests for src/lib/tools/code-sandbox.ts — Cook 54 Tier-3 tool.
 *
 *   - Schema: language allowlist + size cap + confirm literal.
 *   - Registers as Tier 3.
 *   - Output truncation marker present when stdout exceeds cap.
 *   - Registry gating: non-admin → restricted; admin → ok.
 *   - exitCode != 0 OR timedOut=true → ok=false in the model-facing
 *     output.
 *   - Default timeout applied when omitted.
 */

import { describe, it, expect, vi } from "vitest";
import {
  buildCodeSandboxTool,
  truncateOutput,
  SANDBOX_CONSTANTS,
  type SandboxRunner,
} from "../tools/code-sandbox";
import { ToolRegistry, type ToolContext } from "../tool-registry";

const CTX: ToolContext = {
  userId: "user-1",
  tenantId: "t-1",
  agentSlug: "researcher",
};

const CONFIRM = "I CONFIRM CODE EXECUTION";

describe("schema gating", () => {
  it("rejects an unsupported language", () => {
    const tool = buildCodeSandboxTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        language: "ruby",
        code: "puts 'hi'",
        confirmExecution: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("rejects oversize code", () => {
    const tool = buildCodeSandboxTool(vi.fn());
    const big = "a".repeat(SANDBOX_CONSTANTS.CODE_MAX_BYTES + 1);
    expect(
      tool.inputSchema.safeParse({
        language: "python",
        code: big,
        confirmExecution: CONFIRM,
      }).success,
    ).toBe(false);
  });

  it("rejects missing confirm literal", () => {
    const tool = buildCodeSandboxTool(vi.fn());
    expect(
      tool.inputSchema.safeParse({
        language: "python",
        code: "print(1)",
      }).success,
    ).toBe(false);
  });

  it("registers as Tier 3 with the expected tool name", () => {
    const tool = buildCodeSandboxTool(vi.fn());
    expect(tool.tier).toBe(3);
    expect(tool.name).toBe("run_code");
  });
});

describe("execution", () => {
  it("invokes runner with the resolved defaults", async () => {
    const runner: SandboxRunner = vi.fn().mockResolvedValue({
      language: "python",
      exitCode: 0,
      stdout: "hello",
      stderr: "",
      durationMs: 42,
      timedOut: false,
    });
    const tool = buildCodeSandboxTool(runner);
    const out = await tool.execute(
      {
        language: "python",
        code: "print('hello')",
        confirmExecution: CONFIRM,
      },
      CTX,
    );
    expect(out.ok).toBe(true);
    expect(runner).toHaveBeenCalledWith({
      language: "python",
      code: "print('hello')",
      timeoutMs: SANDBOX_CONSTANTS.DEFAULT_TIMEOUT_MS,
      allowNetwork: false,
      stdin: undefined,
    });
  });

  it("marks ok=false when exitCode != 0", async () => {
    const runner: SandboxRunner = vi.fn().mockResolvedValue({
      language: "bash",
      exitCode: 1,
      stdout: "",
      stderr: "boom",
      durationMs: 10,
      timedOut: false,
    });
    const tool = buildCodeSandboxTool(runner);
    const out = await tool.execute(
      { language: "bash", code: "exit 1", confirmExecution: CONFIRM },
      CTX,
    );
    expect(out.ok).toBe(false);
    expect(out.exitCode).toBe(1);
    expect(out.stderr).toBe("boom");
  });

  it("marks ok=false when runner reports timedOut", async () => {
    const runner: SandboxRunner = vi.fn().mockResolvedValue({
      language: "node",
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 30_000,
      timedOut: true,
    });
    const tool = buildCodeSandboxTool(runner);
    const out = await tool.execute(
      { language: "node", code: "while(true){}", confirmExecution: CONFIRM },
      CTX,
    );
    expect(out.ok).toBe(false);
    expect(out.timedOut).toBe(true);
  });
});

describe("truncateOutput", () => {
  it("returns the input untouched when under the cap", () => {
    expect(truncateOutput("short")).toBe("short");
  });

  it("appends a truncated marker when over the cap", () => {
    const big = "x".repeat(SANDBOX_CONSTANTS.OUTPUT_TRUNCATE + 100);
    const out = truncateOutput(big);
    expect(out.endsWith("…[truncated 100 chars]")).toBe(true);
  });
});

describe("registry gating", () => {
  it("is restricted for non-admin callers", async () => {
    const r = new ToolRegistry();
    r.register(buildCodeSandboxTool(vi.fn()));
    const result = await r.call(
      "run_code",
      {
        language: "python",
        code: "print(1)",
        confirmExecution: CONFIRM,
      },
      CTX,
    );
    expect(result.outcome).toBe("restricted");
  });

  it("dispatches when the caller has an admin grant", async () => {
    const runner: SandboxRunner = vi.fn().mockResolvedValue({
      language: "python",
      exitCode: 0,
      stdout: "hi",
      stderr: "",
      durationMs: 1,
      timedOut: false,
    });
    const r = new ToolRegistry()
      .register(buildCodeSandboxTool(runner))
      .grantAdmin("admin-1");
    const result = await r.call(
      "run_code",
      {
        language: "python",
        code: "print('hi')",
        confirmExecution: CONFIRM,
      },
      { ...CTX, userId: "admin-1" },
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome === "ok") {
      expect((result.output as { ok: boolean }).ok).toBe(true);
    }
  });
});

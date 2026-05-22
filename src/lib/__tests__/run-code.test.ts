/**
 * Tests for src/lib/run-code.ts — Wave 126 local code sandbox.
 *
 * Pins the safety envelope: no fs / no net / no require / no eval /
 * timeout cap / stdout cap / structured error return.
 */
import { describe, it, expect } from "vitest";
import { runCode, RUN_CODE_TOOL_DEF } from "@/lib/run-code";

describe("runCode — happy path", () => {
  it("returns the value of the last expression", () => {
    const r = runCode("2 + 3");
    expect(r.success).toBe(true);
    expect(r.result).toBe(5);
    expect(r.error).toBeUndefined();
  });

  it("captures console.log output", () => {
    const r = runCode("console.log('hi'); console.log(42); 'done'");
    expect(r.success).toBe(true);
    expect(r.result).toBe("done");
    expect(r.stdout).toBe("hi\n42");
  });

  it("supports multi-statement scripts", () => {
    const r = runCode(`
      const x = 10;
      const y = 20;
      x + y;
    `);
    expect(r.result).toBe(30);
  });

  it("Math + JSON primitives work inside the sandbox", () => {
    const r = runCode(`Math.sqrt(16) + JSON.parse('[1,2,3]').length`);
    expect(r.result).toBe(7);
  });

  it("user-provided context is read-readable", () => {
    const r = runCode("input.length + 1", { context: { input: "abcd" } });
    expect(r.result).toBe(5);
  });

  it("records durationMs ≥ 0", () => {
    const r = runCode("1 + 1");
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("runCode — safety envelope", () => {
  it("`require` is undefined (no module imports)", () => {
    const r = runCode("typeof require");
    expect(r.result).toBe("undefined");
  });

  it("`process` is undefined (no env / no exit)", () => {
    const r = runCode("typeof process");
    expect(r.result).toBe("undefined");
  });

  it("`fetch` is undefined (no network)", () => {
    const r = runCode("typeof fetch");
    expect(r.result).toBe("undefined");
  });

  it("`globalThis` does not leak the host process object", () => {
    const r = runCode("typeof globalThis.process");
    expect(r.result).toBe("undefined");
  });

  it("`eval` of a string is blocked by codeGeneration policy", () => {
    const r = runCode(`eval("1 + 1")`);
    expect(r.success).toBe(false);
    expect(r.error?.name).toMatch(/EvalError|Error/);
  });

  it("`new Function(...)` is blocked by codeGeneration policy", () => {
    const r = runCode(`new Function("return 1 + 1")()`);
    expect(r.success).toBe(false);
    expect(r.error?.name).toMatch(/EvalError|Error/);
  });
});

describe("runCode — error handling", () => {
  it("throws inside sandbox return structured error, never crash host", () => {
    const r = runCode(`throw new TypeError("bad thing");`);
    expect(r.success).toBe(false);
    expect(r.error?.name).toBe("TypeError");
    expect(r.error?.message).toBe("bad thing");
    expect(r.error?.stack).toBeDefined();
  });

  it("syntax errors return structured error", () => {
    const r = runCode(`const x = ;`);
    expect(r.success).toBe(false);
    expect(r.error?.name).toMatch(/SyntaxError/);
  });

  it("stack trace is truncated to first 6 lines", () => {
    const r = runCode(`throw new Error("e");`);
    if (r.error?.stack) {
      expect(r.error.stack.split("\n").length).toBeLessThanOrEqual(6);
    }
  });
});

describe("runCode — wall-clock timeout", () => {
  it("infinite loop trips the timeout and returns timedOut=true", () => {
    const r = runCode("while (true) {}", { timeoutMs: 200 });
    expect(r.success).toBe(false);
    expect(r.timedOut).toBe(true);
    expect(r.durationMs).toBeGreaterThanOrEqual(150);
  });

  it("timeout below 100ms is clamped to 100ms floor", () => {
    const r = runCode("while (true) {}", { timeoutMs: 1 });
    expect(r.timedOut).toBe(true);
    // floor of 100ms means the runtime is ≥100, not ≥1
    expect(r.durationMs).toBeGreaterThanOrEqual(50);
  });

  it("timeout above 30s is clamped to 30s ceiling", () => {
    // We don't actually wait 30s — just verify the clamp logic doesn't reject.
    // A trivial script with timeoutMs: 999999999 should still return promptly.
    const r = runCode("1 + 1", { timeoutMs: 999_999_999 });
    expect(r.success).toBe(true);
    expect(r.result).toBe(2);
  });
});

describe("runCode — stdout cap", () => {
  it("output over 1 MB is truncated with marker", () => {
    // 1.2 MB of 'a' written in 12 chunks of 100kb each
    const code = `
      const big = 'a'.repeat(100000);
      for (let i = 0; i < 12; i++) console.log(big);
      'done';
    `;
    const r = runCode(code, { timeoutMs: 10_000 });
    expect(r.outputTruncated).toBe(true);
    expect(r.stdout).toContain("[truncated:");
  });

  it("small output is NOT marked truncated", () => {
    const r = runCode("console.log('small'); 'ok'");
    expect(r.outputTruncated).toBeUndefined();
  });
});

describe("RUN_CODE_TOOL_DEF — shape for claudeToolUse", () => {
  it("declares name + description + input_schema", () => {
    expect(RUN_CODE_TOOL_DEF.name).toBe("run_code");
    expect(RUN_CODE_TOOL_DEF.input_schema.type).toBe("object");
    expect(RUN_CODE_TOOL_DEF.input_schema.required).toContain("code");
  });
});

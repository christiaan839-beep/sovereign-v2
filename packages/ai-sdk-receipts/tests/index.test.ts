/**
 * @sovereign-matrix/ai-sdk-receipts tests.
 *
 * Covers:
 *   - mintTextReceipt happy path
 *   - mintObjectReceipt with sorted-key canonicalization
 *   - AI SDK v3/v4 promptTokens vs v5 inputTokens — both accepted
 *   - tokenId fallback chain (opts → result.response.id → ai-sdk:runId)
 *   - providerHint surfaces in canonical input projection
 *   - Guardian rules: pass / warn / block
 *   - Defensive: rejects null / undefined / missing-text / missing-object
 *   - Object canonicalization deterministic across key-order permutations
 *   - withTextReceipt + withObjectReceipt round-trip
 */
import { describe, it, expect } from "vitest";
import {
  mintTextReceipt,
  mintObjectReceipt,
  withTextReceipt,
  withObjectReceipt,
  type AiSdkTextResult,
  type AiSdkObjectResult,
} from "../src/index.js";

function stubSign(canonical: string): string {
  return `v2=stub:${canonical.length}`;
}

function fixtureTextResult(
  overrides: Partial<AiSdkTextResult> = {},
): AiSdkTextResult {
  return {
    text: "Hello from generateText",
    finishReason: "stop",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    response: {
      id: "ai-sdk-test-001",
      modelId: "gpt-4o",
      timestamp: new Date("2026-05-18T19:00:00Z"),
    },
    warnings: [],
    ...overrides,
  };
}

function fixtureObjectResult<T>(
  object: T,
  overrides: Partial<AiSdkObjectResult<T>> = {},
): AiSdkObjectResult<T> {
  return {
    object,
    finishReason: "stop",
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    response: {
      id: "ai-sdk-obj-test-001",
      modelId: "claude-sonnet-4-6",
    },
    warnings: [],
    ...overrides,
  };
}

describe("mintTextReceipt — happy path", () => {
  it("returns a signed Guardian attestation", async () => {
    const att = await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "test-agent",
      runId: "run_001",
    });
    expect(att.verdictId).toMatch(/^[0-9a-f-]+$/);
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub/);
    expect(att.canonical.length).toBeGreaterThan(0);
  });

  it("tokenId defaults to result.response.id", async () => {
    const att = await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(att.canonical).toContain("ai-sdk-test-001");
  });

  it("tokenId falls back to ai-sdk:runId when response.id absent", async () => {
    const att = await mintTextReceipt(
      fixtureTextResult({ response: undefined }),
      { sign: stubSign, agentSlug: "agent", runId: "run_xyz" },
    );
    expect(att.canonical).toContain("ai-sdk:run_xyz");
  });

  it("explicit tokenId overrides every fallback", async () => {
    const att = await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      tokenId: "tok_explicit",
    });
    expect(att.canonical).toContain("tok_explicit");
  });

  it("providerHint surfaces in canonical input projection", async () => {
    let observedInput: unknown = null;
    await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      providerHint: "anthropic/claude-sonnet-4-6",
      rules: [
        {
          id: "observe",
          description: "captures input for assertion",
          evaluate: async (ctx) => {
            observedInput = ctx.input;
            return { verdict: "pass" };
          },
        },
      ],
    });
    expect((observedInput as { providerHint?: string })?.providerHint).toBe(
      "anthropic/claude-sonnet-4-6",
    );
  });
});

describe("mintTextReceipt — version-agnostic usage shape", () => {
  it("accepts v3/v4 promptTokens / completionTokens", async () => {
    let observedInput: { promptTokens?: number; completionTokens?: number } =
      {};
    await mintTextReceipt(
      fixtureTextResult({
        usage: { promptTokens: 100, completionTokens: 50 },
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        rules: [
          {
            id: "observe",
            description: "captures input",
            evaluate: async (ctx) => {
              observedInput = ctx.input as typeof observedInput;
              return { verdict: "pass" };
            },
          },
        ],
      },
    );
    expect(observedInput.promptTokens).toBe(100);
    expect(observedInput.completionTokens).toBe(50);
  });

  it("accepts v5 inputTokens / outputTokens (renamed)", async () => {
    let observedInput: { promptTokens?: number; completionTokens?: number } =
      {};
    await mintTextReceipt(
      fixtureTextResult({
        usage: { inputTokens: 200, outputTokens: 75 },
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        rules: [
          {
            id: "observe",
            description: "captures input",
            evaluate: async (ctx) => {
              observedInput = ctx.input as typeof observedInput;
              return { verdict: "pass" };
            },
          },
        ],
      },
    );
    expect(observedInput.promptTokens).toBe(200);
    expect(observedInput.completionTokens).toBe(75);
  });
});

describe("mintTextReceipt — defensive parsing", () => {
  it("rejects null result", async () => {
    await expect(
      mintTextReceipt(null as unknown as AiSdkTextResult, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/must be an object/);
  });

  it("rejects result with no text field", async () => {
    await expect(
      mintTextReceipt(
        { ...fixtureTextResult(), text: undefined as unknown as string },
        { sign: stubSign, agentSlug: "agent", runId: "run" },
      ),
    ).rejects.toThrow(/no text field/);
  });
});

describe("mintObjectReceipt — sorted-key canonicalization", () => {
  it("produces byte-identical output for permuted-key inputs", async () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    // Capture the stringified output that each receipt commits to,
    // via an observe-rule. The canonical envelope from runGuardian
    // doesn't echo `output` directly — it commits to verdictId +
    // rules — but the rule's evaluate(ctx) sees ctx.output, which
    // is exactly the stringified object we want to verify is
    // permutation-stable.
    let output1 = "";
    let output2 = "";
    const observe = (sink: (s: string) => void) => ({
      id: "observe",
      description: "captures stringified output",
      evaluate: async (ctx: { output: unknown }) => {
        sink(String(ctx.output));
        return { verdict: "pass" as const };
      },
    });

    await mintObjectReceipt(fixtureObjectResult(obj1), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run_same",
      rules: [observe((s) => (output1 = s))],
    });
    await mintObjectReceipt(fixtureObjectResult(obj2), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run_same",
      rules: [observe((s) => (output2 = s))],
    });

    // Byte-identical after sorted-key stringify, regardless of
    // input property order.
    expect(output1).toBe(output2);
    expect(output1).toBe('{"a":1,"b":2,"c":3}');
  });

  it("rejects result with no object field", async () => {
    await expect(
      mintObjectReceipt(
        {
          ...fixtureObjectResult({}),
          object: null,
        } as unknown as AiSdkObjectResult,
        { sign: stubSign, agentSlug: "agent", runId: "run" },
      ),
    ).rejects.toThrow(/no object field/);
  });

  it("signs a successful object receipt", async () => {
    const att = await mintObjectReceipt(
      fixtureObjectResult({ verdict: "approved", confidence: 0.92 }),
      { sign: stubSign, agentSlug: "agent", runId: "run" },
    );
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub/);
  });
});

describe("mintTextReceipt — Guardian rules", () => {
  it("evaluates a blocking rule and records 'block' overall", async () => {
    const att = await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      rules: [
        {
          id: "always-block",
          description: "test rule that blocks",
          evaluate: async () => ({ verdict: "block", reason: "test" }),
        },
      ],
    });
    expect(att.overall).toBe("block");
  });

  it("evaluates a warning rule and records 'warn' overall", async () => {
    const att = await mintTextReceipt(fixtureTextResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      rules: [
        {
          id: "always-warn",
          description: "test rule that warns",
          evaluate: async () => ({ verdict: "warn", reason: "test" }),
        },
      ],
    });
    expect(att.overall).toBe("warn");
  });
});

describe("withTextReceipt + withObjectReceipt — one-liner round-trip", () => {
  it("withTextReceipt awaits + returns both objects", async () => {
    const result = fixtureTextResult();
    const { result: returned, receipt } = await withTextReceipt(
      Promise.resolve(result),
      { sign: stubSign, agentSlug: "agent", runId: "run" },
    );
    expect(returned).toBe(result);
    expect(receipt.signature).toMatch(/^v2=stub/);
  });

  it("withObjectReceipt awaits + returns both objects", async () => {
    const result = fixtureObjectResult({ x: 1 });
    const { result: returned, receipt } = await withObjectReceipt(
      Promise.resolve(result),
      { sign: stubSign, agentSlug: "agent", runId: "run" },
    );
    expect(returned).toBe(result);
    expect(receipt.signature).toMatch(/^v2=stub/);
  });

  it("propagates errors from the underlying promise", async () => {
    await expect(
      withTextReceipt(Promise.reject(new Error("provider down")), {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/provider down/);
  });
});

describe("mintTextReceipt — input non-mutation", () => {
  it("does not mutate the input result", async () => {
    const result = fixtureTextResult();
    const before = JSON.stringify(result);
    await mintTextReceipt(result, {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(JSON.stringify(result)).toBe(before);
  });
});

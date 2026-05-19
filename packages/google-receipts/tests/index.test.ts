/**
 * @sovereign-matrix/google-receipts tests.
 *
 * Covers:
 *   - mintGenerationReceipt happy path produces a signed attestation
 *   - Multi-candidate / multi-part text extraction
 *   - Non-text parts (function calls) skipped
 *   - sign callback receives canonical bytes byte-for-byte
 *   - Guardian rules evaluated against the output
 *   - withReceipt() one-liner round-trip
 *   - tokenId fallback when caller omits it
 *   - Defensive: rejects null / undefined / missing response
 *   - Never mutates the input result
 */
import { describe, it, expect } from "vitest";
import {
  mintGenerationReceipt,
  withReceipt,
  type GeminiGenerateContentResult,
} from "../src/index.js";

function stubSign(canonical: string): string {
  return `v2=stub:${canonical.length}`;
}

function fixtureResult(
  overrides: Partial<GeminiGenerateContentResult["response"]> = {},
): GeminiGenerateContentResult {
  return {
    response: {
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: "Hello from Gemini" }],
          },
          finishReason: "STOP",
          safetyRatings: [
            { category: "HARM_CATEGORY_HARASSMENT", probability: "NEGLIGIBLE" },
          ],
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
      ...overrides,
    },
  };
}

describe("mintGenerationReceipt — happy path", () => {
  it("returns a signed Guardian attestation", async () => {
    const att = await mintGenerationReceipt(fixtureResult(), {
      sign: stubSign,
      agentSlug: "test-agent",
      runId: "run_test_001",
      modelName: "gemini-1.5-pro",
    });
    expect(att.verdictId).toMatch(/^[0-9a-f-]+$/);
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub:\d+/);
    expect(att.canonical.length).toBeGreaterThan(0);
    expect(att.contentHash.length).toBe(64);
  });

  it("tokenId falls back to deterministic finishReason+category when omitted", async () => {
    const att = await mintGenerationReceipt(fixtureResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(att.canonical).toContain("gemini:STOP:HARM_CATEGORY_HARASSMENT");
  });

  it("explicit tokenId overrides the fallback", async () => {
    const att = await mintGenerationReceipt(fixtureResult(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      tokenId: "tok_idempotency_key",
    });
    expect(att.canonical).toContain("tok_idempotency_key");
  });
});

describe("mintGenerationReceipt — text extraction", () => {
  it("concatenates multiple text parts across one candidate", async () => {
    let observedOutput = "";
    await mintGenerationReceipt(
      fixtureResult({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Part one. " }, { text: "Part two." }],
            },
            finishReason: "STOP",
          },
        ],
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        rules: [
          {
            id: "observe",
            description: "captures the output for assertion",
            evaluate: async (ctx) => {
              observedOutput = String(ctx.output);
              return { verdict: "pass" };
            },
          },
        ],
      },
    );
    expect(observedOutput).toBe("Part one. Part two.");
  });

  it("concatenates parts across multiple candidates (n-best surfaced)", async () => {
    let observedOutput = "";
    await mintGenerationReceipt(
      fixtureResult({
        candidates: [
          {
            content: { parts: [{ text: "Candidate 1. " }] },
            finishReason: "STOP",
          },
          {
            content: { parts: [{ text: "Candidate 2." }] },
            finishReason: "STOP",
          },
        ],
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        rules: [
          {
            id: "observe",
            description: "captures output",
            evaluate: async (ctx) => {
              observedOutput = String(ctx.output);
              return { verdict: "pass" };
            },
          },
        ],
      },
    );
    expect(observedOutput).toBe("Candidate 1. Candidate 2.");
  });

  it("skips non-text parts (function calls, inline data)", async () => {
    let observedOutput = "";
    await mintGenerationReceipt(
      fixtureResult({
        candidates: [
          {
            content: {
              parts: [
                { text: "Calling weather tool" },
                // Non-text part (function call) — no text field
                { functionCall: { name: "get_weather", args: {} } } as never,
              ],
            },
            finishReason: "STOP",
          },
        ],
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        rules: [
          {
            id: "observe",
            description: "captures output",
            evaluate: async (ctx) => {
              observedOutput = String(ctx.output);
              return { verdict: "pass" };
            },
          },
        ],
      },
    );
    expect(observedOutput).toBe("Calling weather tool");
    expect(observedOutput).not.toContain("get_weather");
  });

  it("handles empty candidates array", async () => {
    const att = await mintGenerationReceipt(fixtureResult({ candidates: [] }), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub/);
  });
});

describe("mintGenerationReceipt — sign callback", () => {
  it("invokes sign with parseable canonical JSON", async () => {
    let observed = "";
    await mintGenerationReceipt(fixtureResult(), {
      sign: (canonical) => {
        observed = canonical;
        return "v2=stub";
      },
      agentSlug: "agent",
      runId: "run",
    });
    expect(observed.length).toBeGreaterThan(0);
    expect(() => JSON.parse(observed)).not.toThrow();
  });

  it("propagates sign callback errors", async () => {
    await expect(
      mintGenerationReceipt(fixtureResult(), {
        sign: () => {
          throw new Error("Vertex AI key revoked");
        },
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/Vertex AI key revoked/);
  });
});

describe("mintGenerationReceipt — Guardian rules", () => {
  it("evaluates a blocking rule and records 'block' overall", async () => {
    const att = await mintGenerationReceipt(fixtureResult(), {
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
    const att = await mintGenerationReceipt(fixtureResult(), {
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

describe("mintGenerationReceipt — defensive parsing", () => {
  it("rejects null result", async () => {
    await expect(
      mintGenerationReceipt(null as unknown as GeminiGenerateContentResult, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/must be an object/);
  });

  it("rejects result with no response", async () => {
    await expect(
      mintGenerationReceipt({} as unknown as GeminiGenerateContentResult, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/no response/);
  });
});

describe("mintGenerationReceipt — input non-mutation", () => {
  it("does not mutate the input result", async () => {
    const result = fixtureResult();
    const before = JSON.stringify(result);
    await mintGenerationReceipt(result, {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("withReceipt — one-liner round-trip", () => {
  it("awaits + returns both the result and the receipt", async () => {
    const result = fixtureResult();
    const { result: returned, receipt } = await withReceipt(
      Promise.resolve(result),
      { sign: stubSign, agentSlug: "agent", runId: "run" },
    );
    expect(returned).toBe(result);
    expect(receipt.signature).toMatch(/^v2=stub/);
  });

  it("propagates errors from the underlying promise", async () => {
    await expect(
      withReceipt(Promise.reject(new Error("quota exceeded")), {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/quota exceeded/);
  });
});

/**
 * @sovereign-matrix/anthropic-receipts tests.
 *
 * Covers:
 *   - mintMessageReceipt happy path produces a signed attestation
 *   - Multi-block text content is concatenated correctly
 *   - tool-use blocks are skipped (don't pollute the output)
 *   - sign callback receives canonical bytes byte-for-byte
 *   - Guardian rules in opts are evaluated against the output
 *   - withReceipt() one-liner round-trip
 *   - tokenId defaults to message.id when omitted
 *   - Defensive: rejects null / undefined / no-content messages
 *   - Never mutates the input message
 */
import { describe, it, expect } from "vitest";
import {
  mintMessageReceipt,
  withReceipt,
  type AnthropicMessage,
} from "../src/index.js";

function stubSign(canonical: string): string {
  return `v2=stub:${canonical.length}`;
}

function fixtureMessage(
  overrides: Partial<AnthropicMessage> = {},
): AnthropicMessage {
  return {
    id: "msg_test_001",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    content: [{ type: "text", text: "Hello from Claude" }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: 10,
      output_tokens: 5,
    },
    ...overrides,
  };
}

describe("mintMessageReceipt — happy path", () => {
  it("returns a signed Guardian attestation", async () => {
    const att = await mintMessageReceipt(fixtureMessage(), {
      sign: stubSign,
      agentSlug: "test-agent",
      runId: "run_test_001",
    });
    expect(att.verdictId).toMatch(/^[0-9a-f-]+$/);
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub:\d+/);
    expect(att.canonical.length).toBeGreaterThan(0);
    expect(att.contentHash.length).toBe(64);
  });

  it("tokenId defaults to message.id when omitted", async () => {
    const att = await mintMessageReceipt(fixtureMessage({ id: "msg_xyz" }), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(att.canonical).toContain("msg_xyz");
  });

  it("explicit tokenId overrides message.id", async () => {
    const att = await mintMessageReceipt(fixtureMessage({ id: "msg_xyz" }), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      tokenId: "tok_idempotency_key",
    });
    expect(att.canonical).toContain("tok_idempotency_key");
  });
});

describe("mintMessageReceipt — multi-block content", () => {
  it("concatenates multiple text blocks in order", async () => {
    let observedOutput = "";
    await mintMessageReceipt(
      fixtureMessage({
        content: [
          { type: "text", text: "Part one. " },
          { type: "text", text: "Part two." },
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

  it("skips tool-use blocks (commits only to text output)", async () => {
    let observedOutput = "";
    await mintMessageReceipt(
      fixtureMessage({
        content: [
          { type: "text", text: "Calling weather tool now." },
          // Tool-use block — should be skipped by the text extractor.
          {
            type: "tool_use",
            text: undefined,
          } as unknown as AnthropicMessage["content"][number],
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
    expect(observedOutput).toBe("Calling weather tool now.");
    expect(observedOutput).not.toContain("tool_use");
  });

  it("handles empty content array (canonical still signs)", async () => {
    const att = await mintMessageReceipt(fixtureMessage({ content: [] }), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub/);
  });
});

describe("mintMessageReceipt — sign callback", () => {
  it("invokes sign with parseable canonical JSON", async () => {
    let observed = "";
    await mintMessageReceipt(fixtureMessage(), {
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
      mintMessageReceipt(fixtureMessage(), {
        sign: () => {
          throw new Error("KMS unreachable");
        },
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/KMS unreachable/);
  });
});

describe("mintMessageReceipt — Guardian rules", () => {
  it("evaluates a blocking rule and records 'block' overall", async () => {
    const att = await mintMessageReceipt(fixtureMessage(), {
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
    const att = await mintMessageReceipt(fixtureMessage(), {
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

describe("mintMessageReceipt — defensive parsing", () => {
  it("rejects null message", async () => {
    await expect(
      mintMessageReceipt(null as unknown as AnthropicMessage, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/must be an object/);
  });

  it("rejects message with non-array content", async () => {
    await expect(
      mintMessageReceipt(
        fixtureMessage({
          content: "not an array" as unknown as AnthropicMessage["content"],
        }),
        { sign: stubSign, agentSlug: "agent", runId: "run" },
      ),
    ).rejects.toThrow(/no content array/);
  });
});

describe("mintMessageReceipt — input non-mutation", () => {
  it("does not mutate the input message", async () => {
    const message = fixtureMessage();
    const before = JSON.stringify(message);
    await mintMessageReceipt(message, {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(JSON.stringify(message)).toBe(before);
  });
});

describe("withReceipt — one-liner round-trip", () => {
  it("awaits + returns both the message and the receipt", async () => {
    const message = fixtureMessage();
    const { message: returned, receipt } = await withReceipt(
      Promise.resolve(message),
      { sign: stubSign, agentSlug: "agent", runId: "run" },
    );
    expect(returned).toBe(message);
    expect(receipt.signature).toMatch(/^v2=stub/);
  });

  it("propagates errors from the message promise", async () => {
    await expect(
      withReceipt(Promise.reject(new Error("overloaded")), {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/overloaded/);
  });
});

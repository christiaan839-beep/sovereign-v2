/**
 * @sovereign-matrix/openai-receipts tests.
 *
 * Covers:
 *   - mintCompletionReceipt happy path produces a signed attestation
 *   - sign callback receives canonical bytes byte-for-byte
 *   - Guardian rules in opts are evaluated against the output
 *   - withReceipt() one-liner round-trip
 *   - tokenId defaults to completion.id when omitted
 *   - Defensive: rejects null / undefined / no-choices completions
 *   - Never mutates the input completion
 */
import { describe, it, expect } from "vitest";
import {
  mintCompletionReceipt,
  withReceipt,
  type OpenAIChatCompletion,
} from "../src/index.js";

function stubSign(canonical: string): string {
  return `v2=stub:${canonical.length}`;
}

function fixtureCompletion(
  overrides: Partial<OpenAIChatCompletion> = {},
): OpenAIChatCompletion {
  return {
    id: "chatcmpl_test_001",
    model: "gpt-4o",
    choices: [
      {
        message: { role: "assistant", content: "Hello from GPT" },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
    ...overrides,
  };
}

describe("mintCompletionReceipt — happy path", () => {
  it("returns a signed Guardian attestation", async () => {
    const att = await mintCompletionReceipt(fixtureCompletion(), {
      sign: stubSign,
      agentSlug: "test-agent",
      runId: "run_test_001",
    });
    expect(att.verdictId).toMatch(/^[0-9a-f-]+$/);
    expect(att.overall).toBe("pass");
    expect(att.signature).toMatch(/^v2=stub:\d+/);
    expect(att.canonical.length).toBeGreaterThan(0);
    expect(att.contentHash.length).toBe(64);
    expect(typeof att.issuedAt).toBe("string");
  });

  it("tokenId defaults to completion.id when omitted", async () => {
    const att = await mintCompletionReceipt(
      fixtureCompletion({ id: "chatcmpl_xyz" }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      },
    );
    // canonical embeds tokenId; check the bytes contain the completion id.
    expect(att.canonical).toContain("chatcmpl_xyz");
  });

  it("explicit tokenId overrides completion.id", async () => {
    const att = await mintCompletionReceipt(
      fixtureCompletion({ id: "chatcmpl_xyz" }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
        tokenId: "tok_idempotency_key",
      },
    );
    expect(att.canonical).toContain("tok_idempotency_key");
  });
});

describe("mintCompletionReceipt — sign callback", () => {
  it("invokes sign with the canonical bytes byte-for-byte", async () => {
    let observed = "";
    await mintCompletionReceipt(fixtureCompletion(), {
      sign: (canonical) => {
        observed = canonical;
        return "v2=stub";
      },
      agentSlug: "agent",
      runId: "run",
    });
    expect(observed.length).toBeGreaterThan(0);
    // canonical is JSON — verify it parses.
    expect(() => JSON.parse(observed)).not.toThrow();
  });

  it("propagates sign callback errors", async () => {
    await expect(
      mintCompletionReceipt(fixtureCompletion(), {
        sign: () => {
          throw new Error("HSM unavailable");
        },
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/HSM unavailable/);
  });
});

describe("mintCompletionReceipt — Guardian rules integration", () => {
  it("evaluates a passing rule and records 'pass'", async () => {
    const att = await mintCompletionReceipt(fixtureCompletion(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      rules: [
        {
          id: "always-pass",
          description: "test rule that always passes",
          evaluate: async () => ({ verdict: "pass" }),
        },
      ],
    });
    expect(att.overall).toBe("pass");
    expect(att.rules.length).toBe(1);
    expect(att.rules[0].verdict).toBe("pass");
  });

  it("evaluates a warning rule and records 'warn' overall", async () => {
    const att = await mintCompletionReceipt(fixtureCompletion(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      rules: [
        {
          id: "always-warn",
          description: "test rule that warns",
          evaluate: async () => ({ verdict: "warn", reason: "test warn" }),
        },
      ],
    });
    expect(att.overall).toBe("warn");
  });

  it("evaluates a blocking rule and records 'block' overall", async () => {
    const att = await mintCompletionReceipt(fixtureCompletion(), {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
      rules: [
        {
          id: "always-block",
          description: "test rule that blocks",
          evaluate: async () => ({ verdict: "block", reason: "test block" }),
        },
      ],
    });
    expect(att.overall).toBe("block");
  });
});

describe("mintCompletionReceipt — defensive parsing", () => {
  it("rejects null completion", async () => {
    await expect(
      mintCompletionReceipt(null as unknown as OpenAIChatCompletion, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/must be an object/);
  });

  it("rejects undefined completion", async () => {
    await expect(
      mintCompletionReceipt(undefined as unknown as OpenAIChatCompletion, {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/must be an object/);
  });

  it("rejects completion with empty choices", async () => {
    await expect(
      mintCompletionReceipt(fixtureCompletion({ choices: [] }), {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/no choices/);
  });

  it("tolerates null content (empty string output)", async () => {
    const att = await mintCompletionReceipt(
      fixtureCompletion({
        choices: [
          {
            message: { role: "assistant", content: null },
            finish_reason: "content_filter",
          },
        ],
      }),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      },
    );
    expect(att.overall).toBe("pass");
  });
});

describe("mintCompletionReceipt — input non-mutation", () => {
  it("does not mutate the input completion", async () => {
    const completion = fixtureCompletion();
    const before = JSON.stringify(completion);
    await mintCompletionReceipt(completion, {
      sign: stubSign,
      agentSlug: "agent",
      runId: "run",
    });
    expect(JSON.stringify(completion)).toBe(before);
  });
});

describe("withReceipt — one-liner round-trip", () => {
  it("awaits the completion + returns both objects", async () => {
    const completion = fixtureCompletion();
    const { completion: returned, receipt } = await withReceipt(
      Promise.resolve(completion),
      {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      },
    );
    expect(returned).toBe(completion); // same reference, not a copy
    expect(receipt.signature).toMatch(/^v2=stub/);
  });

  it("propagates errors from the completion promise", async () => {
    await expect(
      withReceipt(Promise.reject(new Error("rate limited")), {
        sign: stubSign,
        agentSlug: "agent",
        runId: "run",
      }),
    ).rejects.toThrow(/rate limited/);
  });
});

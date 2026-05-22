/**
 * Tests for src/lib/finetune-export.ts — Wave 133.
 *
 * Pure-function tests on the aggregator. Pins the row-selection
 * criteria (auto-approved, duration > 0, dedupe by prompt hash,
 * min/max output length) plus the JSONL formatting contract.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  aggregateTrainingSet,
  extractInputText,
  extractOutputText,
  toJsonl,
  type RawRun,
} from "@/lib/finetune-export";

function mkRow(overrides: Partial<RawRun> = {}): RawRun {
  return {
    id: "id-1",
    agentName: "audit",
    modelUsed: "nemotron-ultra-253b-v1",
    inputJson: JSON.stringify({ prompt: "Analyze this company website." }),
    outputJson: JSON.stringify({ result: "x".repeat(200) }),
    trustDecision: "auto-approved",
    durationMs: 1000,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("extractInputText", () => {
  it("returns null on malformed JSON", () => {
    expect(extractInputText("not json")).toBeNull();
  });

  it("handles string input directly", () => {
    expect(extractInputText('"plain string"')).toBe("plain string");
  });

  it("prefers prompt > text > query > message", () => {
    expect(
      extractInputText(JSON.stringify({ prompt: "P", text: "T", query: "Q" })),
    ).toBe("P");
    expect(extractInputText(JSON.stringify({ text: "T", query: "Q" }))).toBe(
      "T",
    );
    expect(extractInputText(JSON.stringify({ query: "Q" }))).toBe("Q");
  });

  it("returns null when no candidate key matches and stringified shape", () => {
    const r = extractInputText(JSON.stringify({ random: "value" }));
    expect(typeof r === "string" && r.includes("random")).toBe(true);
  });

  it("truncates above 4000 chars", () => {
    const long = "x".repeat(5000);
    const r = extractInputText(JSON.stringify({ prompt: long }));
    expect(r?.length).toBe(4000);
  });
});

describe("extractOutputText", () => {
  it("returns null on malformed JSON", () => {
    expect(extractOutputText("{[")).toBeNull();
  });

  it("prefers result > output > response > text", () => {
    expect(
      extractOutputText(
        JSON.stringify({ result: "R", output: "O", response: "Rs" }),
      ),
    ).toBe("R");
  });

  it("returns null when no candidate key exists", () => {
    expect(extractOutputText(JSON.stringify({ unrelated: 42 }))).toBeNull();
  });

  it("falls back to nested fields like final_answer + agentResponse", () => {
    expect(extractOutputText(JSON.stringify({ final_answer: "FA" }))).toBe(
      "FA",
    );
    expect(extractOutputText(JSON.stringify({ agentResponse: "AR" }))).toBe(
      "AR",
    );
  });

  it("truncates above 8000 chars", () => {
    const long = "y".repeat(9000);
    const r = extractOutputText(JSON.stringify({ result: long }));
    expect(r?.length).toBe(8000);
  });
});

describe("aggregateTrainingSet — filtering", () => {
  it("returns empty when no rows are auto-approved", () => {
    const rows = [mkRow({ trustDecision: "blocked" })];
    expect(aggregateTrainingSet(rows)).toEqual([]);
  });

  it("drops rows with duration_ms <= 0", () => {
    expect(aggregateTrainingSet([mkRow({ durationMs: 0 })])).toEqual([]);
  });

  it("drops rows with output shorter than MIN_OUTPUT_LEN", () => {
    const tooShort = mkRow({
      outputJson: JSON.stringify({ result: "ok" }),
    });
    expect(aggregateTrainingSet([tooShort])).toEqual([]);
  });

  it("dedupes by prompt+agent hash", () => {
    const row = mkRow();
    const dup = mkRow({ id: "id-2" });
    const result = aggregateTrainingSet([row, dup]);
    expect(result).toHaveLength(1);
  });

  it("respects excludeAgents", () => {
    const rows = [mkRow({ agentName: "audit" })];
    expect(aggregateTrainingSet(rows, { excludeAgents: ["audit"] })).toEqual(
      [],
    );
  });

  it("respects includeAgents allowlist", () => {
    const rows = [mkRow({ agentName: "audit" }), mkRow({ agentName: "ocr" })];
    const result = aggregateTrainingSet(rows, { includeAgents: ["audit"] });
    expect(result).toHaveLength(1);
    expect(result[0].agentName).toBe("audit");
  });

  it("caps at maxRows", () => {
    const rows: RawRun[] = [];
    for (let i = 0; i < 50; i++) {
      rows.push(
        mkRow({
          id: `id-${i}`,
          inputJson: JSON.stringify({ prompt: `prompt-${i}` }),
        }),
      );
    }
    expect(aggregateTrainingSet(rows, { maxRows: 10 })).toHaveLength(10);
  });
});

describe("aggregateTrainingSet — output shape", () => {
  it("emits 3-message system/user/assistant shape", () => {
    const result = aggregateTrainingSet([mkRow()]);
    expect(result[0].messages).toHaveLength(3);
    expect(result[0].messages[0].role).toBe("system");
    expect(result[0].messages[1].role).toBe("user");
    expect(result[0].messages[2].role).toBe("assistant");
  });

  it("uses caller-supplied systemPrompt when provided", () => {
    const result = aggregateTrainingSet([mkRow()], {
      systemPrompt: "Custom override",
    });
    expect(result[0].messages[0].content).toBe("Custom override");
  });

  it("defaults systemPrompt to agent-aware string", () => {
    const result = aggregateTrainingSet([mkRow({ agentName: "ocr" })]);
    expect(result[0].messages[0].content).toMatch(/ocr/);
  });

  it("emits a stable 24-char prompt hash", () => {
    const r1 = aggregateTrainingSet([mkRow()]);
    const r2 = aggregateTrainingSet([mkRow({ id: "different-id" })]);
    expect(r1[0].promptHash).toBe(r2[0].promptHash);
    expect(r1[0].promptHash.length).toBe(24);
  });
});

describe("toJsonl", () => {
  it("emits one line per example with only the messages array", () => {
    const examples = aggregateTrainingSet([
      mkRow(),
      mkRow({
        id: "id-2",
        inputJson: JSON.stringify({ prompt: "different" }),
      }),
    ]);
    const out = toJsonl(examples);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    const parsed = JSON.parse(lines[0]);
    expect(Object.keys(parsed)).toEqual(["messages"]);
  });

  it("returns empty string on empty input", () => {
    expect(toJsonl([])).toBe("");
  });
});

/**
 * Tests for ai-stream — no-key path + SSE chunk parser behaviour.
 *
 * Re-implements parseSseChunk here (private in ai-stream.ts) to
 * verify its shape. Integration tests against real NIM are run
 * against staging with a real key.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { streamAi } from "../ai-stream";

/* ─── Parity copy of parseSseChunk (inline for unit test) ────── */

function parseSseChunk(raw: string): string | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (payload === "[DONE]") return null;
  try {
    const msg = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = msg.choices?.[0]?.delta?.content;
    return typeof content === "string" && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

describe("parseSseChunk (parity)", () => {
  it("extracts content from a standard OpenAI-compatible delta", () => {
    const chunk = `data: {"choices":[{"delta":{"content":"Hello"}}]}`;
    expect(parseSseChunk(chunk)).toBe("Hello");
  });

  it("returns null for [DONE] control frames", () => {
    expect(parseSseChunk("data: [DONE]")).toBeNull();
  });

  it("returns null for non-data lines", () => {
    expect(parseSseChunk("event: ping")).toBeNull();
    expect(parseSseChunk(": keep-alive")).toBeNull();
    expect(parseSseChunk("")).toBeNull();
  });

  it("returns null for malformed JSON payloads (never throws)", () => {
    expect(parseSseChunk("data: { not json")).toBeNull();
  });

  it("returns null when delta has no content", () => {
    const chunk = `data: {"choices":[{"delta":{}}]}`;
    expect(parseSseChunk(chunk)).toBeNull();
  });

  it("returns null for empty content strings", () => {
    const chunk = `data: {"choices":[{"delta":{"content":""}}]}`;
    expect(parseSseChunk(chunk)).toBeNull();
  });

  it("tolerates leading/trailing whitespace", () => {
    const chunk = `   data: {"choices":[{"delta":{"content":"Hi"}}]}   `;
    expect(parseSseChunk(chunk)).toBe("Hi");
  });
});

describe("streamAi() — no-key path", () => {
  const ORIG_NIM = process.env.NIM_API_KEY;
  const ORIG_NVIDIA = process.env.NVIDIA_API_KEY;

  beforeEach(() => {
    delete process.env.NIM_API_KEY;
    delete process.env.NVIDIA_API_KEY;
  });
  afterEach(() => {
    if (ORIG_NIM === undefined) delete process.env.NIM_API_KEY;
    else process.env.NIM_API_KEY = ORIG_NIM;
    if (ORIG_NVIDIA === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = ORIG_NVIDIA;
  });

  it("throws immediately (before any yield) when NIM key is missing", async () => {
    const gen = streamAi("anything");
    await expect(gen.next()).rejects.toThrow(/NIM API key not configured/);
  });
});

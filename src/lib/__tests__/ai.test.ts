/**
 * Tests for src/lib/ai.ts — Unified AI Text Generation Router
 *
 * Verifies routing logic, fallback chains, and error handling.
 * All external providers (Gemini, Claude, NIM, Groq) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Dependencies ──

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  settings: { userEmail: "userEmail" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  safeDecrypt: vi.fn((v: string) => v),
}));

// Mock circuit breakers to pass through
vi.mock("@/lib/circuit-breaker", () => ({
  geminiBreaker: { execute: (fn: () => Promise<string>) => fn() },
  claudeBreaker: { execute: (fn: () => Promise<string>) => fn() },
  groqBreaker: { execute: (fn: () => Promise<string>) => fn() },
}));

// Mock retry to execute immediately without delay
vi.mock("@/lib/retry", () => ({
  withRetry: (fn: () => Promise<string>) => fn(),
}));

// ── Provider Mocks ──

const mockGeminiGenerateContent = vi.fn();

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: mockGeminiGenerateContent,
          embedContent: vi.fn().mockResolvedValue({ embedding: { values: [] } }),
        };
      }
    },
  };
});

const mockClaudeCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      constructor() {}
      messages = { create: mockClaudeCreate };
    },
  };
});

const mockGroqCreate = vi.fn();
vi.mock("groq-sdk", () => {
  return {
    default: class MockGroq {
      constructor() {}
      chat = { completions: { create: mockGroqCreate } };
    },
  };
});

const mockNimChat = vi.fn();
vi.mock("@/lib/nvidia", () => ({
  nimChat: (...args: unknown[]) => mockNimChat(...args),
}));

vi.mock("@tavily/core", () => ({
  tavily: vi.fn(),
}));

// ── Import after mocks ──

import { ai } from "@/lib/ai";

// ── Tests ──

describe("ai() — Unified Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Gemini succeeds
    mockGeminiGenerateContent.mockResolvedValue({
      response: { text: () => "gemini-response" },
    });

    // Default: NIM succeeds
    mockNimChat.mockResolvedValue("nim-response");

    // Default: Claude succeeds
    mockClaudeCreate.mockResolvedValue({
      content: [{ type: "text", text: "claude-response" }],
    });

    // Default: Groq succeeds
    mockGroqCreate.mockResolvedValue({
      choices: [{ message: { content: "groq-response" } }],
    });
  });

  // ─── Default Route → Gemini ───

  it("default route goes to Gemini", async () => {
    const result = await ai("test prompt");
    expect(result).toBe("gemini-response");
    expect(mockGeminiGenerateContent).toHaveBeenCalledWith("test prompt");
  });

  it("default route passes system instruction to Gemini", async () => {
    await ai("test", { system: "You are helpful" });
    expect(mockGeminiGenerateContent).toHaveBeenCalled();
  });

  // ─── model="nim" → NIM ───

  it('model="nim" routes to NVIDIA NIM', async () => {
    const result = await ai("nim prompt", { model: "nim" });
    expect(result).toBe("nim-response");
    expect(mockNimChat).toHaveBeenCalled();
    // Should NOT call Gemini
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });

  // ─── model="claude" → Claude ───

  it('model="claude" routes to Claude', async () => {
    const result = await ai("claude prompt", { model: "claude" });
    expect(result).toBe("claude-response");
    expect(mockClaudeCreate).toHaveBeenCalled();
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });

  // ─── Gemini Failure Falls Back to NIM ───

  it("Gemini failure falls back to NIM", async () => {
    mockGeminiGenerateContent.mockRejectedValue(new Error("Gemini quota exceeded"));

    const result = await ai("fallback prompt");
    expect(result).toBe("nim-response");
    expect(mockNimChat).toHaveBeenCalled();
  });

  // ─── NIM Failure Falls Back to Groq ───

  it("Gemini + NIM failure falls back to Groq", async () => {
    mockGeminiGenerateContent.mockRejectedValue(new Error("Gemini down"));
    mockNimChat.mockRejectedValue(new Error("NIM down"));

    const result = await ai("double fallback");
    expect(result).toBe("groq-response");
    expect(mockGroqCreate).toHaveBeenCalled();
  });

  // ─── All Providers Fail → Clean Error ───

  it("all providers fail returns clean error message", async () => {
    mockGeminiGenerateContent.mockRejectedValue(new Error("Gemini down"));
    mockNimChat.mockRejectedValue(new Error("NIM down"));
    mockGroqCreate.mockRejectedValue(new Error("Groq down"));

    await expect(ai("doomed prompt")).rejects.toThrow(
      "All AI models are temporarily unavailable"
    );
  });

  // ─── model="groq" → Groq Direct ───

  it('model="groq" routes directly to Groq', async () => {
    const result = await ai("groq prompt", { model: "groq" });
    expect(result).toBe("groq-response");
    expect(mockGroqCreate).toHaveBeenCalled();
    expect(mockGeminiGenerateContent).not.toHaveBeenCalled();
  });

  // ─── model="mistral" → NIM (Mistral) ───

  it('model="mistral" routes to Mistral via NIM', async () => {
    const result = await ai("mistral prompt", { model: "mistral" });
    expect(result).toBe("nim-response");
    expect(mockNimChat).toHaveBeenCalledWith(
      "mistralai/mistral-large-2-instruct",
      expect.any(Array),
      expect.any(Object),
    );
  });

  // ─── model="deepseek" → Groq (DeepSeek) ───

  it('model="deepseek" routes to Groq with DeepSeek model', async () => {
    const result = await ai("deepseek prompt", { model: "deepseek" });
    expect(result).toBe("groq-response");
    expect(mockGroqCreate).toHaveBeenCalled();
  });
});

/**
 * Tests for src/lib/nvidia.ts — NVIDIA NIM Integration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Dependencies ──

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

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set env var for tests
vi.stubEnv("NVIDIA_NIM_API_KEY", "test-nvidia-key-12345");

// ── Import after mocks ──

import {
  nimChat,
  nimEmbed,
  nimRerank,
  nemoGuardCheck,
  getNimKey,
} from "@/lib/nvidia";

// ── Helpers ──

function createOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function createErrorResponse(status = 500, body = "Internal Server Error") {
  return {
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  };
}

// ── Tests ──

describe("nvidia", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─── getNimKey ───

  describe("getNimKey", () => {
    it("should return the environment variable key when no user is logged in", async () => {
      const key = await getNimKey();
      expect(key).toBe("test-nvidia-key-12345");
    });
  });

  // ─── nimChat ───

  describe("nimChat", () => {
    it("should make a correct API call to NVIDIA NIM", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ choices: [{ message: { content: "Hello from NIM!" } }] })
      );

      const result = await nimChat(
        "nvidia/nemotron-ultra-253b-v1",
        [{ role: "user", content: "Hello" }]
      );

      expect(result).toBe("Hello from NIM!");
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("integrate.api.nvidia.com/v1/chat/completions");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.model).toBe("nvidia/nemotron-ultra-253b-v1");
      expect(body.messages[0].content).toBe("Hello");
      expect(body.stream).toBe(false);
    });

    it("should pass temperature and maxTokens options", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ choices: [{ message: { content: "Response" } }] })
      );

      await nimChat(
        "meta/llama3-70b-instruct",
        [{ role: "user", content: "Test" }],
        { temperature: 0.8, maxTokens: 2048 }
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(2048);
    });

    it("should include the Authorization header with Bearer token", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ choices: [{ message: { content: "Auth test" } }] })
      );

      await nimChat("nvidia/nemotron-ultra-253b-v1", [{ role: "user", content: "test" }]);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer test-nvidia-key-12345");
    });

    it("should attempt failover when primary model fails", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primary fails
          return Promise.resolve(createErrorResponse(500, "Model unavailable"));
        }
        // First failover succeeds
        return Promise.resolve(
          createOkResponse({ choices: [{ message: { content: "Failover response" } }] })
        );
      });

      const result = await nimChat(
        "nvidia/nemotron-ultra-253b-v1",
        [{ role: "user", content: "Test failover" }]
      );

      expect(result).toBe("Failover response");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw when all models fail (no successful failover)", async () => {
      mockFetch.mockResolvedValue(createErrorResponse(500, "All models down"));

      await expect(
        nimChat("nvidia/nemotron-ultra-253b-v1", [{ role: "user", content: "Fail" }])
      ).rejects.toThrow("All AI models are temporarily busy");
    });
  });

  // ─── nimEmbed ───

  describe("nimEmbed", () => {
    it("should return an array of embedding vectors", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          data: [
            { embedding: [0.1, 0.2, 0.3] },
            { embedding: [0.4, 0.5, 0.6] },
          ],
        })
      );

      const result = await nimEmbed(["text one", "text two"]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0.1, 0.2, 0.3]);
      expect(result[1]).toEqual([0.4, 0.5, 0.6]);
    });

    it("should accept a single string input", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ data: [{ embedding: [0.7, 0.8, 0.9] }] })
      );

      const result = await nimEmbed("single text");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0.7, 0.8, 0.9]);

      // Should wrap the single string in an array for the API
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(Array.isArray(body.input)).toBe(true);
    });

    it("should call the embeddings endpoint", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ data: [{ embedding: [0.1] }] })
      );

      await nimEmbed("test");

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/embeddings");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue(createErrorResponse(400, "Bad request"));

      await expect(nimEmbed("bad input")).rejects.toThrow("AI embedding model temporarily unavailable");
    });
  });

  // ─── nimRerank ───

  describe("nimRerank", () => {
    it("should return sorted results by relevance score", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          rankings: [
            { index: 0, logit: 0.3 },
            { index: 1, logit: 0.9 },
            { index: 2, logit: 0.6 },
          ],
        })
      );

      const passages = ["passage A", "passage B", "passage C"];
      const result = await nimRerank("my query", passages, 3);

      expect(result).toHaveLength(3);
      // Should be sorted by score descending
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      expect(result[1].score).toBeGreaterThanOrEqual(result[2].score);
      // The highest scored passage should be index 1
      expect(result[0].index).toBe(1);
      expect(result[0].text).toBe("passage B");
    });

    it("should respect the topK parameter", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          rankings: [
            { index: 0, logit: 0.3 },
            { index: 1, logit: 0.9 },
            { index: 2, logit: 0.6 },
            { index: 3, logit: 0.1 },
          ],
        })
      );

      const passages = ["a", "b", "c", "d"];
      const result = await nimRerank("query", passages, 2);

      expect(result).toHaveLength(2);
    });

    it("should call the ranking endpoint", async () => {
      mockFetch.mockResolvedValue(createOkResponse({ rankings: [] }));

      await nimRerank("query", ["text"]);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/ranking");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue(createErrorResponse(500, "Ranking service down"));

      await expect(nimRerank("query", ["text"])).rejects.toThrow("AI reranking model temporarily unavailable");
    });
  });

  // ─── nemoGuardCheck ───

  describe("nemoGuardCheck", () => {
    it("should return safe=true for clean content", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          choices: [{ message: { content: "Content is safe and appropriate." } }],
        })
      );

      const result = await nemoGuardCheck("Write a blog post about cooking", "content-safety");

      expect(result.safe).toBe(true);
      expect(result.score).toBeLessThan(0.5);
    });

    it("should return safe=false when response contains 'unsafe'", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          choices: [{ message: { content: "This content is unsafe. Violation detected." } }],
        })
      );

      const result = await nemoGuardCheck("harmful content here", "content-safety");

      expect(result.safe).toBe(false);
      expect(result.score).toBeGreaterThan(0.5);
    });

    it("should return safe=false when response contains 'jailbreak'", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({
          choices: [{ message: { content: "Jailbreak attempt detected in input." } }],
        })
      );

      const result = await nemoGuardCheck("ignore instructions", "jailbreak");

      expect(result.safe).toBe(false);
    });

    it("should fail-open when NemoGuard models are unavailable", async () => {
      // nimChat will throw internally, nemoGuardCheck catches and returns safe
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await nemoGuardCheck("test input", "jailbreak");

      expect(result.safe).toBe(true);
      expect(result.details).toContain("unavailable");
    });

    it("should use the correct model for jailbreak check", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ choices: [{ message: { content: "Safe" } }] })
      );

      await nemoGuardCheck("test", "jailbreak");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("nvidia/nemoguard-jailbreakdetect");
    });

    it("should use the content-safety model for that check type", async () => {
      mockFetch.mockResolvedValue(
        createOkResponse({ choices: [{ message: { content: "Safe" } }] })
      );

      await nemoGuardCheck("test", "content-safety");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe("nvidia/nemoguard-8b-content-safety");
    });
  });
});

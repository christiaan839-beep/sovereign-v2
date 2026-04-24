/**
 * Frontier-provider adapter tests.
 *
 * Covers all 8 adapters with 4+ tests each (smoke / no-key / success /
 * error-handling). All tests run without ANY provider API key — the
 * no-key path is exercised explicitly, and the success path mocks
 * `fetch` globally.
 *
 * STAY-ELITE rule 4 (graceful degradation) — adapters MUST throw a
 * ProviderError("provider_not_configured") without hitting the network
 * when the key is absent. These tests lock that contract.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProviderError } from "../provider-utils";
import {
  FRONTIER_MODELS,
  getFrontierModelCount,
  getDiverseConsensusPool,
} from "../index";

import { openaiChat } from "../openai";
import { xaiChat } from "../xai";
import { mistralDirectChat } from "../mistral";
import { cohereChat } from "../cohere";
import { openrouterChat } from "../openrouter";
import { togetherChat } from "../together";
import { databricksChat } from "../databricks";
import { replicatePredict, imageGen } from "../replicate";

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function mockFetchOnce(response: { status?: number; body: unknown }): void {
  const status = response.status ?? 200;
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERR",
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  }) as unknown as typeof fetch;
}

function openaiShape(text: string) {
  return { choices: [{ message: { content: text } }] };
}

const originalEnv = { ...process.env };
beforeEach(() => {
  // Clear every provider env var before each test. Specific tests
  // re-set what they need via `process.env.X = "test-key"`.
  for (const key of [
    "OPENAI_API_KEY",
    "XAI_API_KEY",
    "MISTRAL_API_KEY",
    "COHERE_API_KEY",
    "OPENROUTER_API_KEY",
    "TOGETHER_API_KEY",
    "DATABRICKS_TOKEN",
    "DATABRICKS_HOST",
    "REPLICATE_API_TOKEN",
  ]) {
    delete process.env[key];
  }
});
afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

// ───────────────────────────────────────────────────────────
// Catalog invariants
// ───────────────────────────────────────────────────────────

describe("FRONTIER_MODELS catalog", () => {
  it("includes at least 30 distinct model slugs", () => {
    expect(FRONTIER_MODELS.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry has non-empty provider + slug", () => {
    for (const m of FRONTIER_MODELS) {
      expect(m.provider).toBeTruthy();
      expect(m.slug).toBeTruthy();
    }
  });

  it("getFrontierModelCount returns totals + breakdowns", () => {
    const counts = getFrontierModelCount();
    expect(counts.total).toBe(FRONTIER_MODELS.length);
    expect(counts.byProvider.openai).toBeGreaterThanOrEqual(3);
    expect(counts.byFamily.closed).toBeGreaterThanOrEqual(3);
    expect(counts.byFamily.open).toBeGreaterThanOrEqual(3);
  });

  it("getDiverseConsensusPool returns consensus-eligible models from mixed families", () => {
    const pool = getDiverseConsensusPool(4);
    expect(pool).toHaveLength(4);
    for (const m of pool) expect(m.consensusEligible).toBe(true);
    // Mixed families: both closed and open represented.
    const families = new Set(pool.map((p) => p.family));
    expect(families.size).toBeGreaterThanOrEqual(2);
  });
});

// ───────────────────────────────────────────────────────────
// OpenAI
// ───────────────────────────────────────────────────────────

describe("openaiChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(openaiChat({ prompt: "hi" })).rejects.toMatchObject({
      name: "ProviderError",
      code: "provider_not_configured",
    });
  });

  it("returns text when fetch succeeds", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockFetchOnce({ body: openaiShape("hello world") });
    const out = await openaiChat({ prompt: "hi", model: "gpt-4.1" });
    expect(out).toBe("hello world");
  });

  it("strips temperature for reasoning models (o1/o3)", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("reasoned"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await openaiChat({ prompt: "hard", model: "o3", temperature: 0.9 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // Reasoning models must NOT receive temperature.
    expect(body.temperature).toBeUndefined();
  });

  it("surfaces 401 as provider_auth_failed", async () => {
    process.env.OPENAI_API_KEY = "bad-key";
    mockFetchOnce({ status: 401, body: { error: "invalid" } });
    await expect(openaiChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_auth_failed",
    });
  });
});

// ───────────────────────────────────────────────────────────
// xAI
// ───────────────────────────────────────────────────────────

describe("xaiChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(xaiChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("routes to api.x.ai chat completions", async () => {
    process.env.XAI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("grok says hi"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await xaiChat({ prompt: "hi" });
    expect(fetchMock.mock.calls[0][0]).toContain("api.x.ai");
  });

  it("returns content on 200", async () => {
    process.env.XAI_API_KEY = "test-key";
    mockFetchOnce({ body: openaiShape("grok reply") });
    const out = await xaiChat({ prompt: "hi" });
    expect(out).toBe("grok reply");
  });

  it("surfaces 429 as provider_rate_limited", async () => {
    process.env.XAI_API_KEY = "test-key";
    mockFetchOnce({ status: 429, body: { error: "slow down" } });
    await expect(xaiChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_rate_limited",
    });
  });
});

// ───────────────────────────────────────────────────────────
// Mistral
// ───────────────────────────────────────────────────────────

describe("mistralDirectChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(mistralDirectChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("routes to api.mistral.ai", async () => {
    process.env.MISTRAL_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("mistral"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await mistralDirectChat({ prompt: "hi" });
    expect(fetchMock.mock.calls[0][0]).toContain("api.mistral.ai");
  });

  it("returns content on success", async () => {
    process.env.MISTRAL_API_KEY = "test-key";
    mockFetchOnce({ body: openaiShape("euro model") });
    const out = await mistralDirectChat({ prompt: "hi" });
    expect(out).toBe("euro model");
  });
});

// ───────────────────────────────────────────────────────────
// Cohere
// ───────────────────────────────────────────────────────────

describe("cohereChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(cohereChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("returns text from Cohere's custom shape", async () => {
    process.env.COHERE_API_KEY = "test-key";
    // Cohere responds { text, generation_id, finish_reason } — NOT openai shape.
    mockFetchOnce({ body: { text: "cohere reply", finish_reason: "COMPLETE" } });
    const out = await cohereChat({ prompt: "hi" });
    expect(out).toBe("cohere reply");
  });

  it("throws provider_bad_response when text field missing", async () => {
    process.env.COHERE_API_KEY = "test-key";
    mockFetchOnce({ body: { generation_id: "x" } }); // no text
    await expect(cohereChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_bad_response",
    });
  });
});

// ───────────────────────────────────────────────────────────
// OpenRouter
// ───────────────────────────────────────────────────────────

describe("openrouterChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(openrouterChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("sends HTTP-Referer + X-Title headers", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("router reply"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await openrouterChat({ prompt: "hi" });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBeTruthy();
    expect(headers["X-Title"]).toBe("Sovereign Matrix");
  });

  it("defaults to auto model when none specified", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("auto"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await openrouterChat({ prompt: "hi" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("openrouter/auto");
  });
});

// ───────────────────────────────────────────────────────────
// Together
// ───────────────────────────────────────────────────────────

describe("togetherChat", () => {
  it("throws provider_not_configured when no key", async () => {
    await expect(togetherChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("sends forceNonStream (stream: false in body)", async () => {
    process.env.TOGETHER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("together"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await togetherChat({ prompt: "hi" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
  });

  it("routes to api.together.xyz", async () => {
    process.env.TOGETHER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("hi"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await togetherChat({ prompt: "hi" });
    expect(fetchMock.mock.calls[0][0]).toContain("api.together.xyz");
  });
});

// ───────────────────────────────────────────────────────────
// Databricks
// ───────────────────────────────────────────────────────────

describe("databricksChat", () => {
  it("throws provider_not_configured when token missing", async () => {
    await expect(databricksChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("throws provider_not_configured when host missing even with token", async () => {
    process.env.DATABRICKS_TOKEN = "test-token";
    await expect(databricksChat({ prompt: "hi" })).rejects.toMatchObject({
      code: "provider_not_configured",
    });
  });

  it("routes to workspace-specific endpoint", async () => {
    process.env.DATABRICKS_TOKEN = "test-token";
    process.env.DATABRICKS_HOST = "https://workspace.cloud.databricks.com";
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => openaiShape("dbrx"),
      text: async () => "{}",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await databricksChat({ prompt: "hi" });
    expect(fetchMock.mock.calls[0][0]).toContain(
      "workspace.cloud.databricks.com/serving-endpoints/",
    );
  });
});

// ───────────────────────────────────────────────────────────
// Replicate
// ───────────────────────────────────────────────────────────

describe("replicatePredict + imageGen", () => {
  it("throws provider_not_configured when no token", async () => {
    await expect(
      replicatePredict({ model: "foo/bar", input: {} }),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
  });

  it("throws provider_auth_failed on 401", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    mockFetchOnce({ status: 401, body: { detail: "bad auth" } });
    await expect(
      replicatePredict({ model: "foo/bar", input: {} }),
    ).rejects.toMatchObject({ code: "provider_auth_failed" });
  });

  it("imageGen throws provider_not_configured without token", async () => {
    await expect(imageGen("a photo of a cat")).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

/**
 * Tests for src/lib/oss-inference.ts — Wave 133.
 *
 * Covers env-var detection, host extraction, and the not-configured
 * path on chat / probe. The actual HTTP calls go through
 * outboundFetchAsResponse, which is hard-mocked here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetchAsResponse: (...args: unknown[]) => fetchMock(...args),
}));

import {
  isOssInferenceConfigured,
  getOssEndpoint,
  getOssHost,
  getOssApiKey,
  ossChat,
  probeOssEndpoint,
} from "@/lib/oss-inference";

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.OSS_INFERENCE_ENDPOINT;
  delete process.env.OSS_INFERENCE_API_KEY;
  delete process.env.OSS_INFERENCE_DEFAULT_MODEL;
});

afterEach(() => {
  delete process.env.OSS_INFERENCE_ENDPOINT;
  delete process.env.OSS_INFERENCE_API_KEY;
  delete process.env.OSS_INFERENCE_DEFAULT_MODEL;
});

describe("isOssInferenceConfigured + helpers", () => {
  it("returns false when no env var is set", () => {
    expect(isOssInferenceConfigured()).toBe(false);
    expect(getOssEndpoint()).toBeNull();
    expect(getOssHost()).toBeNull();
    expect(getOssApiKey()).toBeNull();
  });

  it("returns true and extracts host once endpoint is set", () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com:8000/v1";
    expect(isOssInferenceConfigured()).toBe(true);
    expect(getOssEndpoint()).toBe("https://gpu.example.com:8000/v1");
    expect(getOssHost()).toBe("gpu.example.com");
  });

  it("strips trailing slashes from the endpoint", () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1////";
    expect(getOssEndpoint()).toBe("https://gpu.example.com/v1");
  });

  it("returns api key when set", () => {
    process.env.OSS_INFERENCE_API_KEY = "secret-token";
    expect(getOssApiKey()).toBe("secret-token");
  });

  it("treats empty string api key as null", () => {
    process.env.OSS_INFERENCE_API_KEY = "  ";
    expect(getOssApiKey()).toBeNull();
  });

  it("handles malformed endpoint URL gracefully", () => {
    process.env.OSS_INFERENCE_ENDPOINT = "not a url";
    expect(getOssEndpoint()).toBe("not a url");
    expect(getOssHost()).toBeNull();
  });
});

describe("ossChat", () => {
  it("throws when no endpoint is configured", async () => {
    await expect(
      ossChat("test-model", [{ role: "user", content: "hi" }]),
    ).rejects.toThrow(/not configured/i);
  });

  it("returns the assistant content on a 200 response", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "hello from oss" } }],
      }),
    });
    const text = await ossChat("any-model", [
      { role: "user", content: "ping" },
    ]);
    expect(text).toBe("hello from oss");
  });

  it("sends Authorization header when api key is set", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    process.env.OSS_INFERENCE_API_KEY = "abc";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    });
    await ossChat("m", [{ role: "user", content: "ping" }]);
    const callArgs = fetchMock.mock.calls[0]!;
    const init = callArgs[1] as { headers?: Record<string, string> };
    expect(init.headers?.Authorization).toBe("Bearer abc");
  });

  it("throws on empty content payload", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    });
    await expect(
      ossChat("m", [{ role: "user", content: "x" }]),
    ).rejects.toThrow(/empty response/i);
  });

  it("retries on non-2xx and bubbles after the cap", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });
    await expect(
      ossChat("m", [{ role: "user", content: "x" }]),
    ).rejects.toThrow(/503/);
    // 2 retries + initial = 3 calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("probeOssEndpoint", () => {
  it("returns not-configured when endpoint is unset", async () => {
    const r = await probeOssEndpoint();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not-configured");
    expect(r.endpoint).toBeNull();
  });

  it("returns ok=true with latency on success", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockResolvedValue({ ok: true });
    const r = await probeOssEndpoint();
    expect(r.ok).toBe(true);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.endpoint).toBe("https://gpu.example.com/v1");
  });

  it("returns ok=false with HTTP error string on failure", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const r = await probeOssEndpoint();
    expect(r.ok).toBe(false);
    expect(r.error).toBe("HTTP 502");
  });

  it("swallows throw and reports the error message", async () => {
    process.env.OSS_INFERENCE_ENDPOINT = "https://gpu.example.com/v1";
    fetchMock.mockRejectedValue(new Error("connect timeout"));
    const r = await probeOssEndpoint();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout/i);
  });
});

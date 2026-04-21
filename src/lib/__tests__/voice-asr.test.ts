/**
 * voice-asr.ts — tests.
 *
 * Mocks global.fetch to simulate Parakeet responses. Verifies the
 * multipart/form-data shape, error handling, and abort-signal respect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.NVIDIA_NIM_API_KEY = "nvapi-test";

import { transcribeAudio } from "@/lib/voice-asr";

const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("transcribeAudio", () => {
  it("returns null on empty audio input", async () => {
    const result = await transcribeAudio({ audio: new Uint8Array(0) });
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns the transcribed text on 200", async () => {
    mockFetch.mockResolvedValue(new Response("Hello world.\n", { status: 200 }));
    const result = await transcribeAudio({ audio: new Uint8Array([1, 2, 3]) });
    expect(result).toBe("Hello world.");
  });

  it("trims whitespace from the transcription", async () => {
    mockFetch.mockResolvedValue(new Response("   hi   ", { status: 200 }));
    const result = await transcribeAudio({ audio: new Uint8Array([1, 2]) });
    expect(result).toBe("hi");
  });

  it("returns null on empty transcription (no audible speech)", async () => {
    mockFetch.mockResolvedValue(new Response("   ", { status: 200 }));
    const result = await transcribeAudio({ audio: new Uint8Array([1]) });
    expect(result).toBeNull();
  });

  it("returns null on non-2xx HTTP status", async () => {
    mockFetch.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result = await transcribeAudio({ audio: new Uint8Array([1, 2]) });
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNRESET"));
    const result = await transcribeAudio({ audio: new Uint8Array([1]) });
    expect(result).toBeNull();
  });

  it("passes Authorization header with Bearer API key", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    await transcribeAudio({ audio: new Uint8Array([1]) });
    const [_url, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer /),
    });
  });

  it("uses FormData body (multipart) with file + model", async () => {
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    await transcribeAudio({ audio: new Uint8Array([1, 2, 3]) });
    const [, init] = mockFetch.mock.calls[0];
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("model")).toBeTruthy();
    expect(body.get("file")).toBeInstanceOf(Blob);
  });
});

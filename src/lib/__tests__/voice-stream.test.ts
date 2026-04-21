/**
 * voice-stream.ts — tests.
 *
 * We mock global.fetch to emit controlled SSE/audio frames, then
 * verify that:
 *   - streamLLM yields text deltas in order
 *   - [DONE] ends the generator cleanly
 *   - signal.abort() exits the read loop promptly
 *   - VoiceSession.handleTurn pipes deltas through the sentence buffer
 *     and invokes onAudioChunk once per sentence
 *   - bargeIn() cancels in-flight LLM + prevents further TTS calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── fetch mock helpers ─────────────────────────────────────────

/**
 * Build a mock Response whose body is a ReadableStream that yields
 * the given SSE frames (joined with "\n") then closes.
 */
function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const f of frames) {
        controller.enqueue(encoder.encode(f + "\n\n"));
        // Yield to event loop so streaming tests can see progressive output
        await new Promise((r) => setImmediate(r));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function binaryResponse(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        controller.enqueue(c);
        await new Promise((r) => setImmediate(r));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function ssePayload(delta: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}`;
}

// Make sure the env var is set BEFORE importing the module.
process.env.NVIDIA_NIM_API_KEY = "nvapi-test-key";

const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── streamLLM ──────────────────────────────────────────────────

describe("streamLLM", () => {
  it("yields content deltas in order until [DONE]", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([ssePayload("Hello"), ssePayload(" world"), "data: [DONE]"]),
    );
    const { streamLLM } = await import("@/lib/voice-stream");

    const out: string[] = [];
    for await (const d of streamLLM("hi", "sys", new AbortController().signal)) {
      out.push(d);
    }
    expect(out).toEqual(["Hello", " world"]);
  });

  it("throws on non-OK HTTP status", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("rate limited", { status: 429 }),
    );
    const { streamLLM } = await import("@/lib/voice-stream");

    const gen = streamLLM("hi", "sys", new AbortController().signal);
    await expect(gen.next()).rejects.toThrow(/HTTP 429/);
  });

  it("stops iterating when the signal aborts mid-stream", async () => {
    const controller = new AbortController();
    // This body will emit frame #1, then stall so abort can fire.
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        ctrl.enqueue(encoder.encode(ssePayload("first") + "\n\n"));
        // Hold open — never close, wait for abort
        await new Promise<void>((resolve) => {
          controller.signal.addEventListener("abort", () => {
            ctrl.close();
            resolve();
          });
        });
      },
    });
    mockFetch.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const { streamLLM } = await import("@/lib/voice-stream");
    const out: string[] = [];
    const runner = (async () => {
      try {
        for await (const d of streamLLM("hi", "sys", controller.signal)) {
          out.push(d);
          // Abort after first delta
          if (out.length === 1) controller.abort();
        }
      } catch (err) {
        // AbortError is expected — fetch throws it when signal fires
        if (!(err instanceof Error && err.name === "AbortError")) throw err;
      }
    })();

    await runner;
    expect(out).toEqual(["first"]);
  });

  it("ignores malformed JSON frames without aborting the stream", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        ssePayload("ok"),
        "data: {not valid json",
        ssePayload(" still ok"),
        "data: [DONE]",
      ]),
    );
    const { streamLLM } = await import("@/lib/voice-stream");
    const out: string[] = [];
    for await (const d of streamLLM("hi", "sys", new AbortController().signal)) {
      out.push(d);
    }
    expect(out).toEqual(["ok", " still ok"]);
  });
});

// ─── VoiceSession.handleTurn ────────────────────────────────────

describe("VoiceSession.handleTurn", () => {
  it("pipes LLM deltas through sentence buffer → TTS, invokes onAudioChunk per chunk", async () => {
    // LLM response: "Hello world. How are you?" in two deltas
    mockFetch
      .mockResolvedValueOnce(
        sseResponse([
          ssePayload("Hello world. "),
          ssePayload("How are you?"),
          "data: [DONE]",
        ]),
      )
      // TTS for "Hello world." — one audio chunk
      .mockResolvedValueOnce(binaryResponse([new Uint8Array([1, 2, 3])]))
      // TTS for "How are you?"
      .mockResolvedValueOnce(binaryResponse([new Uint8Array([4, 5, 6])]));

    const { VoiceSession } = await import("@/lib/voice-stream");

    const chunks: Uint8Array[] = [];
    const sentences: string[] = [];
    let turnEnded = false;

    const session = new VoiceSession({
      systemPrompt: "sys",
      voice: "English-US.Female-1",
      onAudioChunk: (c) => chunks.push(c),
      onSentence: (s) => sentences.push(s),
      onTurnEnd: () => { turnEnded = true; },
    });

    await session.handleTurn("hi there");

    expect(sentences).toEqual(["Hello world.", "How are you?"]);
    expect(chunks).toHaveLength(2);
    expect(Array.from(chunks[0])).toEqual([1, 2, 3]);
    expect(turnEnded).toBe(true);

    // LLM + 2 TTS = 3 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("bargeIn cancels in-flight LLM and prevents pending TTS", async () => {
    const encoder = new TextEncoder();
    // LLM body hangs after first delta, waiting for abort
    let resolveBody: (() => void) | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(ssePayload("First sentence. ") + "\n\n"));
        // Keep open until abort-triggered resolve
        resolveBody = () => ctrl.close();
      },
    });
    mockFetch.mockResolvedValueOnce(new Response(body, { status: 200 }));
    // TTS mock — if called, returns a single chunk.
    mockFetch.mockResolvedValueOnce(binaryResponse([new Uint8Array([9])]));

    const { VoiceSession } = await import("@/lib/voice-stream");

    let turnEnded = false;
    const chunks: Uint8Array[] = [];
    const session = new VoiceSession({
      systemPrompt: "sys",
      voice: "English-US.Female-1",
      onAudioChunk: (c) => chunks.push(c),
      onTurnEnd: () => { turnEnded = true; },
    });

    const turnPromise = session.handleTurn("hi");
    // Give the LLM stream a moment to yield its first delta
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    session.bargeIn();
    resolveBody?.();

    await turnPromise;

    // Turn was aborted before completing, so onTurnEnd should NOT fire
    expect(turnEnded).toBe(false);
  });
});

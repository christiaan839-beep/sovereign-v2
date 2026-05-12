/**
 * Tests for src/lib/streaming.ts — Cook 39 SSE contracts.
 *
 *   - encodeEvent: emits correct SSE frame format (event:, data:, blank line).
 *   - convenience helpers (tokenEvent, progressEvent, etc.) round-trip
 *     through parseEvents().
 *   - buildSSE / streamResponse:
 *       - emits every event the producer enqueues
 *       - calls producer with isAborted()=false until signal trips
 *       - surfaces producer exceptions as an `error` frame and closes
 *       - sets the SSE headers (no-cache, text/event-stream, etc.)
 *   - parseEvents drops malformed frames without throwing.
 */

import { describe, it, expect, vi } from "vitest";
import {
  encodeEvent,
  tokenEvent,
  progressEvent,
  doneEvent,
  errorEvent,
  buildSSE,
  streamResponse,
  parseEvents,
  SSE_HEADERS,
} from "../streaming";

const decoder = new TextDecoder();

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  let raw = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  return raw;
}

describe("encodeEvent", () => {
  it("emits the SSE wire format (event:, data:, blank line)", () => {
    const bytes = encodeEvent({ event: "token", data: { value: "hi" } });
    const text = decoder.decode(bytes);
    expect(text.startsWith("event: token\n")).toBe(true);
    expect(text).toContain('data: {"value":"hi"}');
    expect(text.endsWith("\n\n")).toBe(true);
  });

  it("includes the id field when provided", () => {
    const bytes = encodeEvent({
      event: "token",
      data: { value: "x" },
      id: "frame-7",
    });
    expect(decoder.decode(bytes)).toContain("id: frame-7\n");
  });
});

describe("convenience encoders", () => {
  it("each helper produces a parseable event", () => {
    const raw = [
      tokenEvent("hello"),
      progressEvent("1/3", "safety check"),
      doneEvent({ finalAnswer: "complete" }),
      errorEvent("things broke"),
    ]
      .map((b) => decoder.decode(b))
      .join("");
    const events = parseEvents(raw);
    expect(events.map((e) => e.event)).toEqual([
      "token",
      "progress",
      "done",
      "error",
    ]);
    expect(events[0].data).toEqual({ value: "hello" });
    expect(events[1].data).toEqual({ step: "1/3", label: "safety check" });
  });
});

describe("buildSSE / streamResponse", () => {
  it("emits every event the producer enqueues, then closes the stream", async () => {
    const stream = buildSSE(async (emit) => {
      emit({ event: "token", data: { value: "a" } });
      emit({ event: "token", data: { value: "b" } });
      emit({ event: "done", data: { finalAnswer: "ab" } });
    });
    const raw = await collect(stream);
    const events = parseEvents(raw);
    expect(events).toHaveLength(3);
    expect(events.at(-1)?.event).toBe("done");
  });

  it("emits an `error` frame and closes when the producer throws", async () => {
    const stream = buildSSE(async (emit) => {
      emit({ event: "token", data: { value: "a" } });
      throw new Error("producer fail");
    });
    const raw = await collect(stream);
    const events = parseEvents(raw);
    expect(events.map((e) => e.event)).toContain("error");
    const err = events.find((e) => e.event === "error");
    expect((err?.data as { message: string }).message).toContain(
      "producer fail",
    );
  });

  it("respects an aborted signal — emit() becomes a no-op after abort", async () => {
    const controller = new AbortController();
    const stream = buildSSE(
      async (emit, isAborted) => {
        emit({ event: "token", data: { value: "first" } });
        controller.abort();
        // Give the abort listener a microtask to flip the flag.
        await Promise.resolve();
        expect(isAborted()).toBe(true);
        emit({ event: "token", data: { value: "second" } }); // dropped
      },
      { signal: controller.signal },
    );
    const raw = await collect(stream);
    const events = parseEvents(raw);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ value: "first" });
  });

  it("streamResponse() sets the SSE headers required to survive proxies", () => {
    const res = streamResponse(async (emit) => {
      emit({ event: "done", data: {} });
    });
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect((SSE_HEADERS as Record<string, string>)["Content-Type"]).toBe(
      "text/event-stream",
    );
  });

  it("the producer can read and react to isAborted()", async () => {
    const controller = new AbortController();
    const producer = vi.fn(async (emit, isAborted) => {
      emit({ event: "progress", data: { step: "1" } });
      controller.abort();
      await Promise.resolve();
      if (!isAborted()) emit({ event: "progress", data: { step: "2" } });
    });
    const stream = buildSSE(producer, { signal: controller.signal });
    await collect(stream);
    expect(producer).toHaveBeenCalled();
  });
});

describe("parseEvents", () => {
  it("returns [] for empty input", () => {
    expect(parseEvents("")).toEqual([]);
  });

  it("drops malformed frames", () => {
    const raw =
      'event: token\ndata: {"value":"ok"}\n\nthis_is_garbage\n\nevent: done\ndata: {}\n\n';
    const events = parseEvents(raw);
    expect(events.map((e) => e.event)).toEqual(["token", "done"]);
  });

  it("falls back to raw string when data isn't valid JSON", () => {
    const raw = "event: token\ndata: not-json\n\n";
    const events = parseEvents(raw);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("not-json");
  });
});

/**
 * Tests for src/lib/streaming-agent.ts — Cook 113.
 */

import { describe, it, expect, vi } from "vitest";
import { parseEvents } from "../streaming";
import { pipeTokens, streamAgentResponse } from "../streaming-agent";

const decoder = new TextDecoder();

async function collect(res: Response): Promise<string> {
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  let raw = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  return raw;
}

describe("streamAgentResponse — lifecycle", () => {
  it("emits a heartbeat progress event before the producer runs", async () => {
    const res = streamAgentResponse(async (ctx) => {
      ctx.done({ ok: true });
    });
    const raw = await collect(res);
    const events = parseEvents(raw);
    expect(events[0].event).toBe("progress");
    expect(events[events.length - 1].event).toBe("done");
  });

  it("sets the SSE headers", () => {
    const res = streamAgentResponse(async (ctx) => {
      ctx.done({});
    });
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("exposes token / progress / tool / done convenience helpers", async () => {
    const res = streamAgentResponse(async (ctx) => {
      ctx.token("hello");
      ctx.tool({ outcome: "ok", tool: "x" });
      ctx.done({ receiptId: "rcpt-1" });
    });
    const events = parseEvents(await collect(res));
    const kinds = events.map((e) => e.event);
    expect(kinds).toContain("token");
    expect(kinds).toContain("tool");
    expect(kinds).toContain("done");
  });

  it("converts an unhandled throw into a structured error frame", async () => {
    const res = streamAgentResponse(async () => {
      throw new Error("kaboom");
    });
    const events = parseEvents(await collect(res));
    const err = events.find((e) => e.event === "error");
    expect(err).toBeDefined();
    expect((err?.data as { message: string }).message).toContain("kaboom");
  });
});

describe("pipeTokens", () => {
  it("forwards each token to ctx.token and returns the joined buffer", async () => {
    const tokens: string[] = [];
    const ctx = {
      emit: vi.fn(),
      isAborted: () => false,
      token: (v: string) => tokens.push(v),
      progress: vi.fn(),
      tool: vi.fn(),
      done: vi.fn(),
    };
    async function* gen() {
      yield "Hello ";
      yield "world!";
    }
    const buf = await pipeTokens(ctx, gen());
    expect(buf).toBe("Hello world!");
    expect(tokens).toEqual(["Hello ", "world!"]);
  });

  it("stops on abort", async () => {
    let aborted = false;
    const ctx = {
      emit: vi.fn(),
      isAborted: () => aborted,
      token: vi.fn(),
      progress: vi.fn(),
      tool: vi.fn(),
      done: vi.fn(),
    };
    async function* gen() {
      yield "first";
      aborted = true;
      yield "second";
    }
    const buf = await pipeTokens(ctx, gen());
    expect(buf).toBe("first");
  });
});

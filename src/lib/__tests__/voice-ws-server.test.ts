/**
 * voice-ws-server.ts — tests.
 *
 * Uses a MockWs that matches the WsLike interface. Drives the protocol
 * end-to-end: auth → turn-end → audio chunks flow back → barge-in →
 * close → bill settlement.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const { mockReleaseHold, mockCaptureHold, mockHandleTurn, mockBargeIn, mockTranscribe } = vi.hoisted(() => ({
  mockReleaseHold: vi.fn(),
  mockCaptureHold: vi.fn(),
  mockHandleTurn: vi.fn(),
  mockBargeIn: vi.fn(),
  mockTranscribe: vi.fn(),
}));

vi.mock("@/lib/credits", () => ({
  releaseHold: mockReleaseHold,
  captureHold: mockCaptureHold,
}));

vi.mock("@/lib/voice-stream", () => {
  class VoiceSession {
    constructor(public opts: unknown) {}
    handleTurn = mockHandleTurn;
    bargeIn = mockBargeIn;
  }
  return { VoiceSession };
});

vi.mock("@/lib/voice-asr", () => ({ transcribeAudio: mockTranscribe }));

process.env.VOICE_SESSION_SECRET = "x".repeat(32);

import { handleVoiceWs } from "@/lib/voice-ws-server";
import { signVoiceToken } from "@/lib/voice-token";

class MockWs extends EventEmitter {
  sent: string[] = [];
  closed = false;
  closeCode: number | undefined;

  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number, _reason?: string): void {
    this.closed = true;
    this.closeCode = code;
    // Emit close event for the handler to see
    setImmediate(() => this.emit("close"));
  }
  // EventEmitter already implements .on
}

function makeToken(overrides: Partial<{ userId: string; personaId: string; holdId: string }> = {}) {
  return signVoiceToken(
    {
      userId: overrides.userId ?? "u_1",
      personaId: overrides.personaId ?? "default",
      holdId: overrides.holdId ?? "hold_1",
      exp: Math.floor(Date.now() / 1000) + 60,
    },
    process.env.VOICE_SESSION_SECRET!,
  );
}

async function settle(): Promise<void> {
  // Drain the microtask + setImmediate queues
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  mockReleaseHold.mockReset();
  mockCaptureHold.mockReset();
  mockHandleTurn.mockReset();
  mockBargeIn.mockReset();
  mockTranscribe.mockReset();
  mockReleaseHold.mockResolvedValue(undefined);
  mockHandleTurn.mockResolvedValue(undefined);
});

describe("handleVoiceWs", () => {
  it("closes with 1008 when first message is not auth", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "turn-end", transcript: "hi" }));
    await done;

    expect(ws.closed).toBe(true);
    expect(ws.closeCode).toBe(1008);
  });

  it("closes with 1008 on bad token", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: "invalid.token" }));
    await done;

    expect(ws.closed).toBe(true);
    expect(ws.closeCode).toBe(1008);
  });

  it("sends { type: 'ready' } after successful auth", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    const ready = ws.sent.map((s) => JSON.parse(s)).find((m) => m.type === "ready");
    expect(ready).toBeTruthy();
    expect(ready.personaId).toBe("default");

    // Clean close
    ws.emit("close");
    await done;
  });

  it("routes turn-end to VoiceSession.handleTurn", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    ws.emit("message", JSON.stringify({ type: "turn-end", transcript: "hello there" }));
    await settle();

    expect(mockHandleTurn).toHaveBeenCalledWith("hello there");

    ws.emit("close");
    await done;
  });

  it("rejects empty turn-end transcript", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();
    ws.sent = []; // drop the "ready" message for a cleaner assert

    ws.emit("message", JSON.stringify({ type: "turn-end", transcript: "" }));
    await settle();

    const err = ws.sent.map((s) => JSON.parse(s)).find((m) => m.type === "error");
    expect(err).toBeTruthy();
    expect(mockHandleTurn).not.toHaveBeenCalled();

    ws.emit("close");
    await done;
  });

  it("routes barge-in to VoiceSession.bargeIn", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    ws.emit("message", JSON.stringify({ type: "barge-in" }));
    await settle();

    expect(mockBargeIn).toHaveBeenCalled();

    ws.emit("close");
    await done;
  });

  it("releases the hold when the session ends", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken({ holdId: "hold_xyz" }) }));
    await settle();

    ws.emit("close");
    await done;

    expect(mockReleaseHold).toHaveBeenCalledWith("hold_xyz");
  });

  it("calls billOnClose with secondsUsed when provided", async () => {
    const billOnClose = vi.fn().mockResolvedValue(undefined);
    const ws = new MockWs();
    const done = handleVoiceWs(ws, {
      secret: process.env.VOICE_SESSION_SECRET!,
      billOnClose,
    });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    ws.emit("close");
    await done;

    expect(billOnClose).toHaveBeenCalledTimes(1);
    const [payload, seconds] = billOnClose.mock.calls[0];
    expect(payload.holdId).toBe("hold_1");
    expect(typeof seconds).toBe("number");
    expect(seconds).toBeGreaterThanOrEqual(0);
  });

  it("sends error on malformed JSON", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();
    ws.sent = [];

    ws.emit("message", "{ not json");
    await settle();

    const err = ws.sent.map((s) => JSON.parse(s)).find((m) => m.type === "error");
    expect(err?.message).toMatch(/JSON/);

    ws.emit("close");
    await done;
  });

  it("close message from client triggers normal close", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    ws.emit("message", JSON.stringify({ type: "close" }));
    await done;

    expect(ws.closeCode).toBe(1000);
  });

  // L1.7 — audio-chunk + audio-end flow
  it("audio-chunk buffers, audio-end transcribes and routes to handleTurn", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();
    ws.sent = [];

    mockTranscribe.mockResolvedValue("hello there");

    // Send two fake base64 chunks
    ws.emit("message", JSON.stringify({ type: "audio-chunk", chunk: "AAEC" }));
    ws.emit("message", JSON.stringify({ type: "audio-chunk", chunk: "AwQF" }));
    ws.emit("message", JSON.stringify({ type: "audio-end" }));
    await settle();
    await settle();

    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockHandleTurn).toHaveBeenCalledWith("hello there");

    const messages = ws.sent.map((s) => JSON.parse(s));
    expect(messages.some((m) => m.type === "transcribing")).toBe(true);
    expect(messages.some((m) => m.type === "transcript" && m.text === "hello there")).toBe(true);

    ws.emit("close");
    await done;
  });

  it("audio-end with empty buffer is a silent no-op", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();
    ws.sent = [];

    ws.emit("message", JSON.stringify({ type: "audio-end" }));
    await settle();

    expect(mockTranscribe).not.toHaveBeenCalled();
    expect(mockHandleTurn).not.toHaveBeenCalled();

    ws.emit("close");
    await done;
  });

  it("audio-end with null transcription (no audible speech) surfaces error", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();
    ws.sent = [];

    mockTranscribe.mockResolvedValue(null);
    ws.emit("message", JSON.stringify({ type: "audio-chunk", chunk: "AAEC" }));
    ws.emit("message", JSON.stringify({ type: "audio-end" }));
    await settle();
    await settle();

    const messages = ws.sent.map((s) => JSON.parse(s));
    expect(messages.some((m) => m.type === "error")).toBe(true);
    expect(mockHandleTurn).not.toHaveBeenCalled();

    ws.emit("close");
    await done;
  });

  it("barge-in clears buffered audio chunks", async () => {
    const ws = new MockWs();
    const done = handleVoiceWs(ws, { secret: process.env.VOICE_SESSION_SECRET! });

    ws.emit("message", JSON.stringify({ type: "auth", token: makeToken() }));
    await settle();

    ws.emit("message", JSON.stringify({ type: "audio-chunk", chunk: "AAEC" }));
    ws.emit("message", JSON.stringify({ type: "barge-in" }));
    ws.emit("message", JSON.stringify({ type: "audio-end" }));
    await settle();

    // Barge-in drops the buffer, so audio-end is a no-op.
    expect(mockTranscribe).not.toHaveBeenCalled();
    expect(mockBargeIn).toHaveBeenCalled();

    ws.emit("close");
    await done;
  });
});

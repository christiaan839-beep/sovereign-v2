/**
 * Tests for src/lib/voice-loop.ts — Cook 60 voice round-trip.
 *
 *   - Rejects unsupported MIME with audio-too-large.
 *   - Rejects oversize audio.
 *   - asr-empty when transcript is whitespace-only.
 *   - asr-low-confidence when below threshold.
 *   - transcript-too-long when over the cap.
 *   - agent-failed when the agent runner throws.
 *   - tts-failed when the synthesizer throws.
 *   - happy path returns full transcript + reply + audio + timings.
 */

import { describe, it, expect, vi } from "vitest";
import {
  runVoiceLoop,
  VOICE_LOOP_CONSTANTS,
  type VoiceLoopDeps,
  type AudioBlob,
} from "../voice-loop";

function audio(mime: string, size: number): AudioBlob {
  return { mime, payload: new Uint8Array(size).fill(7) };
}

function depsFor({
  text = "hello world",
  confidence = 1,
  reply = "hi back",
}: { text?: string; confidence?: number; reply?: string } = {}): VoiceLoopDeps {
  return {
    asr: vi.fn().mockResolvedValue({ text, confidence }),
    runAgent: vi.fn().mockResolvedValue(reply),
    tts: vi.fn().mockResolvedValue({
      mime: "audio/mpeg",
      payload: new Uint8Array([1, 2, 3]),
    }),
  };
}

describe("runVoiceLoop — input gating", () => {
  it("rejects unsupported MIME type", async () => {
    const out = await runVoiceLoop(
      { audio: audio("video/mp4", 100) },
      depsFor(),
    );
    expect(out.ok).toBe(false);
    expect(out.failure).toBe("audio-too-large");
  });

  it("rejects oversize audio", async () => {
    const out = await runVoiceLoop(
      {
        audio: audio("audio/wav", VOICE_LOOP_CONSTANTS.DEFAULT_MAX_AUDIO + 1),
      },
      depsFor(),
    );
    expect(out.failure).toBe("audio-too-large");
  });
});

describe("runVoiceLoop — ASR failure paths", () => {
  it("asr-failed when the ASR throws", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000) },
      {
        asr: vi.fn().mockRejectedValue(new Error("boom")),
        runAgent: vi.fn(),
        tts: vi.fn(),
      },
    );
    expect(out.failure).toBe("asr-failed");
    expect(out.error).toContain("boom");
  });

  it("asr-empty when transcript is whitespace only", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000) },
      depsFor({ text: "   " }),
    );
    expect(out.failure).toBe("asr-empty");
  });

  it("asr-low-confidence when below threshold", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000), minAsrConfidence: 0.9 },
      depsFor({ confidence: 0.5 }),
    );
    expect(out.failure).toBe("asr-low-confidence");
  });

  it("transcript-too-long when over cap", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000), maxAsrChars: 10 },
      depsFor({ text: "x".repeat(50) }),
    );
    expect(out.failure).toBe("transcript-too-long");
  });
});

describe("runVoiceLoop — agent + TTS failures", () => {
  it("agent-failed when the agent throws", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000) },
      {
        asr: vi.fn().mockResolvedValue({ text: "hi" }),
        runAgent: vi.fn().mockRejectedValue(new Error("agent down")),
        tts: vi.fn(),
      },
    );
    expect(out.failure).toBe("agent-failed");
    expect(out.error).toContain("agent down");
  });

  it("tts-failed when synthesizer throws but preserves transcript + reply", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000) },
      {
        asr: vi.fn().mockResolvedValue({ text: "hi" }),
        runAgent: vi.fn().mockResolvedValue("there"),
        tts: vi.fn().mockRejectedValue(new Error("no voice")),
      },
    );
    expect(out.failure).toBe("tts-failed");
    expect(out.transcript).toBe("hi");
    expect(out.reply).toBe("there");
  });
});

describe("runVoiceLoop — happy path", () => {
  it("returns transcript + reply + audio + timings", async () => {
    const deps = depsFor({ text: "hi", reply: "there" });
    const out = await runVoiceLoop({ audio: audio("audio/wav", 1000) }, deps);
    expect(out.ok).toBe(true);
    expect(out.transcript).toBe("hi");
    expect(out.reply).toBe("there");
    expect(out.replyAudio?.mime).toBe("audio/mpeg");
    expect(out.timings).toHaveProperty("asrMs");
    expect(out.timings).toHaveProperty("agentMs");
    expect(out.timings).toHaveProperty("ttsMs");
  });

  it("calls each dep exactly once on happy path", async () => {
    const deps = depsFor();
    await runVoiceLoop({ audio: audio("audio/wav", 1000) }, deps);
    expect(deps.asr).toHaveBeenCalledTimes(1);
    expect(deps.runAgent).toHaveBeenCalledTimes(1);
    expect(deps.tts).toHaveBeenCalledTimes(1);
  });

  it("returns a JSON-serializable outcome", async () => {
    const out = await runVoiceLoop(
      { audio: audio("audio/wav", 1000) },
      depsFor(),
    );
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
  });
});

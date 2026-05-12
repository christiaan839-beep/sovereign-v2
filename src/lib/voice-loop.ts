/**
 * SOVEREIGN MATRIX — Voice ASR + TTS round-trip (Cook 60 / Tier 2 #7)
 *
 * "Talk to your data-entry clerk." Composes three side-effecting
 * pieces the platform already has:
 *
 *   1. ASR — speech → text (Groq Whisper, ElevenLabs, etc.)
 *   2. Agent — text-in / text-out (super-agent, AGENT_REGISTRY)
 *   3. TTS — text → speech (Chatterbox, ElevenLabs, browser SpeechSynthesis)
 *
 * Pure orchestrator: caller injects every side-effecting dependency
 * via `VoiceLoopDeps`. The module sequences them, enforces input
 * caps, surfaces structured failure for receipt embedding, and
 * tracks per-stage latency.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface AudioBlob {
  /** Validated MIME type (audio/wav, audio/mp4, audio/webm, audio/ogg, audio/mpeg). */
  mime: string;
  /** Raw bytes of the audio clip. */
  payload: Uint8Array;
}

export interface AsrResult {
  /** Recognized text. */
  text: string;
  /** Optional language code (e.g. "en-US"). */
  language?: string;
  /** Confidence 0..1. */
  confidence?: number;
}

export interface VoiceLoopDeps {
  /** Speech → text. */
  asr: (audio: AudioBlob) => Promise<AsrResult>;
  /** Text → text. */
  runAgent: (text: string) => Promise<string>;
  /** Text → speech. */
  tts: (text: string) => Promise<AudioBlob>;
}

export interface VoiceLoopRequest {
  audio: AudioBlob;
  /** Max audio bytes accepted. Default 20 MB. */
  maxAudioBytes?: number;
  /** Max characters of recognized text passed downstream. Default 4_000. */
  maxAsrChars?: number;
  /** Min ASR confidence (0..1) below which the loop short-circuits. Default 0. */
  minAsrConfidence?: number;
}

export interface VoiceLoopOutcome {
  ok: boolean;
  /** Recognized text (always present when ASR succeeded). */
  transcript: string | null;
  /** Agent's reply text. */
  reply: string | null;
  /** TTS audio bytes. */
  replyAudio: AudioBlob | null;
  /** Per-stage timing in ms. */
  timings: { asrMs: number; agentMs: number; ttsMs: number };
  /** Discriminated failure reason when ok=false. */
  failure?:
    | "audio-too-large"
    | "asr-failed"
    | "asr-empty"
    | "asr-low-confidence"
    | "transcript-too-long"
    | "agent-failed"
    | "tts-failed";
  error?: string;
}

const ALLOWED_AUDIO_MIME = new Set([
  "audio/wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
]);

const DEFAULT_MAX_AUDIO = 20_000_000;
const DEFAULT_MAX_ASR_CHARS = 4_000;

// ── Public entry point ────────────────────────────────────────────────────

/**
 * Run one ASR → agent → TTS round-trip. Never throws — every failure
 * path returns a `VoiceLoopOutcome` with a discriminated `failure`
 * code the caller can render.
 */
export async function runVoiceLoop(
  req: VoiceLoopRequest,
  deps: VoiceLoopDeps,
): Promise<VoiceLoopOutcome> {
  const timings = { asrMs: 0, agentMs: 0, ttsMs: 0 };
  const maxAudio = req.maxAudioBytes ?? DEFAULT_MAX_AUDIO;
  const maxAsrChars = req.maxAsrChars ?? DEFAULT_MAX_ASR_CHARS;
  const minConfidence = req.minAsrConfidence ?? 0;

  // ── Step 0: input gating ──
  if (!ALLOWED_AUDIO_MIME.has(req.audio.mime)) {
    return {
      ok: false,
      transcript: null,
      reply: null,
      replyAudio: null,
      timings,
      failure: "audio-too-large", // reuse: unsupported MIME treated as input-class failure
      error: `Unsupported audio MIME type '${req.audio.mime}'`,
    };
  }
  if (req.audio.payload.byteLength > maxAudio) {
    return {
      ok: false,
      transcript: null,
      reply: null,
      replyAudio: null,
      timings,
      failure: "audio-too-large",
      error: `Audio is ${req.audio.payload.byteLength} bytes; max is ${maxAudio}`,
    };
  }

  // ── Step 1: ASR ──
  let asr: AsrResult;
  const asrStart = Date.now();
  try {
    asr = await deps.asr(req.audio);
  } catch (err) {
    return {
      ok: false,
      transcript: null,
      reply: null,
      replyAudio: null,
      timings: { ...timings, asrMs: Date.now() - asrStart },
      failure: "asr-failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  timings.asrMs = Date.now() - asrStart;

  const transcript = asr.text.trim();
  if (transcript.length === 0) {
    return {
      ok: false,
      transcript: "",
      reply: null,
      replyAudio: null,
      timings,
      failure: "asr-empty",
    };
  }
  if (asr.confidence !== undefined && asr.confidence < minConfidence) {
    return {
      ok: false,
      transcript,
      reply: null,
      replyAudio: null,
      timings,
      failure: "asr-low-confidence",
      error: `Confidence ${asr.confidence} below ${minConfidence}`,
    };
  }
  if (transcript.length > maxAsrChars) {
    return {
      ok: false,
      transcript,
      reply: null,
      replyAudio: null,
      timings,
      failure: "transcript-too-long",
      error: `Transcript is ${transcript.length} chars; max is ${maxAsrChars}`,
    };
  }

  // ── Step 2: agent ──
  let reply: string;
  const agentStart = Date.now();
  try {
    reply = await deps.runAgent(transcript);
  } catch (err) {
    return {
      ok: false,
      transcript,
      reply: null,
      replyAudio: null,
      timings: { ...timings, agentMs: Date.now() - agentStart },
      failure: "agent-failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  timings.agentMs = Date.now() - agentStart;

  // ── Step 3: TTS ──
  const ttsStart = Date.now();
  let replyAudio: AudioBlob;
  try {
    replyAudio = await deps.tts(reply);
  } catch (err) {
    return {
      ok: false,
      transcript,
      reply,
      replyAudio: null,
      timings: { ...timings, ttsMs: Date.now() - ttsStart },
      failure: "tts-failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  timings.ttsMs = Date.now() - ttsStart;

  return {
    ok: true,
    transcript,
    reply,
    replyAudio,
    timings,
  };
}

export const VOICE_LOOP_CONSTANTS = {
  ALLOWED_AUDIO_MIME: [...ALLOWED_AUDIO_MIME],
  DEFAULT_MAX_AUDIO,
  DEFAULT_MAX_ASR_CHARS,
};

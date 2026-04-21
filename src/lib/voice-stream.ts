/**
 * voice-stream.ts — the streaming voice pipeline.
 *
 * Three concurrent stages per turn:
 *   1. streamLLM   — NIM chat SSE → content deltas (async generator)
 *   2. SentenceBuffer — assembles deltas into complete sentences
 *   3. streamTTS   — NIM audio/speech → audio chunks per sentence
 *
 * VoiceSession.handleTurn wires them together so TTS starts on
 * sentence #1 before the LLM finishes sentence #2. Barge-in flips
 * a cancel flag that both streamLLM and streamTTS observe — in-flight
 * network fetches are aborted via AbortController.
 *
 * This module is OpenAI-compatible: works against NVIDIA NIM's
 * /v1/chat/completions and /v1/audio/speech, which implement the same
 * shape. Swapping to OpenAI Realtime later is a URL + model change.
 */

import { SentenceBuffer } from "@/lib/sentence-splitter";

// ─── LLM stream ────────────────────────────────────────────────────

const NIM_BASE = process.env.NIM_API_BASE ?? "https://integrate.api.nvidia.com/v1";
const DEFAULT_CHAT_MODEL =
  process.env.VOICE_CHAT_MODEL ?? "nvidia/llama-3.1-nemotron-70b-instruct";
const DEFAULT_TTS_MODEL = process.env.VOICE_TTS_MODEL ?? "nvidia/magpie-tts-flow";

/**
 * Stream an LLM completion and yield content-delta strings. Exits
 * when the upstream emits [DONE] or when the passed AbortSignal fires.
 *
 * The fetch is NOT buffered — we read the body as a stream and parse
 * SSE frames line by line. First-token latency is what we're
 * optimizing for, not raw throughput.
 */
export async function* streamLLM(
  prompt: string,
  system: string,
  signal: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_NIM_API_KEY not configured");
  }

  const res = await fetch(`${NIM_BASE}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: DEFAULT_CHAT_MODEL,
      stream: true,
      temperature: 0.6,
      max_tokens: 1024,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM stream failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE frames — "data: {...}\n\n" or "data: [DONE]\n\n"
      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (!line) continue;
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Malformed frame — skip, don't kill the stream.
        }
      }
    }
  } finally {
    // Best-effort — reader.cancel() is idempotent; if we aborted via
    // signal, the underlying fetch already tore the body down.
    try {
      await reader.cancel();
    } catch {
      /* swallow */
    }
  }
}

// ─── TTS stream ────────────────────────────────────────────────────

/**
 * Synthesize a single sentence. Calls NIM Magpie TTS with streaming
 * response body, invokes onChunk(Uint8Array) for each audio chunk.
 *
 * Cancels immediately when signal fires — reader.cancel() triggers
 * an HTTP disconnect upstream, so we stop paying for the rest of
 * the audio that would've been generated.
 */
export async function streamTTS(
  sentence: string,
  voice: string,
  speed: number,
  onChunk: (chunk: Uint8Array) => void,
  signal: AbortSignal,
): Promise<void> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_NIM_API_KEY not configured");
  }

  const res = await fetch(`${NIM_BASE}/audio/speech`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model: DEFAULT_TTS_MODEL,
      input: sentence,
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`TTS stream failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  try {
    while (true) {
      if (signal.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      if (value) onChunk(value);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* swallow */
    }
  }
}

// ─── VoiceSession ──────────────────────────────────────────────────

export interface VoiceSessionOptions {
  systemPrompt: string;
  voice: string;
  speed?: number;
  /** Called with each audio chunk as it streams in. */
  onAudioChunk: (chunk: Uint8Array) => void;
  /** Called when a sentence finishes streaming (for UI captions). */
  onSentence?: (sentence: string) => void;
  /** Fired on end-of-turn so the WS can send "turn-done". */
  onTurnEnd?: () => void;
  /** Called on any pipeline error so the WS can surface it. */
  onError?: (err: Error) => void;
}

/**
 * A single user-connected voice session. One VoiceSession per WS.
 * Each user turn invokes handleTurn() — the session is responsible
 * for wiring LLM output through the sentence buffer to TTS output,
 * and for honoring barge-in by canceling everything in flight.
 */
export class VoiceSession {
  private currentController: AbortController | null = null;
  private buffer = new SentenceBuffer();

  constructor(private readonly opts: VoiceSessionOptions) {}

  /**
   * Process one turn. Streams LLM deltas through the sentence buffer;
   * as each complete sentence falls out, synthesize TTS and forward
   * audio chunks to onAudioChunk. Any error is routed to onError.
   */
  async handleTurn(userText: string): Promise<void> {
    // A fresh abort controller per turn — barge-in aborts this one.
    const controller = new AbortController();
    this.currentController = controller;
    this.buffer.reset();

    try {
      for await (const delta of streamLLM(
        userText,
        this.opts.systemPrompt,
        controller.signal,
      )) {
        if (controller.signal.aborted) return;
        const sentences = this.buffer.push(delta);
        for (const sentence of sentences) {
          if (controller.signal.aborted) return;
          this.opts.onSentence?.(sentence);
          await streamTTS(
            sentence,
            this.opts.voice,
            this.opts.speed ?? 1.0,
            this.opts.onAudioChunk,
            controller.signal,
          );
        }
      }

      // Drain trailing fragment (the last sentence without a terminator).
      if (!controller.signal.aborted) {
        const trailing = this.buffer.flush();
        for (const sentence of trailing) {
          if (controller.signal.aborted) return;
          this.opts.onSentence?.(sentence);
          await streamTTS(
            sentence,
            this.opts.voice,
            this.opts.speed ?? 1.0,
            this.opts.onAudioChunk,
            controller.signal,
          );
        }
      }

      if (!controller.signal.aborted) {
        this.opts.onTurnEnd?.();
      }
    } catch (err) {
      // AbortError is expected during barge-in; swallow it.
      if (err instanceof Error && err.name === "AbortError") return;
      this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (this.currentController === controller) {
        this.currentController = null;
      }
    }
  }

  /**
   * Cancel the in-flight turn. Called when the client detects new user
   * speech while the agent is still talking. LLM fetch + TTS fetch
   * both see the aborted signal within their next read loop iteration.
   */
  bargeIn(): void {
    this.currentController?.abort();
    this.buffer.reset();
  }

  /** Whether a turn is currently in flight. */
  isActive(): boolean {
    return this.currentController != null;
  }
}

/**
 * voice-ws-server.ts — platform-agnostic voice WebSocket protocol handler.
 *
 * Runs on any environment that can hand us a WebSocket-ish socket (the
 * `ws` library, Bun, Deno, Cloudflare Workers). The actual listener is
 * `server/voice-ws.ts` (a plain Node + `ws` script for Railway) — this
 * module is pure logic, independent of the transport.
 *
 * Protocol (client → server):
 *   first message     { type: "auth",     token }           required
 *                     { type: "turn-end", transcript }      finalize current turn
 *                     { type: "barge-in" }                  cancel in-flight agent speech
 *                     { type: "close" }                     graceful end (bills + tears down)
 *
 * Protocol (server → client):
 *   { type: "ready" }                                       after auth OK
 *   { type: "audio", chunk: base64 }                        synthesized audio
 *   { type: "sentence", text }                              caption hook
 *   { type: "turn-done" }                                   agent finished speaking
 *   { type: "error", message }                              fatal or soft
 *
 * Close codes:
 *   1008  policy violation — auth failed / missing
 *   1001  going away — server shutting down
 *   1000  normal — client said bye
 */

import { VoiceSession } from "@/lib/voice-stream";
import { verifyVoiceToken, type VoiceTokenPayload } from "@/lib/voice-token";
import { getPersona } from "@/lib/voice-personas";
import { captureHold, releaseHold } from "@/lib/credits";
import { recordSample } from "@/lib/slo-tracking";
import { transcribeAudio } from "@/lib/voice-asr";

/**
 * The minimal WebSocket shape we need. Matches `ws` library and the
 * browser `WebSocket` closely enough that adapters are trivial.
 */
export interface WsLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", handler: (data: string | Buffer) => void): void;
  on(event: "close", handler: () => void): void;
}

export interface HandleVoiceWsOptions {
  /** JWT-ish signing secret. Same as /api/voice/session. */
  secret: string;
  /**
   * How to bill the session on close. Default: releaseHold (full refund).
   * Plan 3.8 replaces this with a partial-capture policy based on
   * actual seconds used.
   */
  billOnClose?: (
    payload: VoiceTokenPayload,
    secondsUsed: number,
  ) => Promise<void>;
}

const DEFAULT_BILL_ON_CLOSE = async (
  payload: VoiceTokenPayload,
  _secondsUsed: number,
): Promise<void> => {
  // Stub billing until Plan 3.8: just release the whole hold.
  // This is the "fail-open on credit" choice — better to refund the
  // user than to double-charge if settlement math is wrong.
  if (payload.holdId === "none") return; // unlimited plan, no hold to release
  await releaseHold(payload.holdId);
};

/**
 * Attach voice protocol to a WS. Returns a Promise that resolves when
 * the socket closes (for hosts that want to tie server shutdown to
 * last-connection-done).
 */
export function handleVoiceWs(ws: WsLike, opts: HandleVoiceWsOptions): Promise<void> {
  const billOnClose = opts.billOnClose ?? DEFAULT_BILL_ON_CLOSE;

  let auth: VoiceTokenPayload | null = null;
  let session: VoiceSession | null = null;
  let sessionStart: number | null = null;
  let closed = false;

  // Plan 4 SLO — voice_first_audio_p95. Set on `turn-end`, cleared on
  // first audio chunk of that turn. Null while no turn is in flight.
  let turnEndAt: number | null = null;

  // L1.7 — audio chunks accumulated during the user's turn. Flushed to
  // Parakeet ASR on `audio-end` or cleared on `barge-in`.
  let audioBuffer: Uint8Array[] = [];

  const sendJson = (obj: unknown): void => {
    if (closed) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* socket already gone */
    }
  };

  return new Promise<void>((resolve) => {
    ws.on("message", async (raw) => {
      if (closed) return;
      let msg: unknown;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
      } catch {
        sendJson({ type: "error", message: "Invalid JSON message" });
        return;
      }

      if (!auth) {
        // First message MUST be auth.
        if (!isAuthMessage(msg)) {
          sendJson({ type: "error", message: "First message must be { type: 'auth', token }" });
          ws.close(1008, "missing auth");
          return;
        }
        const payload = verifyVoiceToken(msg.token, opts.secret);
        if (!payload) {
          sendJson({ type: "error", message: "Invalid or expired token" });
          ws.close(1008, "bad token");
          return;
        }
        auth = payload;
        sessionStart = Date.now();

        const persona = getPersona(payload.personaId);
        session = new VoiceSession({
          systemPrompt: persona.systemPrompt,
          voice: persona.voice,
          speed: persona.speed,
          onAudioChunk: (chunk) => {
            // Plan 4 SLO: record turn-end → first audio latency ONCE per turn.
            // Target: <1.5s. Subsequent chunks in the same turn don't sample.
            if (turnEndAt != null) {
              const firstAudioMs = Date.now() - turnEndAt;
              void recordSample("voice_first_audio_p95", firstAudioMs, firstAudioMs <= 1500);
              turnEndAt = null;
            }
            // Base64-encode binary audio for the JSON message envelope.
            sendJson({ type: "audio", chunk: bufferToBase64(chunk) });
          },
          onSentence: (text) => sendJson({ type: "sentence", text }),
          onTurnEnd: () => sendJson({ type: "turn-done" }),
          onError: (err) => sendJson({ type: "error", message: err.message }),
        });

        sendJson({ type: "ready", personaId: persona.id, voice: persona.voice });
        return;
      }

      // Already authenticated — route by type.
      if (!isTypedMessage(msg)) {
        sendJson({ type: "error", message: "Missing 'type' field" });
        return;
      }

      switch (msg.type) {
        case "turn-end": {
          if (typeof msg.transcript !== "string" || msg.transcript.trim().length === 0) {
            sendJson({ type: "error", message: "turn-end requires non-empty transcript" });
            return;
          }
          // Mark the moment the turn started from the server's perspective,
          // so onAudioChunk can compute first-audio latency on the very
          // first chunk of the agent's reply.
          turnEndAt = Date.now();
          // Don't await — handleTurn is long-running; next messages
          // (barge-in, close) need to arrive while it's streaming.
          void session?.handleTurn(msg.transcript);
          return;
        }

        // L1.7 — audio-chunk carries base64 webm/opus frames from the
        // client's MediaRecorder. We just accumulate; ASR fires at
        // audio-end so we don't pay per-chunk latency.
        case "audio-chunk": {
          if (typeof msg.chunk !== "string") {
            sendJson({ type: "error", message: "audio-chunk requires base64 chunk" });
            return;
          }
          try {
            audioBuffer.push(base64ToBuffer(msg.chunk));
          } catch {
            // Skip malformed chunks — better than killing the stream.
          }
          return;
        }

        // L1.7 — client's VAD detected speech-end. Transcribe the
        // accumulated audio, then proceed as if turn-end had been sent
        // with the transcribed text.
        case "audio-end": {
          if (audioBuffer.length === 0) return;
          const audio = concatBuffers(audioBuffer);
          audioBuffer = [];
          turnEndAt = Date.now();
          sendJson({ type: "transcribing" });
          void (async () => {
            try {
              const transcript = await transcribeAudio({ audio });
              if (!transcript) {
                sendJson({ type: "error", message: "Could not transcribe audio" });
                return;
              }
              // Echo the transcript back so the UI can render it as a
              // "user said" caption before the assistant replies.
              sendJson({ type: "transcript", text: transcript });
              await session?.handleTurn(transcript);
            } catch (err) {
              sendJson({
                type: "error",
                message: err instanceof Error ? err.message : "ASR failed",
              });
            }
          })();
          return;
        }

        case "barge-in": {
          // Drop any buffered-but-not-transcribed audio too.
          audioBuffer = [];
          session?.bargeIn();
          return;
        }

        case "close": {
          ws.close(1000, "bye");
          return;
        }

        default: {
          sendJson({ type: "error", message: `Unknown message type: ${String(msg.type)}` });
        }
      }
    });

    ws.on("close", async () => {
      if (closed) return;
      closed = true;
      // Ensure any in-flight TTS/LLM is cancelled before we settle.
      session?.bargeIn();

      if (auth && sessionStart != null) {
        const secondsUsed = Math.ceil((Date.now() - sessionStart) / 1000);
        try {
          await billOnClose(auth, secondsUsed);
        } catch {
          // If settlement fails, the expired-holds sweep cron (Plan 1)
          // will reclaim the hold. No state-loss path here.
        }
      } else if (auth) {
        // Auth'd but zero-length session. If the session had a real
        // hold, release it; unlimited-plan sessions used the "none"
        // sentinel so there's nothing to release.
        if (auth.holdId !== "none") {
          try {
            await releaseHold(auth.holdId);
          } catch { /* see above */ }
        }
      }
      resolve();
    });
  });
}

// ─── type guards ────────────────────────────────────────────────

interface AuthMessage {
  type: "auth";
  token: string;
}

function isAuthMessage(v: unknown): v is AuthMessage {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.type === "auth" && typeof o.token === "string";
}

function isTypedMessage(v: unknown): v is { type: string; [k: string]: unknown } {
  return Boolean(v) && typeof v === "object" && typeof (v as { type?: unknown }).type === "string";
}

// Node Buffer OR browser Uint8Array — support both for portability.
function bufferToBase64(chunk: Uint8Array): string {
  if (typeof Buffer !== "undefined" && chunk instanceof Uint8Array) {
    return Buffer.from(chunk).toString("base64");
  }
  // Browser-compatible fallback.
  let bin = "";
  for (let i = 0; i < chunk.byteLength; i++) bin += String.fromCharCode(chunk[i]);
  return btoa(bin);
}

function base64ToBuffer(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBuffers(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

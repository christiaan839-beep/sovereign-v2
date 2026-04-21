/**
 * voice-asr.ts — NVIDIA Parakeet transcription helper.
 *
 * Called at turn-end (when VAD detects speech stop) with the buffered
 * audio chunks from MediaRecorder. Uses OpenAI-compatible transcription
 * endpoint — NIM's Parakeet model accepts the same multipart/form-data
 * shape as OpenAI Whisper.
 *
 * Returns the transcribed text or null on any failure — the WS server
 * decides whether to treat "no transcript" as a real turn (probably not)
 * or to drop it silently.
 *
 * We don't yet stream ASR (send partial text as audio flows in). Parakeet
 * supports it but the extra complexity buys ~500ms in a turn that's
 * already sub-2s end-to-end. Revisit if the voice SLO starts slipping.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("voice-asr");

const NIM_BASE = process.env.NIM_API_BASE ?? "https://integrate.api.nvidia.com/v1";
const ASR_MODEL = process.env.VOICE_ASR_MODEL ?? "nvidia/parakeet-ctc-1.1b";

export interface TranscribeOpts {
  /** Concatenated audio chunks from MediaRecorder (webm/opus). */
  audio: Uint8Array;
  /** Optional language hint — skipped when unset so Parakeet auto-detects. */
  language?: string;
  /** AbortSignal so the caller can cancel if the user barges in. */
  signal?: AbortSignal;
}

export async function transcribeAudio(opts: TranscribeOpts): Promise<string | null> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    log.warn("NVIDIA_NIM_API_KEY not set — ASR disabled");
    return null;
  }
  if (opts.audio.byteLength === 0) return null;

  // Multipart form-data with a proper File blob. OpenAI-compatible shape:
  //   file         — the audio blob
  //   model        — transcription model ID
  //   language     — optional
  //   response_format — "text" returns plain string, much simpler than JSON
  const form = new FormData();
  // MediaRecorder default container is webm/opus in Chrome, video/mp4 in Safari.
  // Parakeet accepts both via magic-byte detection; we tag as webm to prevent
  // middleware from picking the wrong codec.
  form.append(
    "file",
    new Blob([new Uint8Array(opts.audio) as unknown as BlobPart], { type: "audio/webm" }),
    "turn.webm",
  );
  form.append("model", ASR_MODEL);
  form.append("response_format", "text");
  if (opts.language) form.append("language", opts.language);

  try {
    const res = await fetch(`${NIM_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.warn("ASR HTTP error", { status: res.status, body: text.slice(0, 200) });
      return null;
    }
    const text = await res.text();
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    log.warn("ASR call failed", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

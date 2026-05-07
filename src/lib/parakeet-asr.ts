/**
 * Parakeet ASR — speech-to-text via NVIDIA's Parakeet-TDT-1.1B
 * model (CC-BY-4.0). Tops the Hugging Face Open ASR Leaderboard
 * for English; supports word-level timestamps.
 *
 * Why this exists: the voice-calling feature today is wired to
 * Twilio + ElevenLabs (TTS) but lacks a transcription layer —
 * recorded calls land as audio files with no text. Parakeet
 * closes that gap as a $0-marginal-cost pre-trained model
 * served via NVIDIA NIM.
 *
 * Failure modes:
 *   - `NVIDIA_NIM_API_KEY` unset → returns `{ ok: false,
 *     reason: "NVIDIA_NIM_API_KEY not configured" }`. Caller
 *     should fall back to whatever transcription backend is
 *     available (none today; future: Whisper-via-Groq).
 *   - Audio > 25 MB or > 10 minutes → rejected at the API
 *     boundary (NIM enforces). Caller should chunk first.
 *   - Network timeout @ 60s → `TimeoutError` from
 *     `fetchWithTimeout`. Caller decides retry policy.
 *
 * The function is intentionally not wired into the voice route
 * automatically — that's the next commit, after we test the
 * integration with a real recording.
 */

import { fetchWithTimeout } from "@/lib/with-timeout";
import { captureException } from "@/lib/sentry";
import { createLogger } from "@/lib/logger";

const log = createLogger("parakeet-asr");

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const PARAKEET_MODEL_ID = "nvidia/parakeet-tdt-1.1b";

export interface ParakeetWord {
  /** The transcribed token. */
  word: string;
  /** Start offset in seconds from the beginning of the audio. */
  start: number;
  /** End offset in seconds. */
  end: number;
  /** Confidence in [0, 1]. */
  confidence: number;
}

export interface ParakeetTranscript {
  /** The full transcript as a single string, joined with spaces. */
  text: string;
  /** Word-level timing, useful for redaction/highlighting/replay. */
  words: ParakeetWord[];
  /** Detected (or supplied) BCP-47 language code, e.g. "en-US". */
  language: string;
  /** Total audio duration in seconds, as reported by the model. */
  durationSec: number;
}

export type ParakeetResult =
  | { ok: true; transcript: ParakeetTranscript }
  | { ok: false; reason: string };

export interface ParakeetTranscribeArgs {
  /** Audio bytes — wav/mp3/m4a/ogg/flac, max 25 MB / 10 min. */
  audio: Blob | ArrayBuffer | Uint8Array;
  /** Audio MIME type — defaults to audio/mpeg if unknown. */
  contentType?: string;
  /** BCP-47 language hint. Falls back to auto-detect when empty. */
  language?: string;
  /** Per-call timeout in ms. Default 60s — long-running but bounded. */
  timeoutMs?: number;
}

function getNimKey(): string | null {
  return (
    process.env.NVIDIA_NIM_API_KEY?.trim() ||
    process.env.NVIDIA_API_KEY?.trim() ||
    null
  );
}

/**
 * Coerce audio input to a Blob. Accepts ArrayBuffer / Uint8Array /
 * Blob — all three are common results of Twilio's recording-fetch +
 * file uploads + buffered audio streams.
 */
function toBlob(
  audio: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Blob {
  if (audio instanceof Blob) return audio;
  if (audio instanceof Uint8Array) {
    // .buffer can be ArrayBuffer or SharedArrayBuffer depending on
    // the runtime (workers can produce SharedArrayBuffer). Blob
    // constructor only accepts ArrayBuffer-backed BlobParts, so we
    // copy into a fresh Uint8Array first — cheap, type-safe.
    const copy = new Uint8Array(audio.byteLength);
    copy.set(audio);
    return new Blob([copy], { type: contentType });
  }
  return new Blob([audio], { type: contentType });
}

/**
 * Transcribe one audio buffer to text. Single-shot, no streaming.
 * For real-time streaming use the dedicated WebSocket endpoint
 * (not implemented here — it lives on the live voice path that's
 * still in beta).
 */
export async function transcribeWithParakeet(
  args: ParakeetTranscribeArgs,
): Promise<ParakeetResult> {
  const key = getNimKey();
  if (!key) {
    return {
      ok: false,
      reason: "NVIDIA_NIM_API_KEY not configured — wire it in Vercel env.",
    };
  }

  const contentType = args.contentType ?? "audio/mpeg";
  const blob = toBlob(args.audio, contentType);
  const timeoutMs = args.timeoutMs ?? 60_000;

  const form = new FormData();
  form.append("file", blob, "audio");
  form.append("model", PARAKEET_MODEL_ID);
  if (args.language) form.append("language", args.language);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  try {
    const res = await fetchWithTimeout(`${NIM_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      timeoutMs,
      label: "parakeet-transcribe",
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const reason = `Parakeet HTTP ${res.status}: ${errBody.slice(0, 200) || "unknown"}`;
      log.warn(reason, { status: res.status });
      return { ok: false, reason };
    }

    const data = (await res.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        probability?: number;
      }>;
    };

    return {
      ok: true,
      transcript: {
        text: data.text ?? "",
        language: data.language ?? args.language ?? "en-US",
        durationSec: data.duration ?? 0,
        words: (data.words ?? []).map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.probability ?? 1,
        })),
      },
    };
  } catch (err) {
    captureException(err, {
      module: "parakeet-asr",
      action: "transcribe",
      extra: {
        contentType,
        timeoutMs,
        sizeBytes: blob.size,
      },
    });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

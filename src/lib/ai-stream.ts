/**
 * streamAi — token-by-token streaming wrapper over NIM chat.
 *
 * Yields text deltas as they arrive from NVIDIA NIM. Callers can
 * feed them directly to a Server-Sent Events stream to the browser,
 * producing the "typewriter" feel instead of a 3-second spinner.
 *
 * NIM speaks an OpenAI-compatible SSE format:
 *
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n
 *   data: {"choices":[{"delta":{"content":" world"}}]}\n\n
 *   data: [DONE]\n\n
 *
 * This function parses that stream and yields the content strings.
 * Unknown / malformed chunks are skipped (never throw). An upstream
 * HTTP error is surfaced as a single throw before any yield, so
 * callers can catch + fall back to non-streaming ai().
 */

import { NIM_MODELS } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai-stream");
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

/* ─── Types ───────────────────────────────────────────────────── */

export interface StreamOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Abort the stream on signal. Useful for client disconnects. */
  signal?: AbortSignal;
}

/* ─── Internals ───────────────────────────────────────────────── */

function getNimKey(): string {
  return (
    process.env.NIM_API_KEY ?? process.env.NVIDIA_API_KEY ?? ""
  );
}

/**
 * Parse a single SSE `data: ...` line. Returns the delta content
 * string, null for control frames ([DONE]) or unparseable chunks.
 */
function parseSseChunk(raw: string): string | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  const payload = line.slice(5).trim();
  if (payload === "[DONE]") return null;
  try {
    const msg = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = msg.choices?.[0]?.delta?.content;
    return typeof content === "string" && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * Stream tokens from NIM. Usage:
 *
 *   for await (const token of streamAi("Hello!", { system: "Be brief" })) {
 *     process.stdout.write(token);
 *   }
 *
 * Errors (no key, provider 5xx, aborted) throw BEFORE the first
 * yield so callers can recover without partial output.
 */
export async function* streamAi(
  prompt: string,
  options: StreamOptions = {},
): AsyncGenerator<string, void, undefined> {
  const apiKey = getNimKey();
  if (!apiKey) {
    throw new Error("NIM API key not configured — streaming requires NIM_API_KEY");
  }

  const model = options.model ?? NIM_MODELS.flagship;
  const messages: Array<{ role: string; content: string }> = [];
  if (options.system) messages.push({ role: "system", content: options.system });
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1024,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    log.warn("NIM streaming request failed", {
      status: response.status,
      body: body.slice(0, 200),
    });
    throw new Error(`NIM streaming failed (HTTP ${response.status})`);
  }
  if (!response.body) {
    throw new Error("NIM response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Tokens are usually complete lines, but a TCP packet can split in
  // the middle of a JSON payload — buffer until we see a blank line.
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines.
      let idx = buffer.indexOf("\n\n");
      while (idx !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const token = parseSseChunk(chunk);
        if (token !== null) yield token;
        idx = buffer.indexOf("\n\n");
      }
    }
    // Any trailing partial chunk (rare — OpenAI-style streams end clean).
    const tail = parseSseChunk(buffer);
    if (tail !== null) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Synchronous test-only helper — concatenate a full stream into a string. */
export async function collectStream(
  prompt: string,
  options?: StreamOptions,
): Promise<string> {
  let out = "";
  for await (const token of streamAi(prompt, options)) {
    out += token;
  }
  return out;
}

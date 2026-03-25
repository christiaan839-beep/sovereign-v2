/**
 * SOVEREIGN MATRIX — Ollama Auto-Discovery & Client
 *
 * Detects a locally running Ollama instance, lists installed models,
 * pulls new models, and provides chat / streaming-chat helpers.
 */

const OLLAMA_BASE = "http://localhost:11434";

export interface OllamaModel {
  name: string;
  size: string; // e.g., "4.7 GB"
  modified: string;
  digest: string;
}

// ────────────────────────────────────────────────────────
// Discovery
// ────────────────────────────────────────────────────────

/** Returns true if Ollama is reachable on localhost:11434 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** List every model currently installed in Ollama */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/tags`);
  if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`);
  const data = await res.json();

  return (data.models ?? []).map(
    (m: { name: string; size: number; modified_at: string; digest: string }) => ({
      name: m.name,
      size: formatBytes(m.size),
      modified: m.modified_at,
      digest: m.digest,
    })
  );
}

// ────────────────────────────────────────────────────────
// Model Management
// ────────────────────────────────────────────────────────

/** Pull (download) a model by name – e.g. "qwen2.5-coder:7b" */
export async function pullOllamaModel(modelName: string): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: false }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama pull failed (${res.status}): ${body}`);
  }
  // Consume the response body so the connection is not left dangling
  await res.json().catch(() => null);
}

// ────────────────────────────────────────────────────────
// Chat
// ────────────────────────────────────────────────────────

export interface OllamaChatMessage {
  role: string;
  content: string;
}

/** Non-streaming chat completion. Returns the assistant text. */
export async function ollamaChat(
  model: string,
  messages: OllamaChatMessage[]
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama chat failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.message?.content ?? "";
}

/** Streaming chat completion. Returns a ReadableStream of SSE-style chunks. */
export function ollamaChatStream(
  model: string,
  messages: OllamaChatMessage[]
): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, stream: true }),
        });

        if (!res.ok || !res.body) {
          controller.enqueue(
            new TextEncoder().encode(`error: Ollama returned ${res.status}\n`)
          );
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          // Ollama streams newline-delimited JSON objects
          for (const line of text.split("\n").filter(Boolean)) {
            try {
              const chunk = JSON.parse(line);
              if (chunk.message?.content) {
                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ${JSON.stringify({ content: chunk.message.content })}\n\n`
                  )
                );
              }
              if (chunk.done) {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              }
            } catch {
              // Partial JSON — skip
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(`error: ${String(err)}\n`)
        );
        controller.close();
      }
    },
  });
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

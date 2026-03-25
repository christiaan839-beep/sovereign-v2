/**
 * SOVEREIGN MATRIX -- SSE Stream Handler
 *
 * Reusable SSE streaming logic with batched token flushing.
 * Handles thinking-mode events, abort signals, and error recovery.
 */

const STREAM_FLUSH_MS = 80; // ~12fps — smooth without jank

export interface StreamCallbacks {
  onToken: (token: string, accumulated: string) => void;
  onThinkingStart?: () => void;
  onThinkingToken?: (token: string, accumulated: string) => void;
  onThinkingEnd?: () => void;
  onDone: (finalContent: string, thinkingContent: string) => void;
  onError: (error: Error) => void;
}

/**
 * Stream an SSE endpoint with batched token flushing.
 *
 * @param endpoint - The URL to POST to.
 * @param body - JSON body payload.
 * @param signal - AbortSignal for cancellation.
 * @param callbacks - Event callbacks for tokens, thinking, completion, and errors.
 * @returns A promise that resolves when the stream completes or is aborted.
 */
export async function streamChat(
  endpoint: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<void> {
  let contentBuffer = "";
  let thinkingBuffer = "";
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    callbacks.onToken(contentBuffer, contentBuffer);
    if (thinkingBuffer) {
      callbacks.onThinkingToken?.(thinkingBuffer, thinkingBuffer);
    }
  };

  const scheduleFlush = () => {
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, STREAM_FLUSH_MS);
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.body) {
      // Non-streaming response -- read as JSON
      const data = await res.json();
      const content =
        data.result ||
        data.answer ||
        data.response ||
        data.analysis ||
        data.text ||
        data.intelligence?.market_position ||
        data.redacted_text ||
        (typeof data === "string" ? data : JSON.stringify(data, null, 2));

      // Check for image URL in response data
      const imageUrl = data.images?.[0]?.url || data.imageUrl || data.image_url || data.url;
      const finalContent =
        imageUrl && /\.(png|jpg|jpeg|webp|gif|svg)/i.test(imageUrl) ? imageUrl : content;

      const truncated =
        finalContent.length > 3000
          ? finalContent.slice(0, 3000) + "\n\n[Response truncated -- view full result in the dedicated tool]"
          : finalContent;

      callbacks.onDone(truncated, "");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let isThinkingPhase = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) {
        reader.cancel();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));

            // Handle thinking mode events
            if (data.type === "thinking_start") {
              isThinkingPhase = true;
              callbacks.onThinkingStart?.();
              continue;
            }
            if (data.type === "thinking_end") {
              isThinkingPhase = false;
              callbacks.onThinkingEnd?.();
              continue;
            }
            if (data.type === "thinking") {
              thinkingBuffer += data.text || "";
              scheduleFlush();
              continue;
            }

            // Regular text token
            const token = data.choices?.[0]?.delta?.content || data.text || "";
            if (token) {
              contentBuffer += token;
              if (isThinkingPhase) {
                thinkingBuffer += token;
              }
              scheduleFlush();
            }
          } catch {
            /* skip malformed SSE lines */
          }
        }
      }
    }

    // Final flush -- ensure all tokens are rendered
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    callbacks.onDone(contentBuffer, thinkingBuffer);
  } catch (error) {
    if (flushTimer) {
      clearTimeout(flushTimer);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      // User cancelled -- not an error
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

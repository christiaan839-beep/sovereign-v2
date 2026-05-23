import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { ai } from "@/lib/ai";
import { nimChat, getNimKey } from "@/lib/nvidia";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { checkpoint as budgetCheckpoint } from "@/lib/execution-budget";
import { createHash } from "node:crypto";
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const log = createLogger("ai-stream");

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { prompt, systemInstruction, model, thinking } = await req.json();
  if (!prompt?.trim()) return new Response("Prompt required", { status: 400 });

  const encoder = new TextEncoder();
  const signal = req.signal;

  // ─── FAST CHAT PATH: Groq for sub-500ms response ───
  const isSimpleChat =
    prompt.length < 500 &&
    !prompt.includes("analyze") &&
    !prompt.includes("research") &&
    !prompt.includes("code") &&
    !prompt.includes("build") &&
    !prompt.includes("find leads");

  if (isSimpleChat && !thinking) {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      const Groq = (await import("groq-sdk")).default;
      const client = new Groq({ apiKey: groqKey });

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const completion = await client.chat.completions.create({
              model: "llama-3.1-8b-instant",
              messages: [
                ...(systemInstruction
                  ? [{ role: "system" as const, content: systemInstruction }]
                  : []),
                { role: "user" as const, content: prompt },
              ],
              max_tokens: 1000,
              stream: true,
            });

            for await (const chunk of completion) {
              if (signal.aborted) break;
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", text })}\n\n`,
                  ),
                );
              }
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
            );
            controller.close();
          } catch (err) {
            log.error("Groq fast-path error", err as Record<string, unknown>);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`,
              ),
            );
            controller.close();
          }
        },
        cancel() {},
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  }

  // ─── THINKING MODE: Stream reasoning first, then answer ───
  if (thinking) {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Phase 1: Reasoning (uses DeepSeek-R1 or Qwen3 for chain-of-thought)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "thinking_start" })}\n\n`,
            ),
          );

          const _thinkingModel = "groq/deepseek-r1-distill-llama-70b";
          const _thinkingPrompt = `Think step by step about this question. Show your reasoning process clearly, then provide a final answer.\n\nQuestion: ${prompt}`;

          const nimKey = await getNimKey();
          let thinkingResult = "";

          if (nimKey) {
            // Try Groq for ultra-fast thinking (DeepSeek-R1)
            try {
              const groqKey = process.env.GROQ_API_KEY;
              if (groqKey) {
                // Wave-108.5 kill-switch coverage: streaming reasoning
                // via Groq direct-fetch. Identical-prompt repetition
                // here would otherwise burn the user's full per-day
                // budget before the daily-spend guard notices.
                const promptHash = createHash("sha256")
                  .update(prompt)
                  .digest("hex")
                  .slice(0, 16);
                budgetCheckpoint("ai.stream-groq", {
                  model: "deepseek-r1-distill-llama-70b",
                  promptHash,
                });
                const res = await outboundFetchAsResponse("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${groqKey}`,
                    },
                    body: JSON.stringify({
                      model: "deepseek-r1-distill-llama-70b",
                      messages: [
                        {
                          role: "system",
                          content:
                            "You are a reasoning engine. Think step by step. Wrap your reasoning in <think> tags, then give your final answer after </think>.",
                        },
                        { role: "user", content: prompt },
                      ],
                      max_tokens: 2048,
                      temperature: 0.6,
                    }),
                    signal,
                  }, { ruleId: "misc.ai.stream.route.1", allowedHosts: ["api.groq.com"] });
                const data = await res.json();
                thinkingResult = data?.choices?.[0]?.message?.content || "";
              }
            } catch {
              /* Groq unavailable — fall through to NIM */
            }

            // Fallback to NIM
            if (!thinkingResult) {
              thinkingResult = await nimChat(
                "deepseek-ai/deepseek-v3.2",
                [
                  {
                    role: "system",
                    content:
                      "Think step by step. Wrap reasoning in <think> tags.",
                  },
                  { role: "user", content: prompt },
                ],
                { maxTokens: 2048 },
              );
            }
          }

          // Extract thinking vs answer
          const thinkMatch = thinkingResult.match(/<think>([\s\S]*?)<\/think>/);
          const thinkingContent = thinkMatch
            ? thinkMatch[1].trim()
            : thinkingResult.split("\n\n")[0];
          const answerContent = thinkMatch
            ? thinkingResult.replace(/<think>[\s\S]*?<\/think>/, "").trim()
            : thinkingResult.split("\n\n").slice(1).join("\n\n");

          // Stream thinking tokens
          const thinkingWords = thinkingContent.split(" ");
          for (let i = 0; i < thinkingWords.length; i += 2) {
            if (signal.aborted) break;
            const chunk = thinkingWords.slice(i, i + 2).join(" ") + " ";
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "thinking", text: chunk })}\n\n`,
              ),
            );
            await new Promise((r) => setTimeout(r, 15));
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "thinking_end" })}\n\n`,
            ),
          );

          // Phase 2: Stream the answer
          if (answerContent) {
            const answerWords = answerContent.split(" ");
            for (let i = 0; i < answerWords.length; i += 2) {
              if (signal.aborted) break;
              const chunk = answerWords.slice(i, i + 2).join(" ") + " ";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
              );
              await new Promise((r) => setTimeout(r, 20));
            }
          } else {
            // If no separate answer, use Gemini to synthesize
            const result = streamText({
              model: google("gemini-2.0-flash"),
              system:
                systemInstruction ||
                "You are Sovereign Assistant. Be direct and useful.",
              prompt: `Based on this reasoning:\n${thinkingContent}\n\nProvide a clear, concise answer to: ${prompt}`,
              abortSignal: signal,
            });
            for await (const token of result.textStream) {
              if (signal.aborted) break;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`),
              );
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          if (!signal.aborted) {
            log.error("Thinking mode error", err as Record<string, unknown>);
          }
          try {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch {
            /* stream already closed */
          }
        }
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ─── STANDARD STREAMING MODE ───
  try {
    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemInstruction || undefined,
      prompt,
      abortSignal: signal,
    });

    const textStream = result.textStream;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of textStream) {
            if (signal.aborted) break;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`),
            );
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          if (signal.aborted) {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
            return;
          }
          log.error("Token iteration error", err as Record<string, unknown>);
          try {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch {
            /* stream already closed */
          }
        }
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    log.error(
      "Primary streaming failed, falling back",
      error as Record<string, unknown>,
    );

    try {
      const useModel = model === "claude" ? "claude" : "gemini";
      const output = await ai(prompt, {
        model: useModel as "gemini" | "claude",
        system: systemInstruction,
      });

      let intervalRef: ReturnType<typeof setInterval> | null = null;

      const stream = new ReadableStream({
        start(controller) {
          const words = output.split(" ");
          let i = 0;
          intervalRef = setInterval(() => {
            try {
              if (signal.aborted || i >= words.length) {
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
                if (intervalRef) clearInterval(intervalRef);
                return;
              }
              const chunk = words.slice(i, i + 3).join(" ") + " ";
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
              );
              i += 3;
            } catch {
              if (intervalRef) clearInterval(intervalRef);
            }
          }, 30);
        },
        cancel() {
          if (intervalRef) clearInterval(intervalRef);
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (fallbackError) {
      log.error(
        "Fallback also failed",
        fallbackError as Record<string, unknown>,
      );
      return new Response("Stream failed", { status: 500 });
    }
  }
}

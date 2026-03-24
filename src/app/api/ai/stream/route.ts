import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { ai } from "@/lib/ai";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const { prompt, systemInstruction, model } = await req.json();
  if (!prompt?.trim()) return new Response("Prompt required", { status: 400 });

  const encoder = new TextEncoder();

  try {
    // Real token-by-token streaming via Vercel AI SDK + Gemini
    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemInstruction || undefined,
      prompt,
    });

    const textStream = result.textStream;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of textStream) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          console.error("[AI Stream] token iteration error:", err);
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[AI Stream] primary streaming failed, falling back:", error);

    // Fallback: generate full response then simulate streaming
    try {
      const useModel = model === "claude" ? "claude" : "gemini";
      const output = await ai(prompt, { model: useModel as "gemini" | "claude", system: systemInstruction });

      const stream = new ReadableStream({
        start(controller) {
          const words = output.split(" ");
          let i = 0;
          const interval = setInterval(() => {
            if (i >= words.length) {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              controller.close();
              clearInterval(interval);
              return;
            }
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            i += 3;
          }, 30);
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    } catch (fallbackError) {
      console.error("[AI Stream] fallback also failed:", fallbackError);
      return new Response("Stream failed", { status: 500 });
    }
  }
}

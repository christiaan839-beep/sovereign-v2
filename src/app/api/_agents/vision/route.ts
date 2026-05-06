import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * QWEN 3.5 VLM VISION AGENT — 400B MoE vision-language model.
 *
 * Understands images natively:
 * - Screenshot analysis ("What's broken in this UI?")
 * - Chart/graph reading ("What trend does this show?")
 * - Invoice/receipt OCR with understanding
 * - Medical image description
 * - Architectural plan analysis
 *
 * LICENSE: Apache 2.0 — free for commercial use.
 */

export const POST = createAgentRoute({
  name: "vision",
  requiredFields: ["image_url"],
  handler: async ({ input }) => {
    const {
      image_url,
      question = "Describe this image in detail.",
      mode = "analyze",
    } = input as Record<string, any>;

    const modePrompts: Record<string, string> = {
      analyze: `Analyze this image thoroughly. Describe what you see, identify key elements, and provide insights. Then answer: ${question}`,
      ocr: `Extract ALL text from this image. Return the text content organized and structured. Also answer: ${question}`,
      chart: `This is a chart or graph. Read the data, identify trends, and provide a summary of what the data shows. Also answer: ${question}`,
      audit: `Audit this image for quality, issues, or problems. If it's a UI screenshot, identify usability issues. If it's a document, check for errors. Also answer: ${question}`,
    };

    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "qwen/qwen-3.5-vlm",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image_url } },
              { type: "text", text: modePrompts[mode as string] || modePrompts.analyze },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    const data = await res.json();

    return {
      success: true,
      model: "Qwen 3.5 VLM (400B MoE Vision-Language)",
      mode,
      image_url,
      result: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
      license: "Apache 2.0 — commercial use permitted",
    };
  },
});

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

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "vision",
  requiredFields: ["image_url"],
  // Wave 129 M3 batch 19: memory hooks. Per-image vision continuity for
  // Qwen 3.5 VLM mode-specific runs (analyze/ocr/chart/audit) — prior
  // OCR pass + structural reading carry into the next mode shift.
  memory: {
    search: {
      query: (input) =>
        `vision ${input.mode ?? "analyze"} ${String(input.image_url ?? "").slice(0, 80)} ${String(input.question ?? "").slice(0, 60)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          mode?: string;
          result?: string;
          image_url?: string;
        };
        if (!r.result) return null;
        const head = r.result.slice(0, 220).replace(/\s+/g, " ");
        return `vision[${r.mode ?? "analyze"}]: ${head}`;
      },
      metadata: (input) => ({
        kind: "vision",
        url:
          typeof input.image_url === "string"
            ? input.image_url.slice(0, 200)
            : "",
        mode: typeof input.mode === "string" ? input.mode : "analyze",
      }),
    },
  },
  handler: async ({ input }) => {
    const {
      image_url,
      question = "Describe this image in detail.",
      mode = "analyze",
    } = input as Record<string, unknown>;

    const modePrompts: Record<string, string> = {
      analyze: `Analyze this image thoroughly. Describe what you see, identify key elements, and provide insights. Then answer: ${question}`,
      ocr: `Extract ALL text from this image. Return the text content organized and structured. Also answer: ${question}`,
      chart: `This is a chart or graph. Read the data, identify trends, and provide a summary of what the data shows. Also answer: ${question}`,
      audit: `Audit this image for quality, issues, or problems. If it's a UI screenshot, identify usability issues. If it's a document, check for errors. Also answer: ${question}`,
    };

    const start = Date.now();
    const res = await outboundFetchAsResponse(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "qwen/qwen-3.5-vlm",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: image_url } },
                {
                  type: "text",
                  text: modePrompts[mode as string] || modePrompts.analyze,
                },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      },
      {
        ruleId: "agents.vision.route.1",
        allowedHosts: ["integrate.api.nvidia.com"],
      },
    );

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

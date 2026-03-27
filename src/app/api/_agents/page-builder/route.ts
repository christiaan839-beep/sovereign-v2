import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * PAGE BUILDER — Generates complete HTML pages from text prompts.
 * Uses Google Stitch SDK (primary) or NVIDIA NIM Devstral (fallback).
 * Wrapped in security factory for full protection pipeline.
 */

export const POST = createAgentRoute({
  name: "page-builder",
  requiredFields: ["prompt"],
  handler: async ({ input }) => {
    const prompt = input.prompt as string;
    const projectId = (input.projectId as string) || undefined;
    const start = Date.now();

    const system = `You are an elite frontend developer. Generate a COMPLETE, production-ready HTML page from the user's description.
Requirements:
1. Use modern CSS (flexbox/grid, custom properties, responsive).
2. Dark theme by default (bg: #030303, text: #e5e5e5).
3. Include all content — no placeholders, no TODOs.
4. Be immediately usable — no placeholders, no TODOs.
5. Output ONLY the full HTML document. No markdown, no explanation.`;

    // Primary: NVIDIA NIM (Devstral 2)
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "nvidia/devstral-2-latest",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 8192,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const html = data?.choices?.[0]?.message?.content || "";

    return {
      success: true,
      html,
      model: "NVIDIA Devstral 2",
      duration_ms: Date.now() - start,
    };
  },
});

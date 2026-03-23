import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * VISION ANALYZER — Nemotron Nano VL 12B for document & image understanding.
 *
 * Uses NVIDIA's vision-language model to analyze:
 * - Documents (invoices, receipts, contracts)
 * - Screenshots (UI analysis, competitor pages)
 * - Photos (product images, brand assets)
 * - Charts & graphs (data extraction)
 *
 * Input: { imageUrl OR imageBase64, question? }
 * Output: { analysis, model }
 */

export const POST = createAgentRoute({
  name: "vision-analyze",
  requiredFields: [],
  handler: async ({ input }) => {
    const imageUrl = input.imageUrl as string | undefined;
    const imageBase64 = input.imageBase64 as string | undefined;
    const question = (input.question as string) || "Analyze this image in detail. Describe what you see, extract any text, identify the purpose, and note anything notable.";

    if (!imageUrl && !imageBase64) {
      return { error: "Provide either imageUrl or imageBase64." };
    }

    const nimKey = await getNimKey();
    if (!nimKey) {
      return { error: "NVIDIA NIM API key not configured." };
    }

    const imageContent = imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl } }
      : { type: "image_url" as const, image_url: { url: `data:image/png;base64,${imageBase64}` } };

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-nano-12b-v2-vl",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              imageContent,
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      // Fallback to Cosmos Reason 8B
      const fallbackRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
        body: JSON.stringify({
          model: "nvidia/cosmos-reason2-8b",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: question },
                imageContent,
              ],
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!fallbackRes.ok) {
        return { error: `Vision API error`, details: await fallbackRes.text() };
      }

      const fallbackData = await fallbackRes.json();
      return {
        analysis: fallbackData.choices?.[0]?.message?.content || "",
        model: "cosmos-reason2-8b (fallback)",
      };
    }

    const data = await res.json();
    return {
      analysis: data.choices?.[0]?.message?.content || "",
      model: "nemotron-nano-12b-v2-vl",
    };
  },
});

import { createAgentRoute } from "@/lib/agent-factory";

/**
 * OCR — Uses nemotron-ocr-v1 to extract text from images (screenshots, PDFs, competitor pricing tables).
 * Essential for the Ghost Fleet SDR to read G2 review screenshots.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "ocr",
  handler: async ({ input, email, userId }) => {
    const { imageBase64, imageUrl } = input as {
      imageBase64?: string;
      imageUrl?: string;
    };
    if (!imageBase64 && !imageUrl) {
      return { error: "Provide either `imageBase64` or `imageUrl`." };
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return { error: "NVIDIA_NIM_API_KEY not configured." };

    const content: (
      | { type: string; text: string }
      | { type: string; image_url: { url: string } }
    )[] = [
      {
        type: "text",
        text: "Extract all visible text from this image. Return it as clean, structured text. Preserve table layouts if present.",
      },
    ];

    if (imageUrl) {
      content.push({ type: "image_url", image_url: { url: imageUrl } });
    } else {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${imageBase64}` },
      });
    }

    const res = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-ocr-v1",
          messages: [{ role: "user", content }],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      }, { ruleId: "agents.ocr.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!res.ok) {
      const errText = await res.text();
      return { error: `OCR failed: ${res.status}`, details: errText };
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || "",
      model: "nemotron-ocr-v1",
    };
  },
});

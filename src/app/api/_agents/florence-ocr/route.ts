import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * FLORENCE OCR & VISUAL GROUNDING — Uses NVIDIA Florence V2 for
 * document OCR, image captioning, and visual question answering.
 */

export const POST = createAgentRoute({
  name: "florence-ocr",
  handler: async ({ input, email, userId }) => {

    const { action = "caption", image_url, question } = input as {
      action?: "caption" | "ocr" | "vqa";
      image_url?: string;
      question?: string;
    };

    if (!image_url) {
      return ({ error: "image_url is required." });
    }
    

    const prompts: Record<string, string> = {
      caption: "Describe this image in detail. Include all visible text, objects, colors, and layout.",
      ocr: "Extract ALL text visible in this image. Output only the extracted text, preserving layout and formatting as much as possible.",
      vqa: question || "What is shown in this image?",
    };

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "microsoft/florence-v2",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompts[action] || prompts.caption },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    const data = await res.json();
    const result = data?.choices?.[0]?.message?.content || "";

    return ({
      success: true,
      model: "florence-v2",
      action,
      result,
      word_count: result.split(/\s+/).length,
    });
  
  },
});


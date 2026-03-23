import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * FLORENCE OCR & VISUAL GROUNDING — Uses NVIDIA Florence V2 for
 * document OCR, image captioning, and visual question answering.
 */

export async function POST(request: Request) {
  try {
    const { action = "caption", image_url, question } = await request.json();

    if (!image_url) {
      return NextResponse.json({ error: "image_url is required." }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      model: "florence-v2",
      action,
      result,
      word_count: result.split(/\s+/).length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Florence error", details: String(error) }, { status: 500 });
  }
}

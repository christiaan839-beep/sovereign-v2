import { auth } from "@clerk/nextjs/server";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { image_url, question = "Describe this image in detail.", mode = "analyze" } = await request.json();

    if (!image_url) {
      return NextResponse.json({ error: "image_url is required (direct URL to image)." }, { status: 400 });
    }

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
              { type: "text", text: modePrompts[mode] || modePrompts.analyze },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      model: "Qwen 3.5 VLM (400B MoE Vision-Language)",
      mode,
      image_url,
      result: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
      license: "Apache 2.0 — commercial use permitted",
    });
  } catch (error) {
    return NextResponse.json({ error: "Vision agent error", details: String(error) }, { status: 500 });
  }
}

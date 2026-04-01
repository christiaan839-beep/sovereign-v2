import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * OCR — Uses nemotron-ocr-v1 to extract text from images (screenshots, PDFs, competitor pricing tables).
 * Essential for the Ghost Fleet SDR to read G2 review screenshots.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { imageBase64, imageUrl } = await req.json();
    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: "Provide either `imageBase64` or `imageUrl`." }, { status: 400 });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const content: ({ type: string; text: string } | { type: string; image_url: { url: string } })[] = [
      { type: "text", text: "Extract all visible text from this image. Return it as clean, structured text. Preserve table layouts if present." }
    ];

    if (imageUrl) {
      content.push({ type: "image_url", image_url: { url: imageUrl } });
    } else {
      content.push({ type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } });
    }

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-ocr-v1",
        messages: [{ role: "user", content }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `OCR failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.choices?.[0]?.message?.content || "",
      model: "nemotron-ocr-v1",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

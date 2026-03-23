import { NextResponse } from "next/server";

/**
 * VISUAL REASONING — Uses cosmos-reason2-8b for deep visual analysis.
 * Can analyze competitor screenshots, landing page layouts, and design patterns.
 */
export async function POST(req: Request) {
  try {
    const { imageUrl, question = "Analyze this image and provide detailed insights." } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "Missing `imageUrl`." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/cosmos-reason2-8b",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Visual reasoning failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      analysis: data.choices?.[0]?.message?.content || "",
      model: "cosmos-reason2-8b",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

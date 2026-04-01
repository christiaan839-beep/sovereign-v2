import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * AI IMAGE GENERATION — Uses FLUX.2 Klein 4B from Black Forest Labs via NIM.
 * Generates high-quality images for blog headers, social media, and client deliverables.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { prompt, width = 1024, height = 1024 } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Missing `prompt`." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux.2-klein-4b",
        prompt,
        width,
        height,
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Image gen failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json || null;

    return NextResponse.json({
      imageUrl,
      model: "FLUX.2 Klein 4B",
      prompt,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * IMAGE GENERATION API — Uses NVIDIA Stable Diffusion 3 Medium via NIM
 * to generate high-quality images for the Content Factory.
 * 
 * Generates social media imagery, product shots, marketing assets.
 */

export async function POST(request: Request) {
  try {
    const { prompt, negative_prompt = "", width = 1024, height = 1024, steps = 28 } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }
    

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux1-schnell",
        prompt: `${prompt}, ultra high quality, professional photography, 8k resolution, sharp focus`,
        negative_prompt: `${negative_prompt}, blurry, low quality, pixelated, watermark, text`,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        steps,
        n: 1,
      }),
    });

    if (!nimRes.ok) {
      const errorText = await nimRes.text();
      return NextResponse.json({
        error: `NVIDIA NIM Image Generation Error: ${nimRes.status}`,
        details: errorText,
      }, { status: nimRes.status });
    }

    const data = await nimRes.json();

    return NextResponse.json({
      success: true,
      model: "flux1-schnell",
      prompt,
      image: data.data?.[0] || null,
      dimensions: `${width}x${height}`,
      steps,
    });
  } catch (error) {
    return NextResponse.json({ error: "Image generation error", details: String(error) }, { status: 500 });
  }
}

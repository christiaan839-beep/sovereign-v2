import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";

/**
 * Landing Page Generator API
 * 
 * Uses Gemini 2.5 Pro to generate complete landing page HTML
 * with copy, structure, and styling based on a business description.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const { businessName, industry, offer, targetAudience, style } = await req.json();

    if (!businessName || !offer) {
      return NextResponse.json({ error: "Missing businessName or offer" }, { status: 400 });
    }

    // ⚡ SOVEREIGN EXASCALE TENSOR-RT PROTOCOL ⚡
    // Hard-routing the Edge API to NVIDIA NIM clusters via nvapi key.
    // Upgrading from Local 8B to Cloud 340B reasoning capability.

    const nimPayload = {
       model: "nvidia/nemotron-4-340b-instruct",
       messages: [
         { 
            role: "user", 
            content: `You are an elite landing page designer and copywriter. Generate a complete, production-ready HTML landing page for ${businessName}. Offer: ${offer}. Style: ${style}. Output ONLY HTML.` 
         }
       ],
       max_tokens: 2000,
       stream: false
    };

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
       method: "POST",
       headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
       },
       body: JSON.stringify(nimPayload)
    });

    if (!nimRes.ok) {
       throw new Error("NVIDIA NIM Matrix Offline. Check API Key validity.");
    }

    const nimData = await nimRes.json();
    const pageHtml = nimData.choices[0].message.content;
    const imagePrompt = `Cinematic photorealistic rendering for ${businessName}`;

    return NextResponse.json({
      success: true,
      html: pageHtml,
      imagePrompt,
      metadata: { businessName, industry, offer, generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[Page Generator Error]:", error);
    return NextResponse.json({ error: "Page generation failed" }, { status: 500 });
  }
}

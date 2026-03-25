import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * VERCEL AI GATEWAY PROXY — Routes to MiniMax M2.7 via Vercel's unified AI Gateway.
 * Provides automatic retries, failover, cost tracking, and observability.
 * 
 * Available models:
 * - minimax/minimax-m2.7 (standard)
 * - minimax/minimax-m2.7-highspeed (~100 tok/s)
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      messages,
      model = "minimax/minimax-m2.7-highspeed",
      max_tokens = 1024,
      temperature = 0.7,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required." }, { status: 400 });
    }

    // Vercel AI Gateway uses the standard OpenAI-compatible endpoint
    // The gateway handles routing, retries, and failover automatically
    const gatewayResponse = await fetch("https://api.vercel.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.VERCEL_AI_GATEWAY_KEY || await getNimKey()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
        stream: false,
      }),
    });

    if (!gatewayResponse.ok) {
      // Fallback to NVIDIA NIM if Vercel AI Gateway is not configured
      if (await getNimKey()) {
        const fallbackRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${await getNimKey()}`,
          },
          body: JSON.stringify({
            model: "minimaxai/minimax-m2.1",
            messages,
            max_tokens,
            temperature,
            stream: false,
          }),
        });
        const fallbackData = await fallbackRes.json();
        return NextResponse.json({
          success: true,
          provider: "NVIDIA NIM (Fallback)",
          model: "minimax-m2.1",
          result: fallbackData,
        });
      }
      return NextResponse.json({ error: "AI Gateway not configured" }, { status: 500 });
    }

    const data = await gatewayResponse.json();
    return NextResponse.json({
      success: true,
      provider: "Vercel AI Gateway",
      model,
      result: data,
    });
  } catch (error) {
    return NextResponse.json({ error: "Gateway error", details: String(error) }, { status: 500 });
  }
}

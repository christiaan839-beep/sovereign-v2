import { NextRequest, NextResponse } from "next/server";

function getNimKey(): string {
  return process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || "";
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, mode = "text", imageUrl, audioContext } = await req.json();
    if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

    const key = getNimKey();
    if (!key) return NextResponse.json({ error: "NVIDIA NIM key not configured" }, { status: 500 });

    // Build messages based on mode
    const messages: Array<{role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}> = [];

    const systemPrompt = `You are Sovereign, an AI assistant with a warm, direct personality. You're knowledgeable but not robotic. You speak like a trusted colleague — helpful, occasionally witty, never corporate. You don't say "I'd be happy to" or "Certainly!" — you just help. When analyzing images or audio transcripts, be specific about what you observe. When giving advice, be actionable.`;

    messages.push({ role: "system", content: systemPrompt });

    if (mode === "vision" && imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else if (mode === "voice" && audioContext) {
      messages.push({
        role: "user",
        content: `[Voice transcript]: "${audioContext}"\n\nUser's request: ${prompt}`
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    // Use Nemotron 3 Omni for multimodal, fall back to Ultra for text
    const model = mode === "vision"
      ? "nvidia/nemotron-nano-12b-v2-vl"  // Vision-language model
      : "nvidia/llama-3.1-nemotron-ultra-253b-v1"; // Text/voice

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `NIM error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || "No response generated.";

    return NextResponse.json({
      result: answer,
      model,
      mode,
      personality: "sovereign",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

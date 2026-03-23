import { NextResponse } from "next/server";

/**
 * CONTENT SAFETY GUARDRAILS — Uses nemotron-content-safety-reasoning-4b
 * to detect prompt injection, toxic outputs, and unsafe content.
 * This should be used as a pre-flight check on all user-facing AI endpoints.
 */
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "Missing text." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-content-safety-reasoning-4b",
        messages: [
          { role: "system", content: "You are a content safety classifier. Analyze the following text and respond with a JSON object: {\"safe\": true/false, \"category\": \"none|toxic|injection|pii|harmful\", \"confidence\": 0.0-1.0, \"explanation\": \"brief reason\"}" },
          { role: "user", content: text },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      // Fail-open: if the safety model is down, allow the request but flag it
      return NextResponse.json({ safe: true, category: "unknown", confidence: 0, explanation: "Safety model unavailable — fail-open policy." });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : { safe: true, category: "none", confidence: 0.5 };
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ safe: true, category: "parse_error", confidence: 0, explanation: raw.slice(0, 200) });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

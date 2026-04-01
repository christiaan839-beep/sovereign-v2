import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

function getNimKey(): string {
  return process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || "";
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { query, sources = ["web", "docs"] } = await req.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const key = getNimKey();
    if (!key) return NextResponse.json({ error: "NIM key not configured" }, { status: 500 });

    // Use Nemotron Ultra for comprehensive search synthesis
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        messages: [
          {
            role: "system",
            content: `You are a research analyst. When given a query, provide a comprehensive analysis with:
1. Direct answer to the question
2. Key findings (3-5 bullet points)
3. Sources or reasoning used
4. Confidence level (high/medium/low)

Be specific, factual, and cite your reasoning. No filler.`
          },
          { role: "user", content: `Research query: ${query}\n\nSources to consider: ${sources.join(", ")}` }
        ],
        max_tokens: 2048,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Search failed: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || "No results found.";

    return NextResponse.json({
      result,
      query,
      sources,
      model: "nemotron-ultra-253b",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Search failed" }, { status: 500 });
  }
}

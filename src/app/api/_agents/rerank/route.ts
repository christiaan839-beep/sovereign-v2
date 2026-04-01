import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * RERANK — Uses llama-nemotron-rerank-1b-v2 to re-score search results.
 * Makes RAG retrieval dramatically more accurate by re-ordering by relevance.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { query, documents } = await req.json();
    if (!query || !documents || !Array.isArray(documents)) {
      return NextResponse.json({ error: "Missing `query` (string) and `documents` (string[])." }, { status: 400 });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/ranking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/llama-nemotron-rerank-1b-v2",
        query: { text: query },
        passages: documents.map((d: string) => ({ text: d })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Rerank failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      rankings: data.rankings || [],
      model: "llama-nemotron-rerank-1b-v2",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

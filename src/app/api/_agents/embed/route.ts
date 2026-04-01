import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * FREE EMBEDDINGS — Uses llama-nemotron-embed-1b-v2 from NVIDIA NIM.
 * Replaces OpenAI embeddings entirely. Zero cost.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { texts } = await req.json();
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "Missing `texts` array." }, { status: 400 });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const res = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/llama-nemotron-embed-1b-v2",
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Embedding failed: ${res.status}`, details: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      embeddings: data.data?.map((d: { embedding: number[] }) => d.embedding) || [],
      model: "llama-nemotron-embed-1b-v2",
      usage: data.usage,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

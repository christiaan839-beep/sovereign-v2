import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/nim");

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * POST /api/nim
 * Proxy to NVIDIA NIM API. Accepts { model, prompt, maxTokens? }.
 * Requires authentication.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    log.error("NVIDIA_NIM_API_KEY not configured");
    return NextResponse.json(
      { error: "NVIDIA NIM API key not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { model, prompt, maxTokens } = body;

    if (!model || typeof model !== "string") {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const nimPayload = {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens || 1024,
      temperature: 0.7,
    };

    const response = await fetch(NIM_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(nimPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("NIM API error", {
        status: response.status,
        error: errorText.slice(0, 500),
      });
      return NextResponse.json(
        { error: "NIM API error", details: errorText.slice(0, 500) },
        { status: response.status }
      );
    }

    const data = await response.json();
    log.info("NIM proxy success", { model, userId });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("NIM proxy failed", { error: msg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

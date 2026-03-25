import { NextResponse } from "next/server";
import {
  isOllamaAvailable,
  listOllamaModels,
  ollamaChatStream,
} from "@/lib/ollama";

/**
 * GET /api/ollama
 * Returns local Ollama availability and installed models.
 */
export async function GET() {
  const available = await isOllamaAvailable();

  if (!available) {
    return NextResponse.json({ available: false, models: [] });
  }

  try {
    const models = await listOllamaModels();
    return NextResponse.json({ available: true, models });
  } catch {
    return NextResponse.json({ available: true, models: [] });
  }
}

/**
 * POST /api/ollama
 * Proxies a streaming chat request to the local Ollama instance.
 *
 * Body: { model: string, messages: Array<{ role: string, content: string }> }
 */
export async function POST(request: Request) {
  try {
    const available = await isOllamaAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Ollama is not running on localhost:11434" },
        { status: 503 }
      );
    }

    const { model, messages } = await request.json();

    if (!model || !messages) {
      return NextResponse.json(
        { error: "model and messages are required" },
        { status: 400 }
      );
    }

    const stream = ollamaChatStream(model, messages);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Ollama proxy error", details: String(error) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { guardRoute, sanitizeString, errorResponse } from "@/lib/api-guard";
import { nimChat } from "@/lib/nvidia";

/**
 * CUSTOMER SUPPORT BOT — RAG-powered support agent.
 *
 * Answers customer questions using company knowledge base.
 * Escalates to human when confidence is low.
 *
 * Input: { question, context?, history? }
 * Output: { answer, confidence, shouldEscalate, sources }
 */
export async function POST(req: Request) {
  try {
    const guard = await guardRoute();
    if (!guard.authorized) return guard.response;

    const body = await req.json();
    const question = sanitizeString(body.question, 2000);
    const context = sanitizeString(body.context, 10000);
    const history = Array.isArray(body.history)
      ? body.history.slice(-10).map((m: { role: string; content: string }) => ({
          role: sanitizeString(m.role, 20),
          content: sanitizeString(m.content, 2000),
        }))
      : [];

    if (!question) {
      return errorResponse("Missing 'question' field", 400, "MISSING_FIELD");
    }

    // Try to recall relevant context from vector memory
    let ragContext = context || "";
    if (!ragContext) {
      try {
        const { recall } = await import("@/lib/memory");
        const memories = await recall(question, 5);
        if (Array.isArray(memories) && memories.length > 0) {
          ragContext = memories
            .slice(0, 5)
            .map((m: { metadata?: { text?: string } }) => m.metadata?.text || "")
            .filter(Boolean)
            .join("\n\n");
        }
      } catch {
        // Memory unavailable — continue without RAG context
      }
    }

    const systemPrompt = `You are a helpful customer support agent for Sovereign Matrix, an AI agent orchestration platform.

${ragContext ? `Use this knowledge base context to answer questions:\n\n${ragContext}\n\n` : ""}

Rules:
- Answer questions accurately based on available context
- If you're not sure about something, say so honestly
- For billing, account, or security questions you can't resolve, recommend contacting support
- Be concise and professional
- End your response with a JSON block: {"confidence": 0.0-1.0, "category": "general|billing|technical|account"}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
      { role: "user" as const, content: question },
    ];

    const result = await nimChat("mistralai/mistral-nemotron", messages, {
      maxTokens: 1000,
      temperature: 0.3,
    });

    const resultStr = typeof result === "string" ? result : "";

    // Extract confidence from response
    let confidence = 0.7;
    let category = "general";
    const jsonMatch = resultStr.match(/\{"confidence":\s*([\d.]+).*?"category":\s*"(\w+)"\}/);
    if (jsonMatch) {
      confidence = parseFloat(jsonMatch[1]);
      category = jsonMatch[2];
    }

    // Clean the JSON block from the visible answer
    const answer = resultStr.replace(/\s*\{["']?confidence["']?:.*\}\s*$/, "").trim();
    const shouldEscalate = confidence < 0.5;

    return NextResponse.json({
      answer,
      confidence,
      category,
      shouldEscalate,
      hasContext: !!ragContext,
      model: "mistral-nemotron",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500, "AGENT_ERROR");
  }
}

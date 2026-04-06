import { createAgentRoute } from "@/lib/agent-factory";
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
export const POST = createAgentRoute({
  name: "support-bot",
  requiredFields: ["question"],
  handler: async ({ input }) => {
    const { question, context, history: rawHistory } = input as Record<string, unknown>;
    const questionStr = question as string;
    const contextStr = (context as string) || "";

    const history = Array.isArray(rawHistory)
      ? rawHistory.slice(-10).map((m: { role: string; content: string }) => ({
          role: m.role as string,
          content: (m.content as string).slice(0, 2000),
        }))
      : [];

    // Try to recall relevant context from vector memory
    let ragContext = contextStr;
    if (!ragContext) {
      try {
        const { recall } = await import("@/lib/memory");
        const memories = await recall(questionStr, 5);
        if (Array.isArray(memories) && memories.length > 0) {
          ragContext = memories
            .slice(0, 5)
            .map((m: { entry: { text: string }; score: number }) => m.entry.text || "")
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
      { role: "user" as const, content: questionStr },
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

    return {
      answer,
      confidence,
      category,
      shouldEscalate,
      hasContext: !!ragContext,
      model: "mistral-nemotron",
    };
  },
});

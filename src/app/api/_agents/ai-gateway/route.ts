import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * VERCEL AI GATEWAY PROXY — Routes to MiniMax M2.7 via Vercel's unified AI Gateway.
 * Provides automatic retries, failover, cost tracking, and observability.
 *
 * Available models:
 * - minimax/minimax-m2.7 (standard)
 * - minimax/minimax-m2.7-highspeed (~100 tok/s)
 */

export const POST = createAgentRoute({
  name: "ai-gateway",
  requiredFields: ["messages"],
  handler: async ({ input }) => {
    const {
      messages,
      model = "minimax/minimax-m2.7-highspeed",
      max_tokens = 1024,
      temperature = 0.7,
    } = input as Record<string, unknown>;

    if (!Array.isArray(messages)) {
      throw new Error("Messages must be an array.");
    }

    // Vercel AI Gateway uses the standard OpenAI-compatible endpoint
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
        return {
          success: true,
          provider: "NVIDIA NIM (Fallback)",
          model: "minimax-m2.1",
          result: fallbackData,
        };
      }
      throw new Error("AI Gateway not configured");
    }

    const data = await gatewayResponse.json();
    return {
      success: true,
      provider: "Vercel AI Gateway",
      model,
      result: data,
    };
  },
});

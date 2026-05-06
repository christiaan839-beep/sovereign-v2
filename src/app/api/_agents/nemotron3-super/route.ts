import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * NEMOTRON 3 SUPER 120B — The newest hybrid Mamba-Transformer MoE.
 * 
 * Uses Nemotron 3 Super (120B total, 12B active) for:
 * - Ultra-long context analysis (up to 1M tokens)
 * - Complex multi-step reasoning
 * - Enterprise document understanding
 * - Strategic planning at scale
 * 
 * LICENSE: NVIDIA Open Model License — free for commercial use.
 * Now BYOK-aware via nimChat().
 */

export const POST = createAgentRoute({
  name: "nemotron3-super",
  handler: async ({ input }) => {

    const { prompt, mode = "reason", max_tokens = 2048 } = input as Record<string, any>;

    if (!prompt) {
      return ({ error: "prompt is required." });
    }

    const systemPrompts: Record<string, string> = {
      reason: "You are a senior reasoning engine. Think step-by-step, consider multiple perspectives, and arrive at a well-supported conclusion. Show your chain of thought.",
      analyze: "You are a deep analyst. Extract key insights, identify patterns, assess risks, and provide actionable recommendations. Be thorough and specific.",
      strategize: "You are a world-class strategist. Consider competitive dynamics, market forces, and second-order effects. Propose bold but executable strategies.",
      summarize: "You are a precision summarizer. Distill complex information into clear, concise summaries. Preserve critical details while eliminating noise.",
    };

    const start = Date.now();
    const result = await nimChat(
      "nvidia/nemotron-3-super-120b-a12b",
      [
        { role: "system", content: systemPrompts[mode] || systemPrompts.reason },
        { role: "user", content: prompt },
      ],
      { maxTokens: max_tokens, temperature: mode === "summarize" ? 0.2 : 0.6 }
    );

    return ({
      success: true,
      model: "Nemotron 3 Super 120B (Hybrid Mamba-Transformer MoE)",
      mode,
      result,
      duration_ms: Date.now() - start,
      license: "NVIDIA Open Model License — commercial use permitted",
    });
  
  },
});


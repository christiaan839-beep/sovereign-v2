import { createAgentRoute } from "@/lib/agent-factory";
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
  // Wave 128 M3 batch 18: memory hooks. Long-context reasoning chains
  // compound — prior step's conclusion + mode lets follow-up calls reference
  // the chain ("from your last analyze: …") instead of rebuilding it.
  memory: {
    search: {
      query: (input) =>
        `nemotron3-super ${input.mode ?? "reason"} ${String(input.prompt ?? "").slice(0, 60)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          mode?: string;
          result?: string;
          duration_ms?: number;
        };
        if (!r.result) return null;
        const head = r.result.slice(0, 220).replace(/\s+/g, " ");
        return `n3s[${r.mode ?? "reason"}/${r.duration_ms ?? 0}ms]: ${head}`;
      },
      metadata: (input) => ({
        kind: "nemotron3-super",
        mode: typeof input.mode === "string" ? input.mode : "reason",
      }),
    },
  },
  handler: async ({ input, email, userId }) => {
    const {
      prompt = "",
      mode = "reason",
      max_tokens = 2048,
    } = input as { prompt?: string; mode?: string; max_tokens?: number };

    if (!prompt) {
      return { error: "prompt is required." };
    }

    const systemPrompts: Record<string, string> = {
      reason:
        "You are a senior reasoning engine. Think step-by-step, consider multiple perspectives, and arrive at a well-supported conclusion. Show your chain of thought.",
      analyze:
        "You are a deep analyst. Extract key insights, identify patterns, assess risks, and provide actionable recommendations. Be thorough and specific.",
      strategize:
        "You are a senior strategist. Consider competitive dynamics, market forces, and second-order effects. Propose specific, executable moves with explicit assumptions and the disconfirming evidence that would change them.",
      summarize:
        "You are a precision summarizer. Distill complex information into clear, concise summaries. Preserve critical details while eliminating noise.",
    };

    const start = Date.now();
    const result = await nimChat(
      "nvidia/nemotron-3-super-120b-a12b",
      [
        {
          role: "system",
          content: systemPrompts[mode] || systemPrompts.reason,
        },
        { role: "user", content: prompt },
      ],
      { maxTokens: max_tokens, temperature: mode === "summarize" ? 0.2 : 0.6 },
    );

    return {
      success: true,
      model: "Nemotron 3 Super 120B (Hybrid Mamba-Transformer MoE)",
      mode,
      result,
      duration_ms: Date.now() - start,
      license: "NVIDIA Open Model License — commercial use permitted",
    };
  },
});

import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { verifiedAi } from "@/lib/consensus";

/**
 * GEMINI DEEP THINK — Advanced reasoning with parallel thought streams.
 *
 * Uses Gemini 2.5 Pro's Deep Think mode for problems that need
 * extended reasoning: strategy, math, code architecture, research.
 *
 * Available with Google AI Ultra plan.
 *
 * Input: { problem, context?, thinkingBudget? }
 * Output: { solution, reasoning, confidence }
 */

export const POST = createAgentRoute({
  name: "deep-think",
  requiredFields: ["problem"],
  handler: async ({ input }) => {
    const problem = input.problem as string;
    const prompt = input.prompt as string | undefined;
    const context = (input.context as string) || "";
    const thinkingBudget = (input.thinkingBudget as number) || 8192;
    const useClaude = input.useClaude as boolean | undefined;
    const useConsensus = input.verified as boolean | undefined;

    // Support both { problem } and { prompt } for playbook compatibility
    const taskText = problem || prompt || "";

    // ── Verified AI path — generate + critique + revise for max reliability ──
    if (useConsensus) {
      const systemPrompt = `You are an expert analyst. Think deeply about the problem. Consider multiple angles, pitfalls, and second-order effects. Structure as:

1. ANALYSIS — Break down the core problem
2. APPROACH — Recommended strategy with rationale
3. EXECUTION — Step-by-step implementation
4. RISKS — What could go wrong and mitigations
5. EXPECTED OUTCOME — Measurable results

Be specific. Use numbers. No generic advice.`;

      const fullPrompt = context ? `Context:\n${context}\n\nProblem:\n${taskText}` : taskText;

      const result = await verifiedAi(fullPrompt, {
        system: systemPrompt,
        maxTokens: 3000,
      });

      return {
        solution: result.answer,
        verified: result.verified,
        revised: result.revised,
        confidence: result.confidence,
        critique: result.critique,
        models: result.models,
        mode: "verified-consensus",
      };
    }

    // Claude Extended Thinking path — use when explicitly requested or Gemini key unavailable
    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (useClaude || !geminiKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey && !geminiKey) {
        return { error: "No AI API key configured. Add GOOGLE_GENERATIVE_AI_API_KEY or ANTHROPIC_API_KEY." };
      }
      if (anthropicKey && (useClaude || !geminiKey)) {
        const prompt = context
          ? `Background context:\n${context}\n\nProblem to solve:\n${problem}`
          : problem;

        const solution = await ai(prompt, {
          model: "claude",
          thinking: true,
          system: `You are an expert analyst and strategist. Think deeply about the problem before responding. Consider multiple angles, potential pitfalls, and second-order effects. Structure your response as:

1. ANALYSIS — Break down the core problem
2. APPROACH — Your recommended strategy with rationale
3. EXECUTION — Step-by-step implementation plan
4. RISKS — What could go wrong and mitigations
5. EXPECTED OUTCOME — Measurable results to expect

Be specific. Use numbers. No generic advice.`,
        });

        return {
          solution,
          model: "claude-sonnet-4-extended-thinking",
          mode: "extended-reasoning",
        };
      }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: context
                    ? `Background context:\n${context}\n\nProblem to solve:\n${problem}`
                    : problem,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: `You are an expert analyst and strategist. Think deeply about the problem before responding. Consider multiple angles, potential pitfalls, and second-order effects. Structure your response as:

1. ANALYSIS — Break down the core problem
2. APPROACH — Your recommended strategy with rationale
3. EXECUTION — Step-by-step implementation plan
4. RISKS — What could go wrong and mitigations
5. EXPECTED OUTCOME — Measurable results to expect

Be specific. Use numbers. No generic advice.`,
              },
            ],
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4000,
            thinkingConfig: {
              thinkingBudget,
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return { error: `Gemini API error (${res.status})`, details: errorText };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    // Separate thinking from final response
    const parts = candidate?.content?.parts || [];
    let thinking = "";
    let solution = "";

    for (const part of parts) {
      if (part.thought) {
        thinking += (part.text || "") + "\n";
      } else {
        solution += (part.text || "") + "\n";
      }
    }

    const tokenUsage = data.usageMetadata;

    return {
      solution: solution.trim(),
      thinking: thinking.trim() || undefined,
      thinkingTokens: tokenUsage?.thoughtsTokenCount || 0,
      totalTokens: tokenUsage?.totalTokenCount || 0,
      model: "gemini-2.5-pro-deep-think",
      mode: "extended-reasoning",
    };
  },
});

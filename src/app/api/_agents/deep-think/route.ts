import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { verifiedAi } from "@/lib/consensus";
import { checkpoint as budgetCheckpoint } from "@/lib/execution-budget";
import { createHash } from "node:crypto";

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

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "deep-think",
  requiredFields: ["problem"],
  // Wave 115 M3 batch 9: memory hooks. Per-domain reasoning compounds —
  // last week's strategy/research output on a similar problem class
  // informs this week's solution without re-deriving common framing.
  memory: {
    search: {
      query: (input) => {
        const problem =
          typeof input.problem === "string"
            ? input.problem
            : typeof input.prompt === "string"
              ? input.prompt
              : "";
        return `deep-think ${problem.slice(0, 120)}`;
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          solution?: string;
          confidence?: number;
          problem?: string;
        };
        if (!r.solution) return null;
        const head = r.solution.slice(0, 240).replace(/\s+/g, " ");
        return `solution: ${head}${r.confidence ? ` (conf=${r.confidence})` : ""}`;
      },
      metadata: () => ({ kind: "deep-think" }),
    },
  },
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
      const systemPrompt = `You are an analyst. Think through the problem before answering. Consider multiple angles, pitfalls, and second-order effects. Structure as:

1. ANALYSIS — Break down the core problem
2. APPROACH — Recommended strategy with rationale
3. EXECUTION — Step-by-step implementation
4. RISKS — What could go wrong and mitigations
5. EXPECTED OUTCOME — Measurable results

Be specific. Use numbers. No generic advice.`;

      const fullPrompt = context
        ? `Context:\n${context}\n\nProblem:\n${taskText}`
        : taskText;

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
    const geminiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (useClaude || !geminiKey) {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey && !geminiKey) {
        return {
          error:
            "No AI API key configured. Add GOOGLE_GENERATIVE_AI_API_KEY or ANTHROPIC_API_KEY.",
        };
      }
      if (anthropicKey && (useClaude || !geminiKey)) {
        const prompt = context
          ? `Background context:\n${context}\n\nProblem to solve:\n${problem}`
          : problem;

        const solution = await ai(prompt, {
          model: "claude",
          thinking: true,
          system: `You are an analyst and strategist. Think through the problem before responding. Consider multiple angles, potential pitfalls, and second-order effects. Structure your response as:

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

    // Wave-108 kill-switch coverage: this path bypasses ai() because
    // it uses Gemini 2.5 Pro's `thinkingConfig.thinkingBudget` which
    // isn't exposed through the unified router. Checkpoint here so a
    // runaway loop calling deep-think repeatedly with the same
    // problem still trips wave-106's identical_repeat detector.
    const problemHash = createHash("sha256")
      .update(problem)
      .update(context ?? "")
      .digest("hex")
      .slice(0, 16);
    budgetCheckpoint("ai.deep-think", {
      model: "gemini-2.5-pro",
      thinkingBudget,
      problemHash,
    });

    const res = await outboundFetchAsResponse(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`, {
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
                text: `You are an analyst and strategist. Think through the problem before responding. Consider multiple angles, potential pitfalls, and second-order effects. Structure your response as:

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
      }, { ruleId: "agents.deep-think.route.1", allowedHosts: ["generativelanguage.googleapis.com"] });

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

import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";
import { ai } from "@/lib/ai";

/**
 * NEMOTRON REASONING CHAIN — Multi-step deep reasoning using the
 * Nemotron Ultra 253B model for complex problems that require
 * chain-of-thought analysis.
 *
 * Steps:
 * 1. Decompose the problem into sub-questions
 * 2. Answer each sub-question independently
 * 3. Synthesize into a final coherent answer
 * 4. Self-critique and refine
 */

export const POST = createAgentRoute({
  name: "reasoning-chain",
  requiredFields: ["question"],
  handler: async ({ input }) => {
    const {
      question,
      depth = 3,
      domain = "general",
    } = input as Record<string, unknown>;

    const steps: Array<{
      step: string;
      content: string;
      model: string;
      duration_ms: number;
    }> = [];
    const startTime = Date.now();

    // Step 1: Decompose into sub-questions
    const decomposeStart = Date.now();
    const decomposeRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
          messages: [
            {
              role: "system",
              content: `You are an analyst working in ${domain}. Break the following question into ${depth} essential sub-questions that must be answered to give a complete response. Output ONLY a numbered list of sub-questions.`,
            },
            { role: "user", content: question as string },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      },
    );

    if (!decomposeRes.ok) {
      // Previously fell through to `.json()` unchecked; an empty
      // subQuestions string would silently propagate into every
      // downstream stage (analysis would "analyze" nothing, synthesis
      // would synthesize nothing) while still returning success:true.
      // Decompose is the foundation of the chain — fail loudly here.
      throw new Error(
        `Reasoning chain decompose step failed (status ${decomposeRes.status})`,
      );
    }

    const decomposeData = await decomposeRes.json();
    const subQuestions = decomposeData?.choices?.[0]?.message?.content || "";
    steps.push({
      step: "Decompose",
      content: subQuestions,
      model: "nemotron-ultra-253b",
      duration_ms: Date.now() - decomposeStart,
    });

    // Step 2: Deep analysis on each sub-question
    const analysisStart = Date.now();
    const analysisRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            {
              role: "system",
              content: `You are a deep researcher. Answer each of these sub-questions thoroughly with evidence and reasoning. Domain: ${domain}.`,
            },
            {
              role: "user",
              content: `Original question: ${question}\n\nSub-questions to answer:\n${subQuestions}`,
            },
          ],
          max_tokens: 1500,
          temperature: 0.5,
        }),
      },
    );

    if (!analysisRes.ok) {
      // Same reasoning as the decompose check above — an empty analysis
      // would silently flow into synthesis as "Detailed analysis:\n"
      // with nothing after it, producing a synthesized "answer" built
      // from no actual research while still reporting success:true.
      throw new Error(
        `Reasoning chain deep-analysis step failed (status ${analysisRes.status})`,
      );
    }

    const analysisData = await analysisRes.json();
    const analysis = analysisData?.choices?.[0]?.message?.content || "";
    steps.push({
      step: "Deep Analysis",
      content: analysis,
      model: "deepseek-v3.2",
      duration_ms: Date.now() - analysisStart,
    });

    // Step 3: Synthesize final answer
    const synthStart = Date.now();
    let synthesis = "";
    let synthModel = "nemotron-ultra-253b";

    try {
      synthesis = await ai(
        `Question: ${question}\n\nDetailed analysis:\n${analysis}`,
        {
          model: "claude",
          thinking: true,
          system:
            "Synthesize the analysis below into a clear, actionable final answer. Think deeply about the connections between sub-answers. Be specific, include concrete recommendations, and highlight key insights. Structure with headers.",
        },
      );
      synthModel = "claude-sonnet-4-extended-thinking";
    } catch {
      const synthRes = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getNimKey()}`,
          },
          body: JSON.stringify({
            model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
            messages: [
              {
                role: "system",
                content:
                  "Synthesize the analysis below into a clear, actionable final answer. Be specific, include concrete recommendations, and highlight key insights. Structure with headers.",
              },
              {
                role: "user",
                content: `Question: ${question}\n\nDetailed analysis:\n${analysis}`,
              },
            ],
            max_tokens: 1000,
            temperature: 0.3,
          }),
        },
      );

      if (!synthRes.ok) {
        // Both the primary Claude synthesis (caught above) and this NIM
        // fallback failed — previously this fell through to `.json()`
        // unchecked and returned an empty final_answer as success:true,
        // the single worst case: the whole chain's deliverable missing
        // with no indication anything went wrong.
        throw new Error(
          `Reasoning chain synthesis failed on both primary and fallback (NIM status ${synthRes.status})`,
        );
      }

      const synthData = await synthRes.json();
      synthesis = synthData?.choices?.[0]?.message?.content || "";
    }
    steps.push({
      step: "Synthesis",
      content: synthesis,
      model: synthModel,
      duration_ms: Date.now() - synthStart,
    });

    // Step 4: Self-critique
    const critiqueStart = Date.now();
    const critiqueRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "mistralai/mistral-nemotron",
          messages: [
            {
              role: "system",
              content:
                "Critically review this answer. Identify any weak points, missing perspectives, or logical gaps. Then provide 2-3 specific improvements. Be concise.",
            },
            {
              role: "user",
              content: `Question: ${question}\n\nAnswer:\n${synthesis}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.4,
        }),
      },
    );

    // Unlike the earlier stages, self-critique failing shouldn't discard
    // an already-completed synthesis — degrade honestly instead of
    // throwing away the chain's actual deliverable over its last,
    // optional step.
    let critique = "";
    if (!critiqueRes.ok) {
      critique =
        "Self-critique unavailable — the critique model returned an error.";
    } else {
      const critiqueData = await critiqueRes.json();
      critique = critiqueData?.choices?.[0]?.message?.content || "";
    }
    steps.push({
      step: "Self-Critique",
      content: critique,
      model: "mistral-nemotron",
      duration_ms: Date.now() - critiqueStart,
    });

    return {
      success: true,
      mode: "NEMOTRON_REASONING_CHAIN",
      question,
      domain,
      depth,
      total_duration_ms: Date.now() - startTime,
      models_used: [
        "nemotron-ultra-253b",
        "deepseek-v3.2",
        synthModel,
        "mistral-nemotron",
      ],
      final_answer: synthesis,
      self_critique: critique,
      reasoning_chain: steps.map((s) => ({
        step: s.step,
        model: s.model,
        duration_ms: s.duration_ms,
        preview: s.content.substring(0, 300),
      })),
    };
  },
});

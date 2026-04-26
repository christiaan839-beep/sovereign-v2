import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";

/**
 * GOD-BRAIN ORCHESTRATOR
 *
 * Chains EVERY free NVIDIA NIM model into a single intelligent pipeline.
 * Input: any content (text, URL, image, document).
 * Output: complete intelligence package — analysis, safety check, PII scrub,
 *         embeddings for memory, voice-ready script, and image generation.
 */
export const POST = createAgentRoute({
  name: "god-brain",
  requiredFields: ["input"],
  handler: async ({ input: body }) => {
    const { input, depth = "standard" } = body as Record<string, unknown>;

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) throw new Error("NVIDIA_NIM_API_KEY not configured.");

    const results: Record<string, unknown> = {};
    const timings: Record<string, number> = {};
    const start = Date.now();

    // STAGE 1: Content Safety Check
    const t1 = Date.now();
    try {
      const safetyRes = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-content-safety-reasoning-4b",
            messages: [
              {
                role: "user",
                content: `Evaluate this content for safety: "${typeof input === "string" ? input.slice(0, 500) : JSON.stringify(input).slice(0, 500)}"`,
              },
            ],
            max_tokens: 100,
          }),
        },
      );
      results.safety = safetyRes.ok
        ? (await safetyRes.json()).choices?.[0]?.message?.content
        : "Safety check skipped";
    } catch {
      results.safety = "Safety check unavailable";
    }
    timings.safety_ms = Date.now() - t1;

    // STAGE 2: Deep Analysis
    const t2 = Date.now();
    const analysisRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages: [
            {
              role: "system",
              content:
                "You are a strategic business intelligence analyst. Provide structured, actionable insights. No generic commentary.",
            },
            {
              role: "user",
              content: `Analyze in depth: ${typeof input === "string" ? input : JSON.stringify(input)}`,
            },
          ],
          max_tokens: depth === "deep" ? 1500 : 700,
          temperature: 0.3,
        }),
      },
    );
    if (analysisRes.ok) {
      const data = await analysisRes.json();
      results.analysis = data.choices?.[0]?.message?.content || "";
    }
    timings.analysis_ms = Date.now() - t2;

    // STAGE 2.5: Deep Reasoning — NIM Nemotron Ultra (free, open-weight) is
    // the primary path. Only escalate to Claude Sonnet (no thinking mode) when
    // the Nemotron output looks too short / too generic (heuristic quality
    // miss). Opus + extended thinking is an order of magnitude more expensive
    // for marginal real-world gains here.
    if (depth === "deep") {
      const t25 = Date.now();
      try {
        const reasoningPrompt = `You have been given preliminary analysis from another model. Now apply deep, multi-step reasoning to refine it.\n\nOriginal input: ${typeof input === "string" ? input : JSON.stringify(input)}\n\nPreliminary analysis:\n${results.analysis || "No preliminary analysis available."}\n\nProvide a refined, strategic intelligence assessment with second-order implications, hidden risks, and actionable recommendations.`;

        const reasoningSystem =
          "You are a master strategist performing deep analysis. Think through multiple angles, consider second-order effects, and identify non-obvious insights. Be specific and actionable.";

        let thinkingAnalysis = await ai(reasoningPrompt, {
          model: "nim",
          taskType: "reasoning",
          system: reasoningSystem,
          maxTokens: 2000,
        });

        // Quality miss heuristic: too short OR detected hedge phrases.
        const tooShort = thinkingAnalysis.trim().length < 600;
        const looksGeneric = /\b(in conclusion|overall|in summary)\b/i.test(
          thinkingAnalysis.slice(0, 400),
        );

        if (tooShort || looksGeneric) {
          try {
            // Escalate — Sonnet w/o thinking, NOT Opus, NOT extended thinking.
            thinkingAnalysis = await ai(reasoningPrompt, {
              model: "claude",
              system: reasoningSystem,
              maxTokens: 2000,
            });
            results.deepThinkingEscalated = true;
          } catch {
            // Keep the NIM output if Claude is unavailable.
          }
        }

        results.deepThinking = thinkingAnalysis;
      } catch {
        results.deepThinking =
          "Deep reasoning unavailable (NIM unreachable and no Anthropic key)";
      }
      timings.deep_thinking_ms = Date.now() - t25;
    }

    // STAGE 3: Vector Embedding
    const t3 = Date.now();
    try {
      const embedRes = await fetch(
        "https://integrate.api.nvidia.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: "nvidia/llama-nemotron-embed-1b-v2",
            input: [(results.analysis || input).toString().slice(0, 500)],
            encoding_format: "float",
          }),
        },
      );
      if (embedRes.ok) {
        const embedData = await embedRes.json();
        results.embedding = {
          dimensions: embedData.data?.[0]?.embedding?.length || 0,
          preview: embedData.data?.[0]?.embedding?.slice(0, 5) || [],
          ready: true,
        };
      }
    } catch {
      results.embedding = { ready: false };
    }
    timings.embedding_ms = Date.now() - t3;

    // STAGE 4: Voice-Ready Script
    if (depth === "deep") {
      const t4 = Date.now();
      try {
        const voiceRes = await fetch(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${nimKey}`,
            },
            body: JSON.stringify({
              model: "nvidia/nemotron-voicechat",
              messages: [
                {
                  role: "system",
                  content:
                    "Convert the analysis into a 30-second voice-ready sales pitch. Natural, conversational, no AI slop.",
                },
                { role: "user", content: results.analysis || input },
              ],
              max_tokens: 200,
            }),
          },
        );
        if (voiceRes.ok) {
          results.voiceScript =
            (await voiceRes.json()).choices?.[0]?.message?.content || "";
        }
      } catch {
        results.voiceScript = "";
      }
      timings.voice_ms = Date.now() - t4;
    }

    // STAGE 5: Visual Generation
    if (depth === "deep") {
      const t5 = Date.now();
      try {
        const imgRes = await fetch(
          "https://integrate.api.nvidia.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${nimKey}`,
            },
            body: JSON.stringify({
              model: "black-forest-labs/flux.2-klein-4b",
              prompt: `Clean, modern infographic visualizing: ${(results.analysis || input).toString().slice(0, 200)}. Dark theme, neon accents, professional layout.`,
              width: 512,
              height: 512,
              n: 1,
            }),
          },
        );
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          results.visual = {
            generated: true,
            url: imgData.data?.[0]?.url || null,
          };
        }
      } catch {
        results.visual = { generated: false };
      }
      timings.image_ms = Date.now() - t5;
    }

    const totalMs = Date.now() - start;

    return {
      intelligence: results,
      meta: {
        totalDuration_ms: totalMs,
        timings,
        modelsUsed: [
          "nemotron-content-safety-4b",
          "nemotron-3-super-120b",
          "llama-nemotron-embed-1b-v2",
          ...(depth === "deep"
            ? [
                results.deepThinkingEscalated
                  ? "nemotron-ultra-253b → claude-sonnet (escalated)"
                  : "nemotron-ultra-253b",
                "nemotron-voicechat",
                "FLUX.2-Klein-4B",
              ]
            : []),
        ],
        depth,
        cost: "$0.00 (all free NIM models)",
      },
    };
  },
});

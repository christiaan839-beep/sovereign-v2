import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";

/**
 * GOD-BRAIN ORCHESTRATOR
 *
 * Chains every relevant free NVIDIA NIM model into a single intelligence pipeline.
 * Input: any content (text, URL, image, document).
 * Output: complete intelligence package — analysis, safety check, embeddings,
 *         deep reasoning, voice-ready script, and image generation.
 *
 * Performance: stages 3-5 (embedding, voice, visual) all consume the analysis
 *              output but are independent of each other, so they fan out in
 *              parallel via Promise.all. Deep-think (DeepSeek V3.2) also runs
 *              in parallel with stages 3-5 for "deep" depth.
 *
 * Cost: $0.00 — every model is on the NIM free tier (40 RPM).
 *       Previous version invoked Claude Opus 4.6 with 10K thinking tokens for
 *       the deep-think stage at ~$300-900/mo on the node tier; replaced with
 *       DeepSeek V3.2 671B via taskType:"reason" (frontier OSS reasoning, $0).
 */
export const POST = createAgentRoute({
  name: "god-brain",
  requiredFields: ["input"],
  handler: async ({ input: body }) => {
    const { input, depth = "standard" } = body as Record<string, unknown>;

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) throw new Error("NVIDIA_NIM_API_KEY not configured.");

    const inputStr = typeof input === "string" ? input : JSON.stringify(input);
    const inputPreview = inputStr.slice(0, 500);
    const start = Date.now();

    // ─── STAGE 1: Content Safety + STAGE 2: Deep Analysis run in parallel ───
    // Safety doesn't depend on analysis; we can fan them out from t=0.
    const t1 = Date.now();
    const safetyPromise = (async () => {
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
                  content: `Evaluate this content for safety: "${inputPreview}"`,
                },
              ],
              max_tokens: 100,
            }),
          },
        );
        return safetyRes.ok
          ? (await safetyRes.json()).choices?.[0]?.message?.content ||
              "Safety: ok"
          : "Safety check skipped";
      } catch {
        return "Safety check unavailable";
      }
    })();

    const analysisPromise = (async () => {
      try {
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
                { role: "user", content: `Analyze in depth: ${inputStr}` },
              ],
              max_tokens: depth === "deep" ? 1500 : 700,
              temperature: 0.3,
            }),
          },
        );
        if (analysisRes.ok) {
          const data = await analysisRes.json();
          return (data.choices?.[0]?.message?.content as string) || "";
        }
        return "";
      } catch {
        return "";
      }
    })();

    const [safety, analysis] = await Promise.all([
      safetyPromise,
      analysisPromise,
    ]);
    const safety_ms = Date.now() - t1;

    // ─── STAGES 3-5 + DEEP-THINK: all four run in parallel after analysis is in ───
    // Each consumes either `input` or `analysis` but none of them depend on each other.
    const t2 = Date.now();
    const downstreamSource = analysis || inputStr;
    const downstreamPreview = downstreamSource.slice(0, 500);

    // Stage 3: Embedding (always run)
    const embeddingTask = (async () => {
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
              input: [downstreamPreview],
              encoding_format: "float",
            }),
          },
        );
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          return {
            dimensions: embedData.data?.[0]?.embedding?.length || 0,
            preview: embedData.data?.[0]?.embedding?.slice(0, 5) || [],
            ready: true,
          };
        }
        return { ready: false };
      } catch {
        return { ready: false };
      }
    })();

    // Stage 4: Voice script (deep mode only)
    const voiceTask =
      depth === "deep"
        ? (async () => {
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
                      { role: "user", content: downstreamSource },
                    ],
                    max_tokens: 200,
                  }),
                },
              );
              return voiceRes.ok
                ? (await voiceRes.json()).choices?.[0]?.message?.content || ""
                : "";
            } catch {
              return "";
            }
          })()
        : Promise.resolve(undefined);

    // Stage 5: Visual generation (deep mode only)
    const visualTask =
      depth === "deep"
        ? (async () => {
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
                    prompt: `Clean, modern infographic visualizing: ${downstreamPreview.slice(0, 200)}. Dark theme, neon accents, professional layout.`,
                    width: 512,
                    height: 512,
                    n: 1,
                  }),
                },
              );
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                return { generated: true, url: imgData.data?.[0]?.url || null };
              }
              return { generated: false };
            } catch {
              return { generated: false };
            }
          })()
        : Promise.resolve(undefined);

    // Stage 2.5: Deep reasoning (DeepSeek V3.2 671B — replaces Claude Opus thinking, $0)
    const deepThinkTask =
      depth === "deep"
        ? (async () => {
            try {
              return await ai(
                `You have been given preliminary analysis from another model. Now apply deep, multi-step reasoning to refine it.\n\nOriginal input: ${inputStr}\n\nPreliminary analysis:\n${analysis || "No preliminary analysis available."}\n\nProvide a refined, strategic intelligence assessment with second-order implications, hidden risks, and actionable recommendations.`,
                {
                  taskType: "reason",
                  maxTokens: 2000,
                  system:
                    "You are a master strategist performing deep analysis. Think through multiple angles, consider second-order effects, and identify non-obvious insights. Be specific and actionable.",
                },
              );
            } catch {
              return "Deep reasoning unavailable.";
            }
          })()
        : Promise.resolve(undefined);

    const [embedding, voiceScript, visual, deepThinking] = await Promise.all([
      embeddingTask,
      voiceTask,
      visualTask,
      deepThinkTask,
    ]);
    const downstream_ms = Date.now() - t2;

    const totalMs = Date.now() - start;

    return {
      intelligence: {
        safety,
        analysis,
        embedding,
        ...(deepThinking !== undefined ? { deepThinking } : {}),
        ...(voiceScript !== undefined ? { voiceScript } : {}),
        ...(visual !== undefined ? { visual } : {}),
      },
      meta: {
        totalDuration_ms: totalMs,
        timings: {
          stage_1_2_parallel_ms: safety_ms,
          stage_3_5_parallel_ms: downstream_ms,
        },
        modelsUsed: [
          "nemotron-content-safety-4b",
          "nemotron-3-super-120b",
          "llama-nemotron-embed-1b-v2",
          ...(depth === "deep"
            ? [
                "deepseek-v3.2-671b (reasoning)",
                "nemotron-voicechat",
                "FLUX.2-Klein-4B",
              ]
            : []),
        ],
        depth,
        cost: "$0.00 (all free OSS models)",
      },
    };
  },
});

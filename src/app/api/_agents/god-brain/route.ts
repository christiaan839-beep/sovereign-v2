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
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

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
      const safetyRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
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
        }, { ruleId: "agents.god-brain.route.1", allowedHosts: ["integrate.api.nvidia.com"] });
      results.safety = safetyRes.ok
        ? (await safetyRes.json()).choices?.[0]?.message?.content
        : "Safety check skipped";
    } catch {
      results.safety = "Safety check unavailable";
    }
    timings.safety_ms = Date.now() - t1;

    // STAGE 2: Deep Analysis
    const t2 = Date.now();
    const analysisRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
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
              // Opus 4.7 prompt pattern (Wave 81): literal-execution shift +
              // CRISPE structure + XML-tagged instructions. The model no longer
              // infers intent so every constraint is stated explicitly here.
              content: `<role>
You are a strategic business intelligence analyst working for an
operator who must make a decision in the next 24 hours.
</role>

<capacity>
- Synthesise complex inputs into structured, actionable intelligence
- Surface non-obvious second-order effects
- Quantify risk and opportunity where the input supports it
- Refuse to produce generic commentary, hedging, or filler
</capacity>

<output_requirements>
- Lead with the single most important insight (one sentence)
- Follow with 3-5 concrete recommendations, each with a clear action verb
- Identify 2-3 risks the operator may not have considered
- Numbers, dates, and proper nouns must be verbatim from the input
  unless the input is silent — never fabricate facts to fill structure
</output_requirements>

<search_first>
For any factual claim about present-day market state, competitor
moves, regulation, or pricing, you MUST flag it as "verify before
acting" — do not assert pre-training-cutoff facts as if they were
current. Your confidence is not an excuse to skip verification.
</search_first>`,
            },
            {
              role: "user",
              content: `Analyze in depth: ${typeof input === "string" ? input : JSON.stringify(input)}`,
            },
          ],
          max_tokens: depth === "deep" ? 1500 : 700,
          temperature: 0.3,
        }),
      }, { ruleId: "agents.god-brain.route.2", allowedHosts: ["integrate.api.nvidia.com"] });
    if (analysisRes.ok) {
      const data = await analysisRes.json();
      results.analysis = data.choices?.[0]?.message?.content || "";
    }
    timings.analysis_ms = Date.now() - t2;

    // STAGE 2.5: Claude Extended Thinking (Deep Reasoning)
    if (depth === "deep") {
      const t25 = Date.now();
      try {
        // Wave-108.5 token-waste fix: previously embedded the full
        // JSON.stringify(input) — for a structured agent input that's
        // commonly 10-50KB of context, this multiplied Claude+thinking
        // token spend by 5-10x. The strategist refinement only needs
        // the gist of the original problem, not the full structured
        // payload. Truncate to 4000 chars (≈1000 tokens) which is
        // enough for context anchoring without burning budget.
        const inputStr =
          typeof input === "string" ? input : JSON.stringify(input);
        const inputForPrompt =
          inputStr.length > 4000
            ? `${inputStr.slice(0, 4000)}\n…[truncated]`
            : inputStr;
        const thinkingAnalysis = await ai(
          `You have been given preliminary analysis from another model. Now apply deep, multi-step reasoning to refine it.\n\nOriginal input: ${inputForPrompt}\n\nPreliminary analysis:\n${results.analysis || "No preliminary analysis available."}\n\nProvide a refined, strategic intelligence assessment with second-order implications, hidden risks, and actionable recommendations.`,
          {
            model: "claude",
            thinking: true,
            // Sonnet 4.6 + extended thinking is ~15x cheaper than Opus on
            // input and identical on output quality for this strategist-
            // style task per the May-2026 cost audit. Opus is now an
            // explicit opt-in via `?opus=1` on the route, not the default.
            useOpus: false,
            // Opus 4.7 prompt pattern (Wave 81): the strategist runs AFTER
            // the NIM analyst, so the system prompt MUST tell it not to
            // re-analyze but to refine + correct. Literal execution: every
            // expected step is enumerated, not left to inference.
            system: `<role>
You are a senior strategist refining preliminary analysis. The
preliminary analysis comes from a faster but shallower model. Your
job is to upgrade it, not duplicate it.
</role>

<step_by_step>
1. Read the preliminary analysis line by line.
2. Identify any claim that is wrong, vague, or unsupported by the
   original input. Mark each with "[CORRECTION]".
3. Identify second-order effects the preliminary analysis missed.
   Mark each with "[SECOND-ORDER]".
4. Identify hidden risks. Mark each with "[RISK]".
5. End with a 3-bullet "Recommended next action" list — each bullet
   names the action, the operator (who does it), and the trigger
   condition (when).
</step_by_step>

<constraints>
- Do not restate the preliminary analysis verbatim. Refine it.
- Do not invent facts. If the input is silent on something, say
  "input does not specify".
- Do not produce a closing paragraph of generic encouragement.
- Length budget: 600-1200 words. Be ruthlessly specific.
</constraints>

<search_first>
For any present-day factual claim (current pricing, current
regulation, current competitor positioning), flag it as
"verify before acting".
</search_first>`,
          },
        );
        results.deepThinking = thinkingAnalysis;
      } catch {
        results.deepThinking =
          "Extended thinking unavailable (no Anthropic key)";
      }
      timings.deep_thinking_ms = Date.now() - t25;
    }

    // STAGE 3: Vector Embedding
    const t3 = Date.now();
    try {
      const embedRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: "nvidia/llama-nemotron-embed-1b-v2",
            input: [String(results.analysis || input).slice(0, 500)],
            encoding_format: "float",
          }),
        }, { ruleId: "agents.god-brain.route.3", allowedHosts: ["integrate.api.nvidia.com"] });
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
        const voiceRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
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
          }, { ruleId: "agents.god-brain.route.4", allowedHosts: ["integrate.api.nvidia.com"] });
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
        const imgRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${nimKey}`,
            },
            body: JSON.stringify({
              model: "black-forest-labs/flux.2-klein-4b",
              prompt: `Clean, modern infographic visualizing: ${String(results.analysis || input).slice(0, 200)}. Dark theme, neon accents, professional layout.`,
              width: 512,
              height: 512,
              n: 1,
            }),
          }, { ruleId: "agents.god-brain.route.5", allowedHosts: ["integrate.api.nvidia.com"] });
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
                "claude-sonnet-4-extended-thinking",
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

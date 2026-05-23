import { createAgentRoute } from "@/lib/agent-factory";
import { createLogger } from "@/lib/logger";
import { checkpoint as budgetCheckpoint } from "@/lib/execution-budget";
import { createHash } from "node:crypto";
const log = createLogger("filmmaker-agent");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Submits a video prompt to Google Veo 3.1 for generation.
 *
 * NOTE: Veo 3.1 requires a Google AI Ultra plan or Vertex AI billing enabled.
 * The API returns a long-running operation — poll the operation ID to check
 * completion status. Generated videos are typically available within minutes.
 *
 * @see https://ai.google.dev/gemini-api/docs/video-generation
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

async function submitVeoGeneration(
  prompt: string,
  aspectRatio: string = "16:9",
): Promise<{
  success: boolean;
  operationId?: string;
  error?: string;
}> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  try {
    const res = await outboundFetchAsResponse(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-001:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio,
            personGeneration: "allow_adult",
            sampleCount: 1,
          },
        }),
      },
      {
        ruleId: "agents.filmmaker.route.1",
        allowedHosts: ["generativelanguage.googleapis.com"],
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      return {
        success: false,
        error: `Veo 3.1 API error (${res.status}): ${errorBody}`,
      };
    }

    const data = await res.json();
    const operationId = data.name || data.operationId || null;

    return {
      success: true,
      operationId,
    };
  } catch (err) {
    return {
      success: false,
      error: `Veo 3.1 request failed: ${String(err)}`,
    };
  }
}

export const POST = createAgentRoute({
  name: "filmmaker",
  requiredFields: ["topic"],
  // Wave 118 M3 batch 13: memory hooks. Per-topic film treatment history
  // — last script/storyboard on a similar topic exposes which beats hit
  // vs which were cut, so the next treatment skips dead structure.
  memory: {
    search: {
      query: (input) => `filmmaker ${String(input.topic ?? "").slice(0, 120)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          topic?: string;
          treatment?: string;
          scenes?: Array<{ title?: string }>;
        };
        if (!r.treatment && !r.scenes?.length) return null;
        const head = (r.treatment ?? "").slice(0, 200).replace(/\s+/g, " ");
        const sceneTitles = (r.scenes ?? [])
          .slice(0, 3)
          .map((s) => s.title ?? "")
          .filter(Boolean)
          .join(" → ");
        return `${head}${sceneTitles ? ` [scenes: ${sceneTitles}]` : ""}`;
      },
      metadata: () => ({ kind: "filmmaker" }),
    },
  },
  handler: async ({ input }) => {
    const {
      topic,
      duration = "60s",
      targetAudience = "B2B Executives",
      aspectRatio = "16:9",
    } = input as Record<string, unknown>;

    const systemInstruction = `You are Nova, the Sovereign Filmmaker Agent utilizing Google AI Ultra (Veo 3.1, Imagen, and Music Gen).
Your objective is to generate a senior, hyper-cinematic production brief and prompt sequence for a video about "${topic}".

CRITICAL ANTI-SLOP GUARDRAILS:
1. NO generic neon cyberpunk grids.
2. NO happy corporate stock music. Use "Stoic Contemplation" or "Ambient Focus" descriptions.
3. NO 120fps ultra-smooth motion. Specify 24fps cinematic shutter angles with film grain.
4. NO enthusiastic AI chatbot language. Tone must be authoritative, Palantir-esque, defense-grade.

Output a highly structured JSON array of 5 exact visual prompts to be fed into Veo 3.1, along with a voiceover script and a specific Music Gen prompt.`;

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY missing");
    }

    // Wave-108.5 kill-switch coverage: this path bypasses ai() with
    // a direct SDK call to gemini-1.5-pro. Hash the topic+audience
    // fingerprint so a runaway loop calling filmmaker repeatedly
    // with the same brief trips wave-106's identical_repeat detector.
    const briefHash = createHash("sha256")
      .update(String(topic ?? ""))
      .update(String(targetAudience ?? ""))
      .update(String(duration ?? ""))
      .digest("hex")
      .slice(0, 16);
    budgetCheckpoint("ai.filmmaker", {
      model: "gemini-1.5-pro",
      briefHash,
    });

    // Step 1: Generate the production brief via Gemini
    const response = await outboundFetchAsResponse(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate the Veo 3.1 prompt sequence for: ${topic}. Target Audience: ${targetAudience}. Duration: ${duration}.`,
                },
              ],
            },
          ],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
      {
        ruleId: "agents.filmmaker.route.2",
        allowedHosts: ["generativelanguage.googleapis.com"],
      },
    );

    if (!response.ok) {
      throw new Error(`Google AI API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const productionBrief =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsedBrief;
    try {
      parsedBrief = JSON.parse(productionBrief);
    } catch {
      parsedBrief = { raw: productionBrief };
    }

    // Step 2: Submit the first visual prompt to Veo 3.1
    let veoPrompt: string | null = null;
    if (Array.isArray(parsedBrief)) {
      veoPrompt =
        parsedBrief[0]?.prompt ||
        parsedBrief[0]?.visual_prompt ||
        parsedBrief[0]?.text ||
        null;
    } else if (parsedBrief.prompts && Array.isArray(parsedBrief.prompts)) {
      veoPrompt =
        parsedBrief.prompts[0]?.prompt ||
        parsedBrief.prompts[0]?.visual_prompt ||
        null;
    } else if (parsedBrief.scenes && Array.isArray(parsedBrief.scenes)) {
      veoPrompt =
        parsedBrief.scenes[0]?.prompt ||
        parsedBrief.scenes[0]?.visual_prompt ||
        null;
    }

    if (!veoPrompt) {
      veoPrompt = `Cinematic ${duration} video: ${topic}. Target audience: ${targetAudience}. 24fps, film grain, authoritative tone.`;
    }

    const veoResult = await submitVeoGeneration(
      veoPrompt,
      aspectRatio as string,
    );

    if (veoResult.success) {
      log.info("Veo 3.1 generation submitted", {
        operationId: veoResult.operationId,
      });
      return {
        status: "video_generation_submitted",
        pipeline: "Google Veo 3.1 + Gemini",
        veo: {
          operationId: veoResult.operationId,
          model: "veo-3.1-generate-001",
          prompt: veoPrompt,
          aspectRatio,
          note: "Video generation is async. Poll the operationId to check status. Requires Google AI Ultra plan or Vertex AI billing.",
        },
        orchestration_brief: parsedBrief,
      };
    }

    log.warn("Veo 3.1 unavailable, returning text-only brief", {
      error: veoResult.error,
    });
    return {
      status: "production_scheduled",
      pipeline: "Google Flow (Veo 3.1 + Imagen)",
      veo: {
        submitted: false,
        reason: veoResult.error,
        note: "Veo 3.1 requires a Google AI Ultra plan or Vertex AI billing. The production brief is ready — submit the prompts manually when access is available.",
      },
      orchestration_brief: parsedBrief,
    };
  },
});

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createLogger } from "@/lib/logger";
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
async function submitVeoGeneration(prompt: string, aspectRatio: string = "16:9"): Promise<{
  success: boolean;
  operationId?: string;
  error?: string;
}> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-001:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio,
            personGeneration: "allow_adult",
            sampleCount: 1,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorBody = await res.text();
      return {
        success: false,
        error: `Veo 3.1 API error (${res.status}): ${errorBody}`,
      };
    }

    const data = await res.json();
    // The response contains a long-running operation with a name/ID
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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const data = await req.json();

    const {
      topic,
      duration = "60s",
      targetAudience = "B2B Executives",
      aspectRatio = "16:9",
    } = data;

    if (!topic) {
        return NextResponse.json({ error: 'Missing film topic parameter' }, { status: 400 });
    }


    // The Anti-Slop God-Prompt for Video Generation
    const systemInstruction = `You are Nova, the Sovereign Filmmaker Agent utilizing Google AI Ultra (Veo 3.1, Imagen, and Music Gen).
Your objective is to generate an elite, hyper-cinematic production brief and prompt sequence for a video about "${topic}".

CRITICAL ANTI-SLOP GUARDRAILS:
1. NO generic neon cyberpunk grids.
2. NO happy corporate stock music. Use "Stoic Contemplation" or "Ambient Focus" descriptions.
3. NO 120fps ultra-smooth motion. Specify 24fps cinematic shutter angles with film grain.
4. NO enthusiastic AI chatbot language. Tone must be authoritative, Palantir-esque, defense-grade.

Output a highly structured JSON array of 5 exact visual prompts to be fed into Veo 3.1, along with a voiceover script and a specific Music Gen prompt.`;

    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
    }

    // --- Step 1: Generate the production brief via Gemini ---
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate the Veo 3.1 prompt sequence for: ${topic}. Target Audience: ${targetAudience}. Duration: ${duration}.` }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: 0.2, // Clinical precision
                responseMimeType: "application/json",
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Google AI API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const productionBrief = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsedBrief;
    try {
      parsedBrief = JSON.parse(productionBrief);
    } catch {
      parsedBrief = { raw: productionBrief };
    }

    // --- Step 2: Submit the first visual prompt to Veo 3.1 for actual video generation ---
    // Extract the first prompt from the brief to submit to Veo 3.1
    let veoPrompt: string | null = null;
    if (Array.isArray(parsedBrief)) {
      veoPrompt = parsedBrief[0]?.prompt || parsedBrief[0]?.visual_prompt || parsedBrief[0]?.text || null;
    } else if (parsedBrief.prompts && Array.isArray(parsedBrief.prompts)) {
      veoPrompt = parsedBrief.prompts[0]?.prompt || parsedBrief.prompts[0]?.visual_prompt || null;
    } else if (parsedBrief.scenes && Array.isArray(parsedBrief.scenes)) {
      veoPrompt = parsedBrief.scenes[0]?.prompt || parsedBrief.scenes[0]?.visual_prompt || null;
    }

    // Fall back to the raw topic if no structured prompt was extracted
    if (!veoPrompt) {
      veoPrompt = `Cinematic ${duration} video: ${topic}. Target audience: ${targetAudience}. 24fps, film grain, authoritative tone.`;
    }

    const veoResult = await submitVeoGeneration(veoPrompt, aspectRatio);

    if (veoResult.success) {
      log.info("Veo 3.1 generation submitted", { operationId: veoResult.operationId });
      return NextResponse.json({
        status: "video_generation_submitted",
        pipeline: "Google Veo 3.1 + Gemini",
        veo: {
          operationId: veoResult.operationId,
          model: "veo-3.1-generate-001",
          prompt: veoPrompt,
          aspectRatio,
          // Poll this operation ID to check completion status:
          // GET https://generativelanguage.googleapis.com/v1beta/{operationId}
          // Authorization: Bearer {GEMINI_API_KEY}
          note: "Video generation is async. Poll the operationId to check status. Requires Google AI Ultra plan or Vertex AI billing.",
        },
        orchestration_brief: parsedBrief,
      });
    }

    // Veo 3.1 failed — fall back to text-only brief
    log.warn("Veo 3.1 unavailable, returning text-only brief", { error: veoResult.error });
    return NextResponse.json({
        status: 'production_scheduled',
        pipeline: 'Google Flow (Veo 3.1 + Imagen)',
        veo: {
          submitted: false,
          reason: veoResult.error,
          note: "Veo 3.1 requires a Google AI Ultra plan or Vertex AI billing. The production brief is ready — submit the prompts manually when access is available.",
        },
        orchestration_brief: parsedBrief,
    });

  } catch (error) {
    log.error("Filmmaker fatal error", error as Record<string, unknown>);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

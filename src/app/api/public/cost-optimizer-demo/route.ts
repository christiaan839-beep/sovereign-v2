/**
 * POST /api/public/cost-optimizer-demo
 *
 * The pricing-transparency money shot. Visitor describes a task + picks
 * a quality floor, the cost-optimizer recommends the cheapest model
 * that will likely clear the floor. Also surfaces cheaper alternatives
 * and a 'what would Claude Opus cost' baseline so the savings story is
 * concrete.
 *
 * Third in the live-demo chain on the landing:
 *   §09 agent-builder:   one NL description → one new agent
 *   §10 playbook-builder: one NL goal        → an agent chain
 *   §11 cost-optimizer:   one NL task + floor → cheapest model
 * Together they demonstrate composition at three scales: atomic, chain,
 * and economic.
 *
 * Cost posture: ~1,500 output tokens per call ≈ \$0.025. At 5/hour/IP
 * that's \$0.125/hour/IP worst case — cheapest of the live demos.
 *
 * Input:
 *   {
 *     taskDescription: string,                    (20-400 chars)
 *     qualityRequirement: "basic"|"verified"|"premium"
 *   }
 *
 * Output:
 *   {
 *     recommendedModel: string,
 *     estimatedCostCentsPerMillion: number,
 *     estimatedLatencyMs: number,
 *     alternativeModels: Array<{ name, costCentsPerMillion, latencyMs, rationale }>,
 *     rationale: string,
 *     savingsVsClaudeOpus: { percent: number, absolute: string }
 *   }
 */

import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

const COST_OPTIMIZER_PROMPT = `You are an ML ops optimizer. Given a task description and quality floor, recommend the cheapest model that likely clears the floor.

## KNOWN COST TIERS (per 1M output tokens, April 2026)
- NIM open-source (nemotron-70b, llama-4): ~\$1
- DeepSeek V3: ~\$1.4
- Gemini Flash 2.5: ~\$1.2
- Groq Llama-3.3: ~\$0.8
- Cerebras Llama-3.3: ~\$0.8
- Gemini Pro 3.1: ~\$7
- Claude Sonnet 4.6: ~\$15
- Claude Opus 4.7: ~\$75

## MATCHING GUIDELINES
- Structured extraction / format conversion / classification → NIM Nemotron-70B ($1)
- Creative writing / blog / ad copy → Gemini Flash ($1.2) or NIM for basic, Claude Sonnet for verified
- Reasoning / multi-step analysis / code → Claude Sonnet ($15) for verified+, DeepSeek V3 ($1.4) for basic
- Code generation (full files) → Claude Sonnet for verified+, NIM for basic
- Vision / multimodal → Llama-4 Maverick ($3) for basic, Gemini Pro 3.1 for verified+

## QUALITY FLOOR MAPPING
- basic: accept the cheapest option that'll likely produce usable output
- verified: use Claude Sonnet or Gemini Pro 3.1 if the task warrants it
- premium: use Claude Sonnet always for structured tasks, Opus only if user explicitly benefits

## NEVER
- Recommend Claude Opus for 'basic' quality — it's ~75× cost for marginal gain
- Recommend open-source models for premium quality unless the task is mechanical

## OUTPUT
VALID JSON only, no markdown fences, no prose.`;

export async function POST(request: Request): Promise<Response> {
  let taskDescription: string;
  let qualityRequirement: "basic" | "verified" | "premium";

  try {
    const body = (await request.json()) as {
      taskDescription?: unknown;
      qualityRequirement?: unknown;
    };
    if (typeof body.taskDescription !== "string") {
      return NextResponse.json(
        { error: "taskDescription must be a string" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      body.qualityRequirement !== "basic" &&
      body.qualityRequirement !== "verified" &&
      body.qualityRequirement !== "premium"
    ) {
      return NextResponse.json(
        { error: "qualityRequirement must be 'basic', 'verified', or 'premium'" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    taskDescription = body.taskDescription.trim();
    qualityRequirement = body.qualityRequirement;
  } catch {
    return NextResponse.json(
      { error: "invalid json body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (taskDescription.length < 20 || taskDescription.length > 400) {
    return NextResponse.json(
      { error: "taskDescription must be 20–400 characters" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const prompt = `Recommend the cheapest model for this task meeting the quality floor.

TASK:
"""
${taskDescription}
"""

QUALITY FLOOR: ${qualityRequirement}

SCHEMA:
{
  "recommendedModel": string,
  "estimatedCostCentsPerMillion": number,
  "estimatedLatencyMs": number,
  "alternativeModels": [
    { "name": string, "costCentsPerMillion": number, "latencyMs": number, "rationale": string }
  ],
  "rationale": string,
  "savingsVsClaudeOpus": { "percent": number, "absolute": string }
}`;

    const response = await ai(prompt, {
      system: COST_OPTIMIZER_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response)
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error:
            "The optimizer didn't return a parseable recommendation. Try describing the task more concretely.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { success: true, recommendation: parsed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/public/cost-optimizer-demo] failed", err);
    return NextResponse.json(
      { error: "cost-optimizer demo temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

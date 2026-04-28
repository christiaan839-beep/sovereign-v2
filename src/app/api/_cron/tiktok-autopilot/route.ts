import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { verifyCron } from "@/lib/cron-auth";
const log = createLogger("tiktok-autopilot");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * TIKTOK AUTOPILOT — Generates short-form video scripts for TikTok/Reels.
 *
 * Creates educational, value-driven scripts that demonstrate AI automation
 * expertise through practical examples and clear outcomes.
 */

export async function GET(req: Request) {
  // Round 25 — was fail-OPEN in non-production. Replaced with the
  // canonical fail-closed verifyCron helper so preview deployments
  // (NODE_ENV !== "production") on the public internet are protected.
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  try {
    const systemInstruction = `You are a short-form video content strategist for Sovereign Matrix, an AI automation platform.

Write a 15-second video script that teaches one specific, actionable AI automation technique.

CONTENT RULES:
- Hook: Start with a surprising fact, counterintuitive insight, or "most agencies don't know this" opener
- Body: Explain ONE specific technique in 2-3 sentences — be concrete enough that someone could act on it
- CTA: End with curiosity-driven closer (e.g., "The full workflow is on our site")
- Tone: knowledgeable and direct — like a senior consultant giving a quick tip
- NO hype: no "revolutionary", "game-changing", "disrupting", "extinct"
- NO attacks on agencies, marketers, or SDRs
- NO military language or dramatic framing
- Visual style: clean, minimal, professional — think product demo, not action movie

Return exactly a JSON object: { "hook_text": "...", "voiceover_script": "...", "visual_description": "..." }
No markdown formatting.`;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI provider not configured" }, { status: 500 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Create today's script. Pick ONE of these topics: (1) how AI can pre-qualify leads before a sales call, (2) a specific prompt technique that improves content output quality, (3) how to use multi-model routing to get better results, (4) a real metric pattern from AI-assisted outreach.",
                },
              ],
            },
          ],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: { temperature: 0.6 },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const aiData = await response.json();
    let rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    let scriptObject: Record<string, unknown> = {};
    try {
      scriptObject = JSON.parse(rawContent);
    } catch {
      log.error("TikTok script parse failed", { rawContent: rawContent.substring(0, 200) });
      return NextResponse.json({ error: "Failed to parse generated script" }, { status: 500 });
    }

    return NextResponse.json({
      status: "script_generated",
      script: scriptObject,
    });
  } catch (err) {
    log.error("TikTok cron error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

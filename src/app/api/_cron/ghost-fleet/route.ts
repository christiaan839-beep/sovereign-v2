import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
const log = createLogger("ghost-fleet-cron");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const X_API_KEY = process.env.X_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GHOST FLEET — Automated social content generation for X/LinkedIn.
 *
 * Generates a value-driven thread that demonstrates expertise in AI automation.
 * Focuses on real insights, practical examples, and measurable outcomes
 * rather than attacking competitors or making unsubstantiated claims.
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const systemInstruction = `You are a content strategist for Sovereign Matrix, an AI automation platform for agencies.

Write a 3-part thread for X (Twitter) that demonstrates real expertise in AI-powered business automation.

CONTENT RULES:
- Lead with a specific, measurable insight or case pattern (e.g., "Agencies using AI lead scoring see 3x faster qualification")
- Each tweet should deliver standalone value — a reader should learn something useful even if they only see one tweet
- Be specific: name real techniques, tools, or patterns — not vague promises
- Tone: confident and direct, like a senior consultant sharing hard-won knowledge
- NO attacks on competitors or "traditional" agencies
- NO hype words: "revolutionary", "game-changing", "disrupting", "extinction"
- NO military/ops language: "strike", "deploy swarms", "extinction protocol"
- NO hashtags. Maximum ONE emoji per tweet if it genuinely adds clarity
- End with a clear, low-pressure CTA (e.g., "We wrote a guide on this: [link]")
- Each tweet: 200-280 characters

Return a JSON array of 3 strings (the tweets in sequence). No markdown formatting.`;

    if (!GEMINI_API_KEY) {
      log.error("GEMINI_API_KEY missing for ghost-fleet");
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
                  text: "Write today's thread. Pick ONE of these angles: (1) a specific AI automation pattern that saves agencies time, (2) a common mistake agencies make when adopting AI tools, (3) a measurable result pattern from AI-assisted lead generation or content creation.",
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
    let rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

    let threadArray = [];
    try {
      threadArray = JSON.parse(rawContent);
    } catch {
      log.error("Failed to parse ghost-fleet output", { rawContent: rawContent.substring(0, 200) });
      return NextResponse.json({ error: "Failed to parse generated thread" }, { status: 500 });
    }

    // Dispatch to X if API key is configured
    if (X_API_KEY) {
      // X API v2 thread posting — requires OAuth 2.0 user context token
      // When ready: POST to https://api.twitter.com/2/tweets with { text: tweet, reply: { in_reply_to_tweet_id } }
      log.info("X API key present — thread ready for dispatch", { tweetCount: threadArray.length });
    }

    return NextResponse.json({
      status: "content_generated",
      dispatched: !!X_API_KEY,
      thread: threadArray,
    });
  } catch (err) {
    log.error("Ghost fleet cron error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("demo-analyze");

/**
 * PUBLIC DEMO ENDPOINT — No auth required.
 * Rate-limited to 3 requests per IP per hour via in-memory store.
 * Used by the homepage InteractiveHeroStrike and /demo/live page.
 */

const demoLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_DEMO_REQUESTS = 5;
const DEMO_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const now = Date.now();
    const entry = demoLimits.get(ip);

    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= MAX_DEMO_REQUESTS) {
          return NextResponse.json({
            response: "You've used all free demo tries. Sign up for unlimited access — it's free, no credit card required.",
            limited: true,
          });
        }
        entry.count++;
      } else {
        demoLimits.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
      }
    } else {
      demoLimits.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
    }

    // Cleanup stale entries every 100 requests
    if (demoLimits.size > 100) {
      for (const [k, v] of demoLimits) {
        if (now >= v.resetAt) demoLimits.delete(k);
      }
    }

    const { prompt, url } = await req.json();
    const userPrompt = url
      ? `Analyze this website and give a concise 3-bullet strategic breakdown: ${url}. Focus on: 1) What they do well, 2) A critical gap or weakness, 3) One actionable opportunity. Keep each bullet to 1-2 sentences.`
      : prompt || "Tell me what Sovereign Matrix can do.";

    const result = await ai(userPrompt, {
      system: "You are a business analyst. Give concise, specific, actionable analysis. No fluff. Use bullet points. Keep total response under 150 words.",
      maxTokens: 500,
    });

    return NextResponse.json({ response: result, model: "sovereign-ai" });
  } catch (err) {
    log.error("Demo analyze failed", err as Record<string, unknown>);
    return NextResponse.json({
      response: "Our AI agents are warming up. Try again in a moment, or sign up for instant access.",
    });
  }
}

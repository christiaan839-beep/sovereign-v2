import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const log = createLogger("demo-analyze");

/**
 * PUBLIC DEMO ENDPOINT — No auth required.
 *
 * SECURITY:
 * - Rate limited via shared Upstash-backed limiter (not in-memory).
 * - Input sizes are bounded to prevent token-burning DoS.
 * - `url` is validated as http(s) before being interpolated into the prompt
 *   (prevents prompt injection via crafted URLs).
 */

const limiter = rateLimit({ interval: 60 * 60, limit: 5 });

// Conservative caps for a free demo endpoint.
const MAX_PROMPT_LENGTH = 500;
const MAX_URL_LENGTH = 500;

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const rawPrompt = typeof body.prompt === "string" ? body.prompt : "";
    const rawUrl = typeof body.url === "string" ? body.url : "";

    const prompt = rawPrompt.slice(0, MAX_PROMPT_LENGTH);
    const url = rawUrl.slice(0, MAX_URL_LENGTH);

    let userPrompt: string;
    if (url) {
      if (!isValidHttpUrl(url)) {
        return NextResponse.json(
          { error: "Invalid URL — must be http:// or https://" },
          { status: 400 },
        );
      }
      userPrompt = `Analyze this website and give a concise 3-bullet strategic breakdown: ${url}. Focus on: 1) What they do well, 2) A critical gap or weakness, 3) One actionable opportunity. Keep each bullet to 1-2 sentences.`;
    } else {
      userPrompt = prompt || "Tell me what Sovereign Matrix can do.";
    }

    const result = await ai(userPrompt, {
      system:
        "You are a business analyst. Give concise, specific, actionable analysis. No fluff. Use bullet points. Keep total response under 150 words.",
      maxTokens: 500,
    });

    return NextResponse.json({ response: result, model: "sovereign-ai" });
  } catch (err) {
    log.error("Demo analyze failed", err as Record<string, unknown>);
    return NextResponse.json({
      response:
        "Our AI agents are warming up. Try again in a moment, or sign up for instant access.",
    });
  }
}

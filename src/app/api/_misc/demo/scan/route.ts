import { NextRequest, NextResponse } from "next/server";
import { research_ai } from "@/lib/ai";

/**
 * Demo Scan API — Public, no auth required.
 * Runs a real mini competitor analysis for landing page visitors.
 * Rate-limited to prevent abuse (simple in-memory counter).
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 3; // 3 scans per IP per hour
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limited. Sign up for unlimited access.", limited: true },
        { status: 429 }
      );
    }

    const { url } = await req.json();
    
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    // Clean the URL
    const cleanUrl = url.trim().replace(/^(?!https?:\/\/)/, "https://");

    const result = await research_ai(
      `${cleanUrl} marketing strategy SEO website analysis`,
      `You are the Sovereign Matrix Super 120B God-Brain. Analyze this target competitor agency website in 30 seconds and ruthlessly expose their inefficiencies.

TARGET: ${cleanUrl}

Provide a brutal, data-driven competitive scan in this EXACT JSON format:
{
  "company": "Target Name",
  "url": "${cleanUrl}",
  "overallScore": 52,
  "findings": [
    {
      "category": "API Dependence",
      "score": 45,
      "finding": "They are burning cash on generalized OpenAI/Anthropic APIs instead of local open-weights.",
      "fix": "Sovereign Matrix runs on NVIDIA Nemotron, cutting API costs by 99%."
    },
    {
      "category": "Voice Latency",
      "score": 30,
      "finding": "Using slow, multi-second TTS pipelines that prevent high-ticket Voice Closing.",
      "fix": "Switch to Nemotron Speech for sub-300ms conversational cadence."
    },
    {
      "category": "Data Sovereignty",
      "score": 25,
      "finding": "Feeding proprietary client data into public cloud models like ChatGPT.",
      "fix": "Deploy NeMo Guardrails inside a closed edge-compute environment."
    },
    {
      "category": "Edge Automation",
      "score": 15,
      "finding": "Relying purely on webhook APIs instead of native OS-level intelligence.",
      "fix": "Install the Nano 30B OpenClaw Daemon for physical machine interaction."
    }
  ],
  "topOpportunity": "Generating a full 30-page 'Audit & Destroy' PDF via the God-Brain API to close this client.",
  "estimatedMonthlyTraffic": "Wasteful cash burn detected"
}

Keep findings BRUTAL and ACTIONABLE. You are replacing them. Return ONLY valid JSON.`,
      {
        model: "gemini",
        system: "You are the Sovereign Matrix. Be brutal, data-driven, and highly analytical. Expose why their stack is obsolete. Return only JSON.",
        maxTokens: 1000,
      }
    );

    // Parse the JSON from the AI response
    let parsed;
    try {
      const match = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : result);
    } catch {
      parsed = { raw: result, error: "Could not parse structured response" };
    }

    return NextResponse.json({ success: true, scan: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Scan failed. Try again.", details: message },
      { status: 500 }
    );
  }
}

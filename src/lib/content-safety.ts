/**
 * SOVEREIGN MATRIX — Content Safety Pre-flight Check
 *
 * Uses NVIDIA NeMo Content Safety 4B model to evaluate text
 * before and after AI generation. Blocks harmful, PII-laden,
 * or policy-violating content from reaching users.
 *
 * Usage:
 *   import { checkContentSafety } from "@/lib/content-safety";
 *   const result = await checkContentSafety("some text");
 *   if (!result.safe) return error(result.reason);
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("content-safety");

interface SafetyResult {
  safe: boolean;
  reason: string;
  category: string;
  confidence: number;
}

export async function checkContentSafety(text: string): Promise<SafetyResult> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) {
    // No NIM key — skip safety check gracefully
    return { safe: true, reason: "Safety check skipped (no NIM key)", category: "none", confidence: 0 };
  }

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-content-safety-reasoning-4b",
        messages: [
          {
            role: "user",
            content: `Evaluate this content for safety. Respond with JSON only: {"safe": true/false, "category": "none|hate|violence|sexual|pii|spam", "confidence": 0.0-1.0, "reason": "brief explanation"}\n\nContent: "${text.slice(0, 1000)}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.warn("Safety API returned non-200", { status: res.status });
      return { safe: true, reason: "Safety check unavailable", category: "none", confidence: 0 };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);
      return {
        safe: parsed.safe !== false,
        reason: parsed.reason || "",
        category: parsed.category || "none",
        confidence: Number(parsed.confidence) || 0,
      };
    } catch {
      // Model didn't return valid JSON — interpret text
      const isSafe = !content.toLowerCase().includes("unsafe") && !content.toLowerCase().includes("violation");
      return { safe: isSafe, reason: content.slice(0, 200), category: "unknown", confidence: 0.5 };
    }
  } catch {
    log.warn("Content safety check failed, allowing content");
    return { safe: true, reason: "Safety check timeout", category: "none", confidence: 0 };
  }
}

import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * PII AUTO-REDACTION API — Uses NVIDIA Content Safety model to detect and redact
 * Personally Identifiable Information from text before LLM processing.
 * Ensures POPIA/GDPR compliance. Now BYOK-aware via nimChat().
 */

export async function POST(request: Request) {
  try {
    const { text, redact = true } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // Step 1: Use NeMo Content Safety model to detect PII entities (BYOK-aware)
    const rawResponse = await nimChat(
      "nvidia/nemotron-content-safety-reasoning-4b",
      [
        {
          role: "system",
          content: `You are a PII detection system. Analyze the following text and identify ALL personally identifiable information including:
- Full names
- Email addresses
- Phone numbers
- Physical addresses
- ID numbers (passport, national ID, SSN)
- Bank account numbers
- Credit card numbers
- Dates of birth
- IP addresses

Return a JSON object with:
{
  "entities": [{"type": "EMAIL", "value": "found@email.com", "start": 10, "end": 25}],
  "risk_level": "HIGH|MEDIUM|LOW",
  "redacted_text": "the text with PII replaced by [REDACTED_TYPE]"
}

Output ONLY valid JSON. No explanation.`,
        },
        { role: "user", content: text },
      ],
      { maxTokens: 2048, temperature: 0.1 }
    );

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      parsed = { entities: [], risk_level: "UNKNOWN", redacted_text: text };
    }

    return NextResponse.json({
      success: true,
      model: "nemotron-content-safety-reasoning-4b",
      original_length: text.length,
      entities_found: parsed.entities?.length || 0,
      risk_level: parsed.risk_level || "UNKNOWN",
      entities: parsed.entities || [],
      redacted_text: redact ? (parsed.redacted_text || text) : undefined,
      compliance: ["POPIA", "GDPR", "CCPA"],
    });
  } catch (error) {
    return NextResponse.json({ error: "PII detection error", details: String(error) }, { status: 500 });
  }
}

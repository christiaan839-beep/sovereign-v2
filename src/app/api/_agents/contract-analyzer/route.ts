import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";
import { ai } from "@/lib/ai";

/**
 * CONTRACT ANALYZER — Upload a contract/document text and get:
 * - Key terms extraction
 * - Red flag identification
 * - Renewal/deadline dates
 * - Risk assessment
 * 
 * Uses Nemotron 3 Nano (262K context) for long document ingestion,
 * falls back to Gemini/Claude via ai() if NIM key is unavailable.
 */

export async function POST(request: Request) {
  try {
    const { document } = await request.json();

    if (!document) {
      return NextResponse.json({ error: "document text is required." }, { status: 400 });
    }

    const systemPrompt = `You are a senior contract attorney and risk analyst. Analyze the provided contract with extreme precision.

OUTPUT FORMAT (strict JSON):
{
  "summary": "2-3 sentence executive summary",
  "parties": ["Party A name", "Party B name"],
  "key_terms": [{"term": "Payment Terms", "detail": "Net 30 days", "section": "Section 4.1"}],
  "red_flags": [{"flag": "description", "severity": "HIGH|MEDIUM|LOW", "recommendation": "what to do"}],
  "deadlines": [{"date": "2024-12-31", "description": "Contract renewal deadline", "action_required": "Send notice 60 days prior"}],
  "financial_terms": {"total_value": "$X", "payment_schedule": "description", "penalties": "description"},
  "risk_score": 7,
  "risk_assessment": "Overall risk narrative"
}

Output ONLY valid JSON.`;

    const start = Date.now();
    let result: string;

    try {
      // Try Nemotron 3 Nano (best for long documents)
      result = await nimChat(
        "nvidia/nemotron-3-nano-30b-a3b",
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this contract:\n\n${document.substring(0, 200000)}` },
        ],
        { maxTokens: 3000, temperature: 0.1 }
      );
    } catch {
      // Fallback to BYOK ai() engine
      result = await ai(
        `Analyze this contract:\n\n${document.substring(0, 50000)}`,
        { system: systemPrompt, maxTokens: 3000 }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      parsed = { raw_analysis: result };
    }

    return NextResponse.json({
      success: true,
      agent: "contract-analyzer",
      analysis: parsed,
      document_stats: {
        characters: document.length,
        words: document.split(/\s+/).length,
        pages_estimated: Math.ceil(document.split(/\s+/).length / 300),
      },
      duration_ms: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json({ error: "Contract analyzer error", details: String(error) }, { status: 500 });
  }
}

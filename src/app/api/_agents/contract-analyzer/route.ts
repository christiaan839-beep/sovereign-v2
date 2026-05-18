import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { nimChat } from "@/lib/nvidia";
import { ai } from "@/lib/ai";

/**
 * CONTRACT ANALYZER — Extract key terms, red flags, deadlines, and risk scores.
 * Uses Nemotron 3 Nano (262K context) with Claude fallback for long documents.
 */

const schema = z.object({
  document: z
    .string()
    .min(50, "Document text must be at least 50 characters")
    .max(500_000),
  prompt: z.string().optional(),
  context: z.string().max(5000).optional(),
});

const SYSTEM_PROMPT = `You are a senior contract attorney and risk analyst. Analyze with extreme precision.

OUTPUT FORMAT (strict JSON):
{
  "summary": "2-3 sentence executive summary",
  "parties": ["Party A", "Party B"],
  "key_terms": [{"term": "...", "detail": "...", "section": "..."}],
  "red_flags": [{"flag": "...", "severity": "HIGH|MEDIUM|LOW", "recommendation": "..."}],
  "deadlines": [{"date": "...", "description": "...", "action_required": "..."}],
  "financial_terms": {"total_value": "...", "payment_schedule": "...", "penalties": "..."},
  "risk_score": 7,
  "risk_assessment": "Overall risk narrative"
}

Output ONLY valid JSON.`;

export const POST = createAgentRoute({
  name: "contract-analyzer",
  schema,
  handler: async ({ input }) => {
    const document = input.document as string;
    const start = Date.now();
    let result: string;

    try {
      result = await nimChat(
        "nvidia/nemotron-3-nano-30b-a3b",
        [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analyze this contract:\n\n${document.substring(0, 200_000)}`,
          },
        ],
        { maxTokens: 3000, temperature: 0.1 },
      );
    } catch {
      // Tiered fallback (Wave 73 cost audit): try Mistral Large 2 via
      // NIM first (~30× cheaper than Claude Sonnet+thinking). Only
      // escalate to Claude+thinking on a second consecutive failure.
      try {
        result = await ai(
          `Analyze this contract:\n\n${document.substring(0, 50_000)}`,
          {
            system: SYSTEM_PROMPT,
            maxTokens: 3000,
            model: "mistral",
          },
        );
      } catch {
        result = await ai(
          `Analyze this contract:\n\n${document.substring(0, 50_000)}`,
          {
            system: SYSTEM_PROMPT,
            maxTokens: 3000,
            model: "claude",
            thinking: true,
          },
        );
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(
        result
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch {
      parsed = { raw_analysis: result };
    }

    return {
      success: true,
      agent: "contract-analyzer",
      analysis: parsed,
      document_stats: {
        characters: document.length,
        words: document.split(/\s+/).length,
        pages_estimated: Math.ceil(document.split(/\s+/).length / 300),
      },
      duration_ms: Date.now() - start,
    };
  },
});

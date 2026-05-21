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
  // Wave 115 M3 batch 9: memory hooks. Per-document-shape risk patterns
  // compound — last quarter's NDAs, MSAs, or vendor agreements taught the
  // operator what red flags recurred. Surface those without re-reading
  // the whole prior contract.
  memory: {
    search: {
      query: (input) => {
        const doc = typeof input.document === "string" ? input.document : "";
        // Lightweight bigram hash — first 80 chars of the document is enough
        // to land near-duplicate contract types (template-style agreements)
        // without retrieving unrelated docs.
        return `contract ${doc.slice(0, 80)}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          risk_score?: number;
          red_flags?: Array<{ flag?: string; severity?: string }>;
          parties?: string[];
        };
        if (typeof r.risk_score !== "number" && !r.red_flags) return null;
        const flags = (r.red_flags ?? [])
          .slice(0, 3)
          .map((f) => `[${f.severity ?? "?"}] ${f.flag ?? ""}`)
          .join(" · ");
        const partyTag = (r.parties ?? []).slice(0, 2).join(" / ");
        return `risk=${r.risk_score ?? "?"} parties=${partyTag} flags=${flags}`;
      },
      metadata: () => ({ kind: "contract-analysis" }),
    },
  },
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
      // Wave-108 cost fix: Mistral → Cerebras (extraction) → Claude.
      // Previously the fallback jumped straight to Claude Sonnet+thinking
      // (~$3/$15 per M tokens) for what is structurally a JSON-shaped
      // extraction task. Cerebras Llama-3.1-70B at ~$0.10/M tokens
      // handles structured extraction reliably AND is 10x faster.
      // Claude is preserved as the THIRD fallback so a double-failure
      // path still produces a result rather than a 500.
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
        try {
          result = await ai(
            `Analyze this contract:\n\n${document.substring(0, 50_000)}`,
            {
              system: SYSTEM_PROMPT,
              maxTokens: 3000,
              model: "cerebras",
            },
          );
        } catch {
          // Final-resort Claude+thinking — only reached on cascading
          // upstream failures. Expensive but guarantees we don't
          // serve a 500 on a legal/contract analysis request.
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

import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * API-DESIGN-REVIEWER — OpenAPI spec or endpoint description → design critique.
 *
 * Takes an OpenAPI YAML/JSON doc or a natural-language endpoint definition
 * and returns a scored critique with severity-tagged issues.
 *
 * Input:
 *   apiSpec: string  (required — YAML/JSON spec or NL description)
 *   style?: "REST" | "GraphQL" | "RPC"  (default "REST")
 *
 * Output (JSON):
 *   {
 *     score: number (0-100),
 *     strengths: string[],
 *     issues: [{ severity, category, description, recommendation }],
 *     nextStepsPriority: string[]
 *   }
 *
 * Pairs with:
 *   - `sql-generator` — downstream DB layer
 */

const API_DESIGN_SYSTEM_PROMPT = `You are a senior API architect who has shipped public APIs at scale and reviewed thousands of designs. You write critiques the way Stripe, Twilio, and GitHub would.

${ANTI_SLOP_RULES}

## REVIEW DIMENSIONS
Check every spec against:
1. NAMING — resources are nouns (not verbs), plural for collections, consistent case (kebab for paths, snake/camel for fields per style).
2. VERBS — GET safe/idempotent, PUT/DELETE idempotent, POST for non-idempotent. No GET mutations.
3. VERSIONING — explicit strategy (URL, header, or content-negotiation). Breaking changes trigger a new version.
4. AUTH — authentication placement (header, not query string), scopes/permissions model, clear 401 vs 403 semantics.
5. ERRORS — consistent error envelope (code, message, details), machine-readable codes, HTTP status codes used correctly.
6. PAGINATION — cursor preferred over offset at scale, explicit limits, next/prev links, response envelope shape.
7. CONSISTENCY — same patterns across endpoints (e.g. all list endpoints return { data, meta }).
8. IDEMPOTENCY — idempotency keys for unsafe operations (Stripe pattern).

## SCORING
- 90+: publish-ready
- 75-89: minor polish needed
- 60-74: refactor before launch
- Below 60: redesign

## OUTPUT RULES
- Issue severity: critical = blocks launch, major = causes churn, minor = polish.
- Every issue MUST include a concrete recommendation with an example if helpful.
- Cite Stripe/Twilio/GitHub/AWS patterns where relevant.
- nextStepsPriority is a ranked list of the 3-5 most impactful fixes.
- Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "api-design-reviewer",
  requiredFields: ["apiSpec"],
  handler: async ({ input }) => {
    const { apiSpec, style = "REST" } = input as {
      apiSpec: string;
      style?: "REST" | "GraphQL" | "RPC";
    };

    const prompt = `Review this ${style} API design. Return ONLY valid JSON matching the schema.

API SPEC:
"""
${apiSpec.slice(0, 20_000)}
"""

SCHEMA:
{
  "score": number,
  "strengths": [ string ],
  "issues": [
    {
      "severity": "critical" | "major" | "minor",
      "category": "naming" | "versioning" | "auth" | "errors" | "pagination" | "consistency",
      "description": string,
      "recommendation": string
    }
  ],
  "nextStepsPriority": [ string ]
}`;

    const response = await ai(prompt, {
      system: API_DESIGN_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("API design review failed: model returned non-JSON output");
    }

    return { success: true, review: parsed };
  },
});

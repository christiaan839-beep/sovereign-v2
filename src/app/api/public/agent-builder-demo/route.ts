/**
 * POST /api/public/agent-builder-demo
 *
 * The landing-page money shot: a public-facing wrapper around the
 * agent-builder agent that takes a natural-language description and
 * returns a factory-compliant route + test skeleton.
 *
 * Why this endpoint exists separately from /api/agents/agent-builder:
 *   - The authenticated route goes through the full factory (rate
 *     limit per user, audit log, quality gate, billing hooks). Those
 *     are right for logged-in operators but wrong for a public demo
 *     where the visitor hasn't signed up yet.
 *   - This endpoint is IP-scoped (3/hour via rate-limits.ts) and uses
 *     a separate tenant (PUBLIC_DEMO_USER_ID) so demo invocations
 *     don't pollute any real tenant's audit trail or credit ledger.
 *
 * Cost posture:
 *   Each invocation is ~4000 Claude output tokens ≈ $0.06.
 *   At the 3-per-hour/IP cap, worst case per IP per hour is ~$0.18.
 *   Total landing-page-generated spend is bounded at scale by the rate
 *   limit + CDN caching of the 'one agent' marketing shot.
 *
 * Input:  { purpose: string }           (20-500 chars)
 * Output: {
 *           suggestedSlug, routeCode, testCode, systemPrompt,
 *           outputSchema
 *         }
 *
 * Input validation:
 *   - Length 20-500 chars (enough to describe an agent, short enough
 *     not to be used as a general-purpose Claude chat).
 *   - If the model's safety refusal fires (slug === "refused"), we
 *     still return 200 — the client shows a friendly "try a different
 *     description" message. This is intentional: the model is the
 *     source of truth for what's safe to generate.
 *
 * Never 500s. 400 on bad input; 503 on downstream failure.
 */

import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

const AGENT_BUILDER_SYSTEM_PROMPT = `You are a platform architect for the Sovereign Matrix agent factory. You turn natural-language agent descriptions into factory-compliant route code + a vitest skeleton.

## ARCHITECTURE RULES
1. Every agent is a createAgentRoute({ name, requiredFields, handler }) export. Handler takes { input } and returns JSON.
2. Slugs are kebab-case, purpose-first (extract-invoice NOT invoiceAgent, summarize-meeting NOT summarizer).
3. Agents call ai(prompt, { system, model, maxTokens }) — never fetch directly.
4. JSON outputs are parsed with a markdown-fence strip before JSON.parse, and throw on parse failure.
5. System prompts embed ANTI_SLOP_RULES from @/lib/content-engine.
6. Tests mock @/lib/ai and @/lib/agent-factory (passthrough) so the handler can be invoked directly.

## SAFETY RULES
- Refuse agents that self-modify the platform, exfiltrate secrets, bypass auth, override safety gates, or do anything destructive. For refusals, set suggestedSlug to "refused" and routeCode/testCode to a short explanation starting with "// REFUSED:".
- Never generate agents that execute arbitrary user code on the server without a sandbox.

## OUTPUT
Return VALID JSON only — no markdown fences, no prose.`;

export async function POST(request: Request): Promise<Response> {
  let purpose: string;
  try {
    const body = (await request.json()) as { purpose?: unknown };
    if (typeof body.purpose !== "string") {
      return NextResponse.json(
        { error: "purpose must be a string" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    purpose = body.purpose.trim();
  } catch {
    return NextResponse.json(
      { error: "invalid json body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (purpose.length < 20 || purpose.length > 500) {
    return NextResponse.json(
      { error: "purpose must be 20–500 characters" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const prompt = `Generate a new Sovereign Matrix agent.

PURPOSE:
"""
${purpose}
"""

SCHEMA:
{
  "suggestedSlug": string,
  "routeCode":     string,
  "testCode":      string,
  "systemPrompt":  string,
  "outputSchema":  string
}`;

    const response = await ai(prompt, {
      system: AGENT_BUILDER_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response)
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error:
            "The model didn't return parseable code this round. Try rephrasing the purpose more concretely.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { success: true, generated: parsed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/public/agent-builder-demo] failed", err);
    return NextResponse.json(
      { error: "agent-builder demo temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/**
 * POST /api/public/playbook-builder-demo
 *
 * Public-facing wrapper around the playbook-builder agent. Visitor
 * types a goal, the endpoint composes a minimal agent chain with
 * checkable guarantee clauses and per-step cost/latency estimates.
 *
 * Paired with the agent-builder-demo (same card-dealer pattern):
 *   - agent-builder-demo:   one agent ← one NL description
 *   - playbook-builder-demo: a CHAIN of agents ← one NL goal
 * Together they demonstrate composition at two scales.
 *
 * Why public-demo-specific (not just proxying /api/agents/playbook-builder):
 *   - Authenticated route feeds real credit ledgers + audit trail.
 *     This route feeds PUBLIC_DEMO_USER_ID so demo invocations stay
 *     out of any real tenant's data.
 *   - Rate limit is IP-scoped at 3/hour (public-playbook-builder-demo
 *     rule in rate-limits.ts), vs per-user on the authenticated side.
 *
 * Cost posture: ~2,500 Claude output tokens per call ≈ $0.04.
 * At 3/hour/IP that's $0.12/hour/IP worst case.
 *
 * Input:  { goal: string }           (20-400 chars)
 * Output: {
 *           playbookName,
 *           description,
 *           steps: Array<{ agent, inputs, outputKey }>,
 *           guarantee,
 *           estimatedCostCents
 *         }
 *
 * Honest failure modes:
 *   - If the model returns empty steps[] (goal cannot be met with the
 *     supplied availableAgents, if provided), we still return 200 —
 *     the UI shows the gap description + a CTA to ship the missing
 *     agent using agent-builder. This is a positive flow, not an error.
 *   - If the model returns non-JSON, we return 503 with a friendly
 *     'try rephrasing' message rather than 500.
 */

import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

const PLAYBOOK_BUILDER_PROMPT = `You are a workflow architect composing Sovereign Matrix playbooks. You turn a natural-language goal into a minimal sequence of agent calls with a checkable guarantee clause.

## RULES
1. Keep playbooks under 5 steps to keep end-to-end latency < 60s.
2. Each step wires into the next — step N's outputKey becomes a variable that step N+1 references in inputs (e.g. "{{step1.leads}}").
3. The guarantee clause MUST be checkable by a regex or count assertion. Examples:
   - "≥5 leads each with contact_angle field"
   - "exactly 1 blog post, ≥800 words, with H1 + 3 H2s"
   - "JSON array of domains, each scored 0-100"
   Avoid vague guarantees like "high quality" or "relevant".
4. Cost estimate: sum of per-step cost. Defaults per step: cheap extract/format $0.005, LLM reasoning $0.03, long-form write $0.08. Round to cents.
5. Use realistic slugs that match the Sovereign Matrix agent catalog. Common ones: leads, email-sequence, booking, content, blog-gen, ads, closer, competitor, grounded-search, meeting-notes, invoice-extractor, resume-screener, review-analyzer, phishing-detector, citation-verifier, literature-review, tenant-screener, listing-writer, nda-triage, product-description-writer, daily-briefing.
6. Name playbooks action-first, kebab-case: "lead-blitz-europe", NOT "europe-lead-blitz-playbook-v2".
7. If the goal cannot be met with typical Sovereign agents, return steps: [] and describe the gap in description, naming a missing agent the user would need to build.

Return VALID JSON only — no markdown fences, no prose.`;

export async function POST(request: Request): Promise<Response> {
  let goal: string;
  try {
    const body = (await request.json()) as { goal?: unknown };
    if (typeof body.goal !== "string") {
      return NextResponse.json(
        { error: "goal must be a string" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    goal = body.goal.trim();
  } catch {
    return NextResponse.json(
      { error: "invalid json body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (goal.length < 20 || goal.length > 400) {
    return NextResponse.json(
      { error: "goal must be 20–400 characters" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const prompt = `Compose a playbook for this goal.

GOAL:
"""
${goal}
"""

MAX STEPS: 5

SCHEMA:
{
  "playbookName":       string,
  "description":        string,
  "steps":              [ { "agent": string, "inputs": {string: string}, "outputKey": string } ],
  "guarantee":          string,
  "estimatedCostCents": number
}`;

    const response = await ai(prompt, {
      system: PLAYBOOK_BUILDER_PROMPT,
      maxTokens: 2500,
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
            "The model didn't compose a parseable playbook this round. Try describing the goal as a sequence of actions.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { success: true, playbook: parsed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/public/playbook-builder-demo] failed", err);
    return NextResponse.json(
      { error: "playbook-builder demo temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

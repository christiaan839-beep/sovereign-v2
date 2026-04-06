import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("do-api");

/**
 * THE SIMPLEST API IN THE PLATFORM
 *
 * POST /api/do
 * Body: { "goal": "Find SaaS leads in London and draft outreach emails" }
 *
 * That's it. One endpoint. One field. Plain English.
 * The system figures out which agents to use, runs them, and returns results.
 *
 * This is the "just do it" endpoint — the fastest path from idea to result.
 * No agent selection. No field mapping. No configuration.
 *
 * Behind the scenes:
 * 1. Smart router classifies the goal
 * 2. Coordinator plans the steps
 * 3. Agents execute in sequence (or parallel via swarm)
 * 4. Results returned with citations and metadata
 */

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Sign in to use /api/do" }, { status: 401 });

    const { goal } = await req.json();
    if (!goal || typeof goal !== "string" || goal.trim().length < 5) {
      return NextResponse.json({
        error: "Tell me what you need",
        example: 'POST /api/do { "goal": "Find 10 SaaS leads in Austin" }',
      }, { status: 400 });
    }

    const start = Date.now();

    // Step 1: Classify — is this a single-agent or multi-agent task?
    const classification = await ai(
      `Classify this goal into ONE category and pick the best agent(s).

GOAL: "${goal}"

Available agents and what they do:
- leads: Find B2B prospects by niche/location
- blog-gen: Write SEO blog posts
- seo-dominator: SEO audit for any domain
- email-sequence: Draft email outreach sequences
- competitor-scan: Analyze competitor weaknesses
- brand-voice: Learn/generate in a brand's voice
- proposal-generator: Create business proposals
- organic-content: Social media content calendar
- creative-director: Ad copy and campaigns
- translate: Translate text to any language
- omni-search: Research any topic
- deep-search: Deep web research with synthesis

Respond ONLY with JSON:
{"agents": ["leads"], "params": {"niche": "SaaS", "location": "Austin"}, "multi": false}

For multi-step goals, set multi: true and list agents in order.`,
      { system: "You are a task classifier. Pick the minimum agents needed. Output ONLY JSON.", maxTokens: 300 }
    );

    let plan;
    try {
      plan = JSON.parse(classification.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      // Fallback: use smart-router for unknown goals
      plan = { agents: ["omni-search"], params: { query: goal }, multi: false };
    }

    // Step 2: Execute
    const baseUrl = req.headers.get("x-forwarded-proto") === "https"
      ? `https://${req.headers.get("host")}`
      : `http://${req.headers.get("host") || "localhost:3000"}`;

    if (!plan.multi || plan.agents.length === 1) {
      // Single agent — fast path
      const agent = plan.agents[0];
      const res = await fetch(`${baseUrl}/api/agents/${agent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sovereign-Internal": "do-api" },
        body: JSON.stringify({ ...plan.params, prompt: goal, confirmed: true }),
        signal: AbortSignal.timeout(45000),
      });

      const data = await res.json();

      return NextResponse.json({
        goal,
        agent,
        result: data,
        durationMs: Date.now() - start,
        tip: "Want to run this weekly? Use /api/do with schedule: 'weekly'",
      });
    }

    // Multi-agent — use coordinator
    const coordRes = await fetch(`${baseUrl}/api/agents/coordinator`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sovereign-Internal": "do-api" },
      body: JSON.stringify({
        goal,
        auto_execute: true,
        confirmed: true,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const coordData = await coordRes.json();

    return NextResponse.json({
      goal,
      agents: plan.agents,
      result: coordData,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    log.error("/api/do error", { error: String(err) });
    return NextResponse.json({ error: "Something went wrong. Try a simpler goal." }, { status: 500 });
  }
}

// GET: show usage
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/do",
    description: "The simplest API. One goal, one result.",
    usage: {
      method: "POST",
      body: { goal: "string — describe what you need in plain English" },
      example: { goal: "Find 10 SaaS leads in London and draft cold emails" },
    },
    tips: [
      "Be specific: 'Find dental clinics in Cape Town' > 'Find leads'",
      "Chain tasks: 'Audit SEO for stripe.com and write 3 blog posts targeting their keyword gaps'",
      "The system auto-picks the best agent(s) for your goal",
    ],
  });
}

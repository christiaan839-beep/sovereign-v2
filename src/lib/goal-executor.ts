/**
 * GOAL EXECUTOR — Core agent dispatch logic
 *
 * Shared by:
 *   - /api/do       (synchronous, returns result inline)
 *   - /api/cron/job-runner  (async, stores result in DB)
 *
 * Classifies the goal, picks the right agent(s), executes, returns result.
 * No HTTP context required — pass baseUrl explicitly.
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("goal-executor");

export interface ExecutionResult {
  goal: string;
  agent: string;
  agents: string[];
  result: unknown;
  durationMs: number;
  multi: boolean;
}

export async function executeGoal(
  goal: string,
  baseUrl: string,
  userId: string
): Promise<ExecutionResult> {
  const start = Date.now();

  // Step 1: Classify goal
  let plan: { agents: string[]; params: Record<string, unknown>; multi: boolean };
  try {
    const classification = await ai(
      `Classify this goal into ONE category and pick the best agent(s).

GOAL: "${goal}"

Available agents:
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
      { system: "You are a task classifier. Output ONLY JSON.", maxTokens: 300 }
    );
    plan = JSON.parse(classification.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch {
    plan = { agents: ["omni-search"], params: { query: goal }, multi: false };
  }

  // Step 2: Execute
  const internalHeaders = {
    "Content-Type": "application/json",
    "X-Sovereign-Internal": "job-runner",
    "Authorization": `Bearer ${process.env.CRON_SECRET}`,
    "X-User-Id": userId,
  };

  if (!plan.multi || plan.agents.length === 1) {
    const agent = plan.agents[0];
    const res = await fetch(`${baseUrl}/api/agents/${agent}`, {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({ ...plan.params, prompt: goal, confirmed: true }),
      signal: AbortSignal.timeout(180000), // 3 min for async jobs
    });
    const result = await res.json();
    log.info("single-agent job complete", { agent, userId });
    return { goal, agent, agents: [agent], result, durationMs: Date.now() - start, multi: false };
  }

  // Multi-agent coordinator
  const res = await fetch(`${baseUrl}/api/agents/coordinator`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({ goal, auto_execute: true, confirmed: true }),
    signal: AbortSignal.timeout(300000), // 5 min for multi-agent
  });
  const result = await res.json();
  log.info("multi-agent job complete", { agents: plan.agents, userId });
  return { goal, agent: "coordinator", agents: plan.agents, result, durationMs: Date.now() - start, multi: true };
}

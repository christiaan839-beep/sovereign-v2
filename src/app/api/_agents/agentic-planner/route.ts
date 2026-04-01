import { auth } from "@clerk/nextjs/server";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * GLM-5 AGENTIC TOOL-CALLING — Purpose-built for autonomous agent orchestration.
 * 
 * This agent can call OTHER agents as tools, creating true AI-orchestrated automation.
 * GLM-5 is specifically labeled "Agentic" on NVIDIA NIM.
 * 
 * Feed it a goal → it decides which agents to call → executes the plan autonomously.
 * 
 * LICENSE: GLM License — free for commercial use.
 */

const AVAILABLE_TOOLS = [
  { name: "translate", description: "Translate text between languages", params: "text, target_lang" },
  { name: "blog-gen", description: "Generate SEO blog posts", params: "topic, keywords" },
  { name: "pii-redactor", description: "Detect and redact personally identifiable information", params: "text" },
  { name: "case-study", description: "Generate professional case studies", params: "clientName, industry, metrics" },
  { name: "page-builder", description: "Generate landing pages with HTML/CSS", params: "prompt" },
  { name: "image-gen", description: "Generate images from text descriptions", params: "prompt, width, height" },
  { name: "voice-synth", description: "Convert text to speech audio", params: "text, voice" },
  { name: "smart-router", description: "Route a prompt to the optimal AI model", params: "prompt, task_type" },
  { name: "research", description: "Deep web research on any topic", params: "query" },
  { name: "reasoning-chain", description: "Multi-step deep reasoning for complex problems", params: "question, domain" },
];

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { goal, auto_execute = false } = await request.json();

    if (!goal) {
      return NextResponse.json({ error: "goal is required." }, { status: 400 });
    }
    

    // Step 1: GLM-5 creates the execution plan
    const toolList = AVAILABLE_TOOLS.map(t => `- ${t.name}: ${t.description} (params: ${t.params})`).join("\n");

    const planRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "z-ai/glm5",
        messages: [
          {
            role: "system",
            content: `You are an autonomous AI orchestrator. Given a goal, create an execution plan using the available tools.

Available tools:
${toolList}

Output a JSON array of steps. Each step must have: {"tool": "tool_name", "params": {key: value}, "reason": "why this step"}. Output ONLY valid JSON array, nothing else.`,
          },
          { role: "user", content: `Goal: ${goal}` },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    const planData = await planRes.json();
    const rawPlan = planData?.choices?.[0]?.message?.content || "[]";

    let executionPlan;
    try {
      executionPlan = JSON.parse(rawPlan.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      executionPlan = [{ tool: "smart-router", params: { prompt: goal }, reason: "Fallback: Direct routing" }];
    }

    // Step 2: Optionally auto-execute the plan
    const results = [];
    if (auto_execute && Array.isArray(executionPlan)) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      for (const step of executionPlan.slice(0, 5)) {
        try {
          const stepStart = Date.now();
          const res = await fetch(`${baseUrl}/api/agents/${step.tool}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(step.params || {}),
          });

          const data = await res.json();
          results.push({
            tool: step.tool,
            reason: step.reason,
            status: res.ok ? "✅ Executed" : "⚠️ Partial",
            duration_ms: Date.now() - stepStart,
            preview: JSON.stringify(data).substring(0, 200),
          });
        } catch (err) {
          results.push({ tool: step.tool, reason: step.reason, status: "❌ Failed", error: String(err) });
        }
      }
    }

    return NextResponse.json({
      success: true,
      model: "GLM-5 (Agentic Tool-Calling)",
      goal,
      auto_execute,
      execution_plan: executionPlan,
      steps_planned: Array.isArray(executionPlan) ? executionPlan.length : 0,
      results: auto_execute ? results : "Set auto_execute: true to run the plan",
      license: "GLM License — commercial use permitted",
    });
  } catch (error) {
    return NextResponse.json({ error: "Agentic tool-calling error", details: String(error) }, { status: 500 });
  }
}

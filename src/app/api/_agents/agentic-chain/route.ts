import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { getAntiSlopRules } from "@/lib/system-prompts";

/**
 * AGENTIC CHAIN — Multi-step autonomous agent with tool calling.
 *
 * Implements the "agentic loop" pattern from Anthropic's cookbook:
 * Plan → Execute → Observe → Reflect → Repeat until done.
 *
 * The agent plans its approach, calls tools (search, analyze, generate),
 * observes results, and iterates up to 5 steps.
 *
 * Input: { goal, tools?: string[], maxSteps?: number }
 * Output: { result, steps[], toolCalls }
 */

const AVAILABLE_TOOLS: Record<string, { description: string; endpoint: string; paramKey: string }> = {
  search: { description: "Search the web for current information", endpoint: "/api/agents/grounded-search", paramKey: "query" },
  analyze_competitor: { description: "Analyze a competitor website", endpoint: "/api/agents/competitive-radar", paramKey: "url" },
  generate_content: { description: "Generate marketing content", endpoint: "/api/agents/blog-gen", paramKey: "topic" },
  generate_image: { description: "Generate an image", endpoint: "/api/agents/flux-image", paramKey: "prompt" },
  translate: { description: "Translate text to another language", endpoint: "/api/agents/translate", paramKey: "text" },
  scan_pii: { description: "Check text for personal data", endpoint: "/api/agents/pii-guard", paramKey: "text" },
  audit_website: { description: "Audit a website for SEO and security", endpoint: "/api/agents/audit", paramKey: "url" },
};

export const POST = createAgentRoute({
  name: "agentic-chain",
  requiredFields: ["goal"],
  handler: async ({ input }) => {
    const goal = input.goal as string;
    const maxSteps = Math.min((input.maxSteps as number) || 5, 8);
    const enabledTools = (input.tools as string[]) || Object.keys(AVAILABLE_TOOLS);

    const steps: Array<{ step: number; action: string; tool?: string; observation: string }> = [];
    let context = "";

    for (let step = 1; step <= maxSteps; step++) {
      // ─── Plan: Ask the LLM what to do next ───
      const toolList = enabledTools
        .filter((t) => AVAILABLE_TOOLS[t])
        .map((t) => `- ${t}: ${AVAILABLE_TOOLS[t].description}`)
        .join("\n");

      const planPrompt = `${getAntiSlopRules()}

You are an autonomous agent. Your goal: "${goal}"

Available tools:
${toolList}
- done: Mark the task as complete

${context ? `Previous steps:\n${context}\n` : ""}

What is the next step? Respond with JSON only:
{"action": "brief description", "tool": "tool_name", "input": "the input for the tool"}
Or if the goal is achieved:
{"action": "task complete", "tool": "done", "result": "final summary"}`;

      const planResult = await nimChat(
        "mistralai/mistral-nemotron",
        [{ role: "user", content: planPrompt }],
        { maxTokens: 300, temperature: 0.2 }
      );

      // Parse the plan
      let plan: { action: string; tool: string; input?: string; result?: string };
      try {
        const cleaned = planResult.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        plan = JSON.parse(cleaned);
      } catch {
        // If parsing fails, treat as done
        steps.push({ step, action: "Planning failed — completing", observation: planResult });
        break;
      }

      // ─── Done: Return result ───
      if (plan.tool === "done") {
        steps.push({ step, action: plan.action, observation: plan.result || "Goal achieved" });
        break;
      }

      // ─── Execute: Call the tool ───
      const tool = AVAILABLE_TOOLS[plan.tool];
      if (!tool) {
        steps.push({ step, action: plan.action, tool: plan.tool, observation: `Tool "${plan.tool}" not found` });
        context += `Step ${step}: Tried ${plan.tool} but it doesn't exist.\n`;
        continue;
      }

      try {
        const toolRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${tool.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [tool.paramKey]: plan.input }),
          signal: AbortSignal.timeout(15000),
        });

        const toolData = await toolRes.json();
        const observation = JSON.stringify(toolData).slice(0, 1000);

        steps.push({ step, action: plan.action, tool: plan.tool, observation });
        context += `Step ${step}: Used ${plan.tool} with "${plan.input}". Result: ${observation.slice(0, 300)}\n`;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        steps.push({ step, action: plan.action, tool: plan.tool, observation: `Tool failed: ${errMsg}` });
        context += `Step ${step}: ${plan.tool} failed: ${errMsg}\n`;
      }
    }

    return {
      goal,
      steps,
      totalSteps: steps.length,
      maxSteps,
      model: "mistral-nemotron (planner) + multi-tool execution",
    };
  },
});

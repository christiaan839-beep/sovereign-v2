import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * MULTI-AGENT SWARM MODE — True parallel agent orchestration.
 * Spawns multiple agents simultaneously, collects results, and 
 * optionally uses a "jury" model to synthesize the best output.
 * 
 * Uses MiniMax M2.7's native multi-agent collaboration capability.
 */

export async function POST(request: Request) {
  try {
    const { task, agents, jury = true } = await request.json();

    if (!task) {
      return NextResponse.json({ error: "task is required." }, { status: 400 });
    }

    // Default swarm: 3 different models attack the same problem
    const swarmAgents = agents || [
      { model: "deepseek-ai/deepseek-v3.2", name: "DeepSeek V3.2" },
      { model: "mistralai/mistral-nemotron", name: "Mistral Nemotron" },
      { model: "z-ai/glm-4.7", name: "GLM-4.7" },
    ];

    // Spawn all agents in parallel
    const swarmPromises = swarmAgents.map(async (agent: { model: string; name: string }) => {
      const startTime = Date.now();
      try {
        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${await getNimKey()}`,
          },
          body: JSON.stringify({
            model: agent.model,
            messages: [
              {
                role: "system",
                content: "You are an expert AI assistant. Provide the most accurate, detailed, and actionable response possible. Be concise but thorough.",
              },
              { role: "user", content: task },
            ],
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });

        const data = await res.json();
        return {
          agent: agent.name,
          model: agent.model,
          output: data?.choices?.[0]?.message?.content || "No response",
          duration_ms: Date.now() - startTime,
          status: "✅ Complete",
        };
      } catch (err) {
        return {
          agent: agent.name,
          model: agent.model,
          output: String(err),
          duration_ms: Date.now() - startTime,
          status: "❌ Failed",
        };
      }
    });

    const swarmResults = await Promise.all(swarmPromises);

    // Jury model synthesizes the best answer from all agents
    let juryVerdict = null;
    if (jury && swarmResults.filter(r => r.status === "✅ Complete").length > 1) {
      const juryPrompt = swarmResults
        .filter(r => r.status === "✅ Complete")
        .map((r, i) => `=== Agent ${i + 1} (${r.agent}) ===\n${r.output}`)
        .join("\n\n");

      const juryRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            {
              role: "system",
              content: `You are a jury synthesizer. Multiple AI agents were given the same task. Review all their outputs below and synthesize the BEST possible answer, combining the strongest elements from each. If agents disagree, use your judgment to determine the most accurate response. Output only the final synthesized answer.`,
            },
            { role: "user", content: `Task: ${task}\n\n${juryPrompt}` },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      const juryData = await juryRes.json();
      juryVerdict = juryData?.choices?.[0]?.message?.content || null;
    }

    return NextResponse.json({
      success: true,
      mode: "SWARM",
      task,
      agents_spawned: swarmResults.length,
      agents_succeeded: swarmResults.filter(r => r.status === "✅ Complete").length,
      total_duration_ms: Math.max(...swarmResults.map(r => r.duration_ms)),
      results: swarmResults,
      jury_verdict: juryVerdict,
    });
  } catch (error) {
    return NextResponse.json({ error: "Swarm mode error", details: String(error) }, { status: 500 });
  }
}

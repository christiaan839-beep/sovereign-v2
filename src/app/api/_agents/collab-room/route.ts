import { auth } from "@clerk/nextjs/server";
export const dynamic = 'force-dynamic';

import { nimChat } from "@/lib/nvidia";

/**
 * AGENT COLLABORATION ROOMS — Multiple agents work on the same task,
 * debate each other, and reach consensus through structured deliberation.
 * Upgraded to true Server-Sent Events (SSE) architecture for live telemetry.
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { task, participants } = await request.json() as { task: string; participants?: { model: string; name: string; role: string }[] };

    if (!task) {
      return new Response(JSON.stringify({ error: "task is required." }), { status: 400 });
    }

    const agents = participants || [
      { model: "nvidia/llama-3.1-nemotron-ultra-253b", name: "Strategist", role: "You are a strategic thinker. Focus on long-term impact, market positioning, and competitive advantage." },
      { model: "mistralai/mistral-nemotron", name: "Operator", role: "You are a practical operator. Focus on execution feasibility, resource requirements, and implementation steps." },
      { model: "qwen/qwen3-235b-a22b", name: "Critic", role: "You are a devil's advocate. Challenge assumptions, identify risks, and find weaknesses in every proposal." },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
        };
        
        try {
          // ROUND 1: Proposals
          const proposals = await Promise.all(
            agents.map(async (agent: { model: string; name: string; role: string }) => {
              try {
                const proposal = await nimChat(
                  agent.model,
                  [
                    { role: "system", content: `${agent.role} Present your proposal clearly.` },
                    { role: "user", content: `Task: ${task}\n\nProvide your proposal (max 200 words).` },
                  ],
                  { maxTokens: 400, temperature: 0.7 }
                );
                sendEvent("proposal", { agent: agent.name, model: agent.model, text: proposal });
                return { agent: agent.name, proposal };
              } catch (err) {
                const errStr = `Error: ${String(err)}`;
                sendEvent("proposal", { agent: agent.name, model: agent.model, text: errStr });
                return { agent: agent.name, proposal: errStr };
              }
            })
          );

          // ROUND 2: Cross-critique
          const critiques = await Promise.all(
            agents.map(async (agent: { model: string; name: string; role: string }, idx: number) => {
              try {
                const othersProposals = proposals
                  .filter((_, i) => i !== idx)
                  .map(p => `${p.agent}: ${p.proposal}`)
                  .join("\n\n");

                const critique = await nimChat(
                  agent.model,
                  [
                    { role: "system", content: `${agent.role} Critique the other agents' proposals. Be specific.` },
                    { role: "user", content: `Your proposal: ${proposals[idx].proposal}\n\nOther proposals:\n${othersProposals}\n\nProvide your critique (max 150 words).` },
                  ],
                  { maxTokens: 300, temperature: 0.5 }
                );
                sendEvent("critique", { agent: agent.name, text: critique });
                return { agent: agent.name, critique };
              } catch {
                sendEvent("critique", { agent: agent.name, text: "Critique unavailable" });
                return { agent: agent.name, critique: "Critique unavailable" };
              }
            })
          );

          // ROUND 3: Chairperson consensus (STREAMING TOKEN BY TOKEN)
          sendEvent("consensus_start", { agent: "Nemotron" });
          
          const deliberationLog = proposals.map((p, i) => 
            `PROPOSAL by ${p.agent}:\n${p.proposal}\n\nCRITIQUE by ${critiques[i].agent}:\n${critiques[i].critique}`
          ).join("\n\n---\n\n");

          const response = await nimChat(
            "nvidia/nemotron-4-340b-instruct",
            [
              {
                role: "system",
                content: "You are the chairperson of an AI collaboration room. Review all proposals and critiques below. Synthesize a powerful, actionable consensus that incorporates strengths and addresses all criticisms.",
              },
              { role: "user", content: `Task: ${task}\n\nDeliberation record:\n${deliberationLog}` },
            ],
            { maxTokens: 1024, temperature: 0.3, stream: true } // STREAM ACTIVATED
          ) as unknown as Response;

          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.replace('data: ', ''));
                    if (data.choices?.[0]?.delta?.content) {
                      sendEvent("consensus_chunk", { text: data.choices[0].delta.content });
                    }
                  } catch {
                    // Ignore malformed stream chunks
                  }
                }
              }
            }
          }
          
          sendEvent("done", {});
          controller.close();
        } catch (err) {
          sendEvent("error", { text: String(err) });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Collaboration room error", details: String(error) }), { status: 500 });
  }
}

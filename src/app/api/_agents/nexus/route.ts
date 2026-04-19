import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * NEXUS PROTOCOL — True parallel multi-model SSE streaming.
 *
 * Fires 4 models simultaneously. Each token from each model is immediately
 * forwarded to the client as it arrives. No sequential waiting — all models
 * generate concurrently. The client sees 4 streams of live tokens.
 *
 * SSE events:
 *   { type: "start",           models: string[] }
 *   { type: "token",           model: string, text: string }
 *   { type: "model_done",      model: string, full: string, latencyMs: number }
 *   { type: "consensus_start"                                }
 *   { type: "consensus_token", text: string                 }
 *   { type: "end",             latencyMs: number            }
 *   { type: "error",           model: string, message: string }
 */

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

const NEXUS_AGENTS = [
  {
    id: "nemotron",
    name: "Nemotron Ultra",
    model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    role: "Strategic Analyst",
    color: "#76b900",
    system: "You are a strategic intelligence analyst. Be sharp, direct, and insight-focused. 3–5 sentences max.",
  },
  {
    id: "qwen",
    name: "Qwen 3",
    model: "qwen/qwen3-235b-a22b",
    role: "Deep Reasoner",
    color: "#9333ea",
    system: "You are a deep logical reasoner. Break down the problem layer by layer. 3–5 sentences max.",
  },
  {
    id: "mistral",
    name: "Mistral Nemotron",
    model: "mistralai/mistral-nemotron",
    role: "Devil's Advocate",
    color: "#f59e0b",
    system: "You are a critical thinker. Challenge assumptions, surface risks, and find the non-obvious angle. 3–5 sentences max.",
  },
  {
    id: "deepseek",
    name: "DeepSeek V3",
    model: "deepseek-ai/deepseek-v3",
    role: "Pragmatist",
    color: "#38bdf8",
    system: "You are a pragmatic executor. Focus on actionable steps, real-world constraints, and what actually works. 3–5 sentences max.",
  },
];

async function streamNimModel(
  agent: (typeof NEXUS_AGENTS)[0],
  prompt: string,
  apiKey: string,
  onToken: (token: string) => void,
  onDone: (full: string, latencyMs: number) => void,
  onError: (msg: string) => void,
) {
  const start = Date.now();
  let full = "";

  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model,
        messages: [
          { role: "system", content: agent.system },
          { role: "user", content: prompt },
        ],
        max_tokens: 350,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content || "";
          if (token) {
            full += token;
            onToken(token);
          }
        } catch {
          // malformed chunk — skip
        }
      }
    }

    onDone(full, Date.now() - start);
  } catch (err) {
    onError(String(err));
    onDone(full || "(model unavailable)", Date.now() - start);
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const prompt = (body.prompt as string)?.trim();
  if (!prompt) return new Response(JSON.stringify({ error: "prompt required" }), { status: 400 });

  const nimKey = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || "";
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* controller closed */
        }
      };

      const globalStart = Date.now();
      const modelOutputs: Record<string, string> = {};

      send({ type: "start", models: NEXUS_AGENTS.map((a) => a.id) });

      // Fire all 4 models IN PARALLEL — no awaiting between them
      const tasks = NEXUS_AGENTS.map(
        (agent) =>
          new Promise<void>((resolve) => {
            if (!nimKey) {
              send({ type: "error", model: agent.id, message: "NIM key not configured" });
              modelOutputs[agent.id] = "(NIM key not configured)";
              send({ type: "model_done", model: agent.id, full: modelOutputs[agent.id], latencyMs: 0 });
              resolve();
              return;
            }

            streamNimModel(
              agent,
              prompt,
              nimKey,
              (token) => send({ type: "token", model: agent.id, text: token }),
              (full, ms) => {
                modelOutputs[agent.id] = full;
                send({ type: "model_done", model: agent.id, full, latencyMs: ms });
                resolve();
              },
              (msg) => send({ type: "error", model: agent.id, message: msg }),
            );
          }),
      );

      // Wait for ALL 4 to finish
      await Promise.all(tasks);

      // Consensus synthesis with Gemini
      send({ type: "consensus_start" });

      try {
        if (geminiKey) {
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

          const synthPrompt = `You received 4 expert analyses of this question: "${prompt}"

${NEXUS_AGENTS.map((a) => `## ${a.name} (${a.role})\n${modelOutputs[a.id] || "No response"}`).join("\n\n")}

Synthesize these perspectives into ONE concise, authoritative answer. 4–6 sentences. Bold the single most important insight. No preamble.`;

          const result = await model.generateContentStream(synthPrompt);

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) send({ type: "consensus_token", text });
          }
        } else {
          // Fallback: simple text synthesis if no Gemini key
          const summary = `Based on ${NEXUS_AGENTS.length} expert perspectives, the key insight is: ${Object.values(modelOutputs)[0]?.slice(0, 200) || "Analysis complete."}`;
          send({ type: "consensus_token", text: summary });
        }
      } catch {
        send({ type: "consensus_token", text: "Consensus synthesis unavailable — see individual model responses above." });
      }

      send({ type: "end", latencyMs: Date.now() - globalStart });
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

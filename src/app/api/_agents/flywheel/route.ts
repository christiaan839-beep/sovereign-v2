import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";
import { persistRead, persistAppend } from "@/lib/persist";

/**
 * AI-Q DATA FLYWHEEL — Continuous self-improvement system inspired
 * by NVIDIA's AI-Q Blueprint.
 * 
 * Tracks: successful outputs, failed outputs, user ratings.
 * Builds: optimized prompt templates that get better over time.
 * Exports: training-ready datasets for fine-tuning.
 * 
 * This is the self-teaching backbone of the platform.
 */

interface FlywheelEntry {
  id: string;
  agent: string;
  prompt: string;
  output_preview: string;
  rating: number;
  timestamp: string;
}

export async function POST(request: Request) {
  try {
    const { action, agent, prompt = "", output = "", rating = 0 } = await request.json();

    if (action === "ingest") {
      if (!agent || !prompt) {
        return NextResponse.json({ error: "agent and prompt required." }, { status: 400 });
      }

      const entry: FlywheelEntry = {
        id: `fw-${Date.now()}`,
        agent,
        prompt,
        output_preview: String(output).substring(0, 300),
        rating,
        timestamp: new Date().toISOString(),
      };

      persistAppend("flywheel-data", entry, 2000);

      return NextResponse.json({ success: true, ingested: entry });
    }

    if (action === "optimize") {
      if (!agent) {
        return NextResponse.json({ error: "agent required." }, { status: 400 });
      }

      const data = persistRead<FlywheelEntry[]>("flywheel-data", []);
      const agentData = data.filter(d => d.agent === agent);
      const good = agentData.filter(d => d.rating >= 4);
      const bad = agentData.filter(d => d.rating <= 2);

      if (agentData.length < 10) {
        return NextResponse.json({ success: true, message: `Need at least 10 data points. Current: ${agentData.length}` });
      }

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages: [
            { role: "system", content: "You are an AI optimization engineer. Analyze the successful vs failed outputs below and generate an IMPROVED system prompt for this agent. The new prompt must maximize the patterns seen in successful outputs and avoid patterns from failed ones." },
            { role: "user", content: `Agent: ${agent}\n\nSUCCESSFUL (rating 4-5, ${good.length} entries):\n${good.slice(-5).map(g => `Prompt: ${g.prompt}\nOutput: ${g.output_preview}`).join("\n---\n")}\n\nFAILED (rating 1-2, ${bad.length} entries):\n${bad.slice(-5).map(b => `Prompt: ${b.prompt}\nOutput: ${b.output_preview}`).join("\n---\n")}` },
          ],
          max_tokens: 800,
          temperature: 0.2,
        }),
      });

      const optimData = await res.json();

      return NextResponse.json({
        success: true,
        agent,
        data_points: agentData.length,
        good_examples: good.length,
        bad_examples: bad.length,
        optimized_prompt: optimData?.choices?.[0]?.message?.content || "",
      });
    }

    if (action === "export") {
      const data = persistRead<FlywheelEntry[]>("flywheel-data", []);
      return NextResponse.json({
        success: true,
        total_entries: data.length,
        by_agent: [...new Set(data.map(d => d.agent))].map(a => ({
          agent: a,
          count: data.filter(d => d.agent === a).length,
          avg_rating: +(data.filter(d => d.agent === a).reduce((s, d) => s + d.rating, 0) / data.filter(d => d.agent === a).length).toFixed(2),
        })),
        export: data,
      });
    }

    return NextResponse.json({ error: "action must be 'ingest', 'optimize', or 'export'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Flywheel error", details: String(error) }, { status: 500 });
  }
}

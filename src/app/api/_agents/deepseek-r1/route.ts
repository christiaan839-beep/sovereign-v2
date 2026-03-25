import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * DEEPSEEK R1 REASONING — Distilled reasoning model optimized
 * for math, science, and logic problems.
 * 
 * Uses DeepSeek R1-Distill-Qwen-32B for:
 * - Step-by-step mathematical proofs
 * - Scientific analysis
 * - Logical deduction
 * - Code debugging with reasoning traces
 * 
 * LICENSE: DeepSeek License — free for commercial use.
 */

export async function POST(request: Request) {
  try {
    const { problem, domain = "general" } = await request.json();

    if (!problem) {
      return NextResponse.json({ error: "problem is required." }, { status: 400 });
    }

    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-r1-distill-qwen-32b",
        messages: [
          {
            role: "system",
            content: `You are a deep reasoning engine specializing in ${domain}. Show your COMPLETE chain of thought: state assumptions, work through each step, verify your logic, and clearly mark your final answer. Use <think>...</think> tags for your reasoning process.`,
          },
          { role: "user", content: problem },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    });

    const data = await res.json();
    const fullResponse = data?.choices?.[0]?.message?.content || "";

    // Extract reasoning and final answer
    const thinkMatch = fullResponse.match(/<think>([\s\S]*?)<\/think>/);
    const reasoning = thinkMatch ? thinkMatch[1].trim() : "";
    const answer = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    return NextResponse.json({
      success: true,
      model: "DeepSeek R1 Distill Qwen 32B (Reasoning-Optimized)",
      domain,
      reasoning_trace: reasoning || "Reasoning embedded in answer",
      final_answer: answer || fullResponse,
      duration_ms: Date.now() - start,
      license: "DeepSeek License — commercial use permitted",
    });
  } catch (error) {
    return NextResponse.json({ error: "Reasoning engine error", details: String(error) }, { status: 500 });
  }
}

import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";

/**
 * NEMOTRON REASONING CHAIN — Multi-step deep reasoning using the
 * Nemotron Ultra 253B model for complex problems that require
 * chain-of-thought analysis.
 * 
 * Steps:
 * 1. Decompose the problem into sub-questions
 * 2. Answer each sub-question independently
 * 3. Synthesize into a final coherent answer
 * 4. Self-critique and refine
 * 
 * Use for: legal analysis, strategic planning, complex research,
 * multi-variable decision making.
 */

export async function POST(request: Request) {
  try {
    const { question, depth = 3, domain = "general" } = await request.json();

    if (!question) {
      return NextResponse.json({ error: "question is required." }, { status: 400 });
    }
    

    const steps: Array<{ step: string; content: string; model: string; duration_ms: number }> = [];
    const startTime = Date.now();

    // Step 1: Decompose into sub-questions
    const decomposeStart = Date.now();
    const decomposeRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-ultra-253b",
        messages: [
          { role: "system", content: `You are a master analyst specializing in ${domain}. Break the following question into ${depth} essential sub-questions that must be answered to give a complete response. Output ONLY a numbered list of sub-questions.` },
          { role: "user", content: question },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    const decomposeData = await decomposeRes.json();
    const subQuestions = decomposeData?.choices?.[0]?.message?.content || "";
    steps.push({ step: "Decompose", content: subQuestions, model: "nemotron-ultra-253b", duration_ms: Date.now() - decomposeStart });

    // Step 2: Deep analysis on each sub-question
    const analysisStart = Date.now();
    const analysisRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v3.2",
        messages: [
          { role: "system", content: `You are a deep researcher. Answer each of these sub-questions thoroughly with evidence and reasoning. Domain: ${domain}.` },
          { role: "user", content: `Original question: ${question}\n\nSub-questions to answer:\n${subQuestions}` },
        ],
        max_tokens: 1500,
        temperature: 0.5,
      }),
    });

    const analysisData = await analysisRes.json();
    const analysis = analysisData?.choices?.[0]?.message?.content || "";
    steps.push({ step: "Deep Analysis", content: analysis, model: "deepseek-v3.2", duration_ms: Date.now() - analysisStart });

    // Step 3: Synthesize final answer — Claude Extended Thinking for deep reasoning, NIM fallback
    const synthStart = Date.now();
    let synthesis = "";
    let synthModel = "nemotron-ultra-253b";

    try {
      synthesis = await ai(
        `Question: ${question}\n\nDetailed analysis:\n${analysis}`,
        {
          model: "claude",
          thinking: true,
          system: "Synthesize the analysis below into a clear, actionable final answer. Think deeply about the connections between sub-answers. Be specific, include concrete recommendations, and highlight key insights. Structure with headers.",
        }
      );
      synthModel = "claude-sonnet-4-extended-thinking";
    } catch {
      // Fallback to NIM if Claude is unavailable
      const synthRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-ultra-253b",
          messages: [
            { role: "system", content: "Synthesize the analysis below into a clear, actionable final answer. Be specific, include concrete recommendations, and highlight key insights. Structure with headers." },
            { role: "user", content: `Question: ${question}\n\nDetailed analysis:\n${analysis}` },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      const synthData = await synthRes.json();
      synthesis = synthData?.choices?.[0]?.message?.content || "";
    }
    steps.push({ step: "Synthesis", content: synthesis, model: synthModel, duration_ms: Date.now() - synthStart });

    // Step 4: Self-critique
    const critiqueStart = Date.now();
    const critiqueRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "mistralai/mistral-nemotron",
        messages: [
          { role: "system", content: "Critically review this answer. Identify any weak points, missing perspectives, or logical gaps. Then provide 2-3 specific improvements. Be concise." },
          { role: "user", content: `Question: ${question}\n\nAnswer:\n${synthesis}` },
        ],
        max_tokens: 400,
        temperature: 0.4,
      }),
    });

    const critiqueData = await critiqueRes.json();
    const critique = critiqueData?.choices?.[0]?.message?.content || "";
    steps.push({ step: "Self-Critique", content: critique, model: "mistral-nemotron", duration_ms: Date.now() - critiqueStart });

    return NextResponse.json({
      success: true,
      mode: "NEMOTRON_REASONING_CHAIN",
      question,
      domain,
      depth,
      total_duration_ms: Date.now() - startTime,
      models_used: ["nemotron-ultra-253b", "deepseek-v3.2", synthModel, "mistral-nemotron"],
      final_answer: synthesis,
      self_critique: critique,
      reasoning_chain: steps.map(s => ({
        step: s.step,
        model: s.model,
        duration_ms: s.duration_ms,
        preview: s.content.substring(0, 300),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Reasoning chain error", details: String(error) }, { status: 500 });
  }
}

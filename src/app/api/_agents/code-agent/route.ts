import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * MINIMAX M2.5 CODE AGENT — Coding-optimized model for better
 * code generation than general-purpose LLMs.
 * 
 * Specializes in: HTML, CSS, JS, Python, TypeScript, React,
 * SQL queries, shell scripts, and code debugging.
 * 
 * LICENSE: MiniMax Open License — commercial use permitted.
 */

export async function POST(request: Request) {
  try {
    const { task, language = "typescript", context = "" } = await request.json();

    if (!task) {
      return NextResponse.json({ error: "task is required." }, { status: 400 });
    }

    const start = Date.now();
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${await getNimKey()}` },
      body: JSON.stringify({
        model: "minimaxai/minimax-m2.5",
        messages: [
          {
            role: "system",
            content: `You are an elite software engineer. Write clean, production-ready ${language} code. Follow best practices: proper error handling, type safety, clear naming, and comments for complex logic. If debugging, explain the root cause first, then provide the fix.${context ? `\n\nExisting context:\n${context}` : ""}`,
          },
          { role: "user", content: task },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      success: true,
      model: "MiniMax M2.5 (Code-Optimized)",
      language,
      code: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
      license: "MiniMax Open License — commercial use permitted",
    });
  } catch (error) {
    return NextResponse.json({ error: "Code agent error", details: String(error) }, { status: 500 });
  }
}

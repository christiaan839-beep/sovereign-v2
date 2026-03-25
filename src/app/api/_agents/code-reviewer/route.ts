import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * NEMOCLAW CODE REVIEWER — Paste code and get a security audit,
 * performance review, and refactor suggestions.
 * Uses Devstral 2 123B (NVIDIA's coding specialist).
 */

export async function POST(request: Request) {
  try {
    const { code, language = "auto-detect", focus = "full" } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "code is required." }, { status: 400 });
    }

    const start = Date.now();

    const focusPrompts: Record<string, string> = {
      full: "Perform a COMPLETE code review covering security, performance, maintainability, and best practices.",
      security: "Focus ONLY on security vulnerabilities: injection risks, auth bypasses, data exposure, OWASP Top 10.",
      performance: "Focus ONLY on performance: time complexity, memory leaks, N+1 queries, unnecessary re-renders, caching opportunities.",
      refactor: "Focus ONLY on code quality: DRY violations, function length, naming conventions, TypeScript best practices, design patterns.",
    };

    const review = await nimChat(
      "nvidia/devstral-2-123b-instruct-2512",
      [
        {
          role: "system",
          content: `You are a principal engineer at a FAANG company performing code review. Be specific, cite line numbers, and provide fixed code snippets.`,
        },
        {
          role: "user",
          content: `Review this ${language} code.\n\nFOCUS: ${focusPrompts[focus] || focusPrompts.full}\n\n\`\`\`${language}\n${code.substring(0, 50000)}\n\`\`\`\n\nOutput JSON:
{
  "overall_grade": "A|B|C|D|F",
  "security_score": 0-100,
  "performance_score": 0-100,
  "maintainability_score": 0-100,
  "issues": [{"severity": "CRITICAL|HIGH|MEDIUM|LOW", "line": "line number or range", "issue": "description", "fix": "code snippet fix"}],
  "positive_patterns": ["things done well"],
  "refactored_code": "the improved version of the code (or 'N/A' if no changes needed)",
  "estimated_tech_debt_hours": 0
}

Output ONLY valid JSON.`,
        },
      ],
      { maxTokens: 4000, temperature: 0.2 }
    );

    let parsed;
    try {
      parsed = JSON.parse(review.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      parsed = { raw: review };
    }

    return NextResponse.json({
      success: true,
      agent: "nemoclaw-code-reviewer",
      language,
      focus,
      code_stats: {
        lines: code.split("\n").length,
        characters: code.length,
      },
      review: parsed,
      duration_ms: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json({ error: "Code reviewer error", details: String(error) }, { status: 500 });
  }
}

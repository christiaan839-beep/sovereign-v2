import { NextRequest, NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

export async function POST(req: NextRequest) {
  const { platform, metrics, goal, dateRange } = await req.json();

  const systemPrompt = `You are a performance marketing analyst. You analyze ad campaign data and provide specific, actionable recommendations. Never use vague language. Always reference specific metrics, suggest specific budget changes, and identify specific creative or targeting improvements. Format your response as:

## Campaign Summary
[2-3 sentence overview with key metrics]

## What's Working
[Bullet points with specific metrics]

## What's Not Working
[Bullet points with specific metrics]

## Recommended Actions
[Numbered list of specific changes with expected impact]

## Budget Recommendation
[Specific reallocation suggestions]`;

  const prompt = `Analyze this ${platform || "digital advertising"} campaign data:

${metrics ? `Metrics provided:\n${metrics}` : "No metrics provided — give a general campaign audit framework."}
${goal ? `Campaign goal: ${goal}` : ""}
${dateRange ? `Date range: ${dateRange}` : ""}

Provide specific, actionable recommendations. No fluff.`;

  try {
    const result = await nimChat("nvidia/llama-3.1-nemotron-ultra-253b-v1", [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    return NextResponse.json({
      success: true,
      report: result,
      platform,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

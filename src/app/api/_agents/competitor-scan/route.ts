import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ai, research_ai } from "@/lib/ai";

/**
 * COMPETITOR SCAN — Real web research + LLM analysis.
 * Uses Tavily to scrape the target domain, then synthesizes an
 * intelligence report with vulnerabilities and counter-strikes.
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const target = body.target || body.url || body.prompt || "";
    const context = body.context || ""; // Context from previous playbook steps

    if (!target) {
      return NextResponse.json({ error: "target domain is required." }, { status: 400 });
    }

    const start = Date.now();

    // Step 1: Real web research via Tavily
    let webIntel = "";
    try {
      webIntel = await research_ai(
        `${target} complaints reviews criticism pricing problems`,
        `What are the weaknesses, negative reviews, pricing complaints, and competitive vulnerabilities of ${target}? Include any public criticism.`
      );
    } catch {
      webIntel = `Unable to scrape ${target} — Tavily key may not be configured. Falling back to LLM analysis.`;
    }

    // Step 2: LLM analysis to produce structured intel
    const analysis = await ai(
      `You are a competitive intelligence analyst. Based on the web research below, produce a tactical intelligence report.

TARGET: ${target}

WEB RESEARCH:
${webIntel}
${context ? `\nADDITIONAL CONTEXT FROM PREVIOUS ANALYSIS:\n${context.slice(0, 2000)}` : ""}

OUTPUT (strict JSON):
{
  "threat_level": "HIGH|MEDIUM|LOW",
  "vulnerabilities": ["5 specific exploitable weaknesses with evidence"],
  "counter_strikes": ["5 specific offensive actions our agency can take to beat them"],
  "positioning_angles": ["3 specific ways to position against this competitor"]
}

Be specific, actionable, and data-driven. Reference real findings from the research. Output ONLY valid JSON.`,
      { system: "You are a strategic competitive analyst. Be specific — cite real data. No generic advice.", maxTokens: 2500 }
    );

    let parsed;
    try {
      parsed = JSON.parse(analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      parsed = {
        threat_level: "MEDIUM",
        vulnerabilities: ["Analysis produced non-structured output. Raw result available."],
        counter_strikes: [analysis.substring(0, 200)],
      };
    }

    const result = {
      success: true,
      target,
      threat_level: parsed.threat_level,
      vulnerabilities: parsed.vulnerabilities,
      counter_strikes: parsed.counter_strikes,
      positioning_angles: parsed.positioning_angles || [],
      duration_ms: Date.now() - start,
    };

    // Auto-handoff to report writer
    fetch(new URL("/api/_agents/comms", request.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "competitor-scout",
        to: "client-report",
        type: "handoff",
        payload: { intel: result, action: "generate_report" },
        autoExecute: false
      })
    }).catch(() => {}); // Fire and forget

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Competitor scan error", details: String(error) }, { status: 500 });
  }
}

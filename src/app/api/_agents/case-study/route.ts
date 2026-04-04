import { auth } from "@clerk/nextjs/server";
import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * CASE STUDY GENERATOR — Takes client metrics and generates a polished
 * case study document automatically.
 */

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const prompt = body.prompt || body.topic || "";
    const context = body.context || "";
    const { clientName, industry, metrics, challenge, result: outcome } = body;

    if (!clientName && !prompt) {
      return NextResponse.json({ error: "clientName or prompt is required." }, { status: 400 });
    }


    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
            content: `You are a professional case study writer for Sovereign Matrix. Generate a detailed, persuasive case study in HTML format. Structure:
1. H1: "[Client Name] Case Study"
2. Executive Summary (2-3 sentences)
3. The Challenge (what problem they faced)
4. The Solution (how Sovereign Matrix solved it)
5. The Results (specific metrics and improvements)
6. Client Quote (generate a realistic testimonial)
7. Key Takeaways (3 bullet points)

Make it professional, data-driven, and compelling. Use semantic HTML with proper headings.${context ? `\n\nCONTEXT FROM PREVIOUS ANALYSIS:\n${context}` : ""}`,
          },
          {
            role: "user",
            content: `${prompt ? `Task: ${prompt}\n\n` : ""}Client: ${clientName || "Unknown"}
Industry: ${industry || "Technology"}
Metrics: ${JSON.stringify(metrics || { leads: "+340%", revenue: "+R180,000/mo", time_saved: "60 hours/week" })}
Challenge: ${challenge || "Manual marketing operations were too slow and expensive"}
Outcome: ${outcome || "Autonomous AI agents replaced the entire marketing team"}`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    const nimData = await nimRes.json();
    const caseStudyHtml = nimData?.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      success: true,
      clientName,
      industry: industry || "Technology",
      html: caseStudyHtml,
      wordCount: caseStudyHtml.split(/\s+/).length,
      slug: `/case-studies/${(clientName || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Case study error", details: String(error) }, { status: 500 });
  }
}

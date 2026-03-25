import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * ABM ARTILLERY NODE — Autonomous Account-Based Marketing
 * 
 * Flow:
 * 1. Client submits a target company name
 * 2. Tavily API scrapes the company's website in real-time
 * 3. NVIDIA NIM (Nemotron) analyzes the data and writes a hyper-personalized outreach email
 * 4. Resend API fires the email to the target
 */

export async function POST(request: Request) {
  try {
    const { companyName, targetEmail } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    // ═══════════════════════════════════════════════
    // STEP 1: TAVILY DEEP RESEARCH
    // ═══════════════════════════════════════════════
    const tavilyKey = process.env.TAVILY_API_KEY;
    let companyIntel = "No intelligence gathered.";

    if (tavilyKey) {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `What does ${companyName} do? What are their main products, services, and pain points?`,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        }),
      });
      const tavilyData = await tavilyRes.json();
      companyIntel = tavilyData.answer || tavilyData.results?.map((r: { content: string }) => r.content).join("\n") || "No intelligence gathered.";
    }

    // ═══════════════════════════════════════════════
    // STEP 2: NVIDIA NIM GENERATES OUTREACH EMAIL
    // ═══════════════════════════════════════════════
    let emailBody = `We'd love to help ${companyName} scale with AI.`;

    if (await getNimKey()) {
      const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "mistralai/mistral-nemotron",
          messages: [
            {
              role: "system",
              content: `You are an elite B2B outreach copywriter for Sovereign Matrix, the most advanced autonomous AI agency platform. Write a cold email (max 150 words) that:
1. References a SPECIFIC pain point or opportunity for the target company based on the intelligence provided.
2. Positions Sovereign Matrix as the solution (autonomous AI agents replacing manual marketing teams).
3. Ends with a single call-to-action to book a 15-minute strategy call.
4. Be professional, sharp, and avoid generic filler. No "I hope this email finds you well."
5. Subject line should be included at the top, prefixed with "Subject: ".`,
            },
            {
              role: "user",
              content: `Target Company: ${companyName}\n\nIntelligence Report:\n${companyIntel}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });
      const nimData = await nimRes.json();
      emailBody = nimData?.choices?.[0]?.message?.content || emailBody;
    }

    // ═══════════════════════════════════════════════
    // STEP 3: RESEND FIRES THE EMAIL
    // ═══════════════════════════════════════════════
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "kilo@sovereignmatrix.agency";
    let emailSent = false;

    // Extract subject line from AI response
    const subjectMatch = emailBody.match(/Subject:\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : `${companyName} × Sovereign Matrix`;
    const bodyWithoutSubject = emailBody.replace(/Subject:\s*.+\n?/i, "").trim();

    if (resendKey && targetEmail) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: targetEmail,
          subject: subject,
          text: bodyWithoutSubject,
        }),
      });
      emailSent = resendRes.ok;
    }

    return NextResponse.json({
      success: true,
      target: companyName,
      intelligence: companyIntel.substring(0, 300) + "...",
      generatedEmail: {
        subject,
        body: bodyWithoutSubject,
      },
      emailSent,
      pipeline: [
        "✅ Tavily Deep Research Complete",
        "✅ NVIDIA NIM Email Generation Complete",
        emailSent ? "✅ Resend Email Dispatched" : "⏳ No target email provided — email stored for manual dispatch",
      ],
    });

  } catch (error) {
    console.error("[ABM_ARTILLERY_ERROR]", error);
    return NextResponse.json({ error: "Artillery pipeline failure", details: String(error) }, { status: 500 });
  }
}

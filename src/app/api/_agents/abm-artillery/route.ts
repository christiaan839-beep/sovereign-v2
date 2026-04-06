import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * ABM ARTILLERY — Account-Based Marketing automation.
 * 1. Tavily researches the target company
 * 2. NIM writes personalized outreach email
 * 3. Resend fires the email (if target email provided)
 */

const schema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  targetEmail: z.string().email().optional(),
  prompt: z.string().max(5000).optional(),
  context: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "abm-artillery",
  schema,
  handler: async ({ input }) => {
    const companyName = input.companyName as string;
    const targetEmail = input.targetEmail as string | undefined;
    const context = (input.context as string) || "";

    // Step 1: Tavily research
    const tavilyKey = process.env.TAVILY_API_KEY;
    let companyIntel = "";
    let researchAvailable = false;

    if (tavilyKey) {
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `What does ${companyName} do? Products, services, pain points?`,
            search_depth: "advanced",
            max_results: 5,
            include_answer: true,
          }),
        });
        const tavilyData = await tavilyRes.json();
        companyIntel = tavilyData.answer || tavilyData.results?.map((r: { content: string }) => r.content).join("\n") || "";
        researchAvailable = companyIntel.length > 50;
      } catch { /* research unavailable */ }
    }

    // Step 2: NIM generates outreach email
    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "mistralai/mistral-nemotron",
        messages: [
          {
            role: "system",
            content: `You are a B2B outreach copywriter. Write a cold email (max 150 words) that:
1. References a specific pain point for the target company${researchAvailable ? " based on the research" : ""}
2. Positions our platform as the solution
3. Ends with a CTA to book a 15-minute call
4. Include "Subject: " line at the top
5. Sound human, not templated. No "I hope this email finds you well."${context ? `\nCONTEXT:\n${context.slice(0, 1000)}` : ""}`,
          },
          {
            role: "user",
            content: `Target: ${companyName}\n\n${researchAvailable ? `Research:\n${companyIntel}` : "No research available — write based on general industry knowledge."}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const nimData = await nimRes.json();
    const emailBody = nimData?.choices?.[0]?.message?.content || `Personalized outreach for ${companyName}`;

    // Extract subject line
    const subjectMatch = emailBody.match(/Subject:\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : `${companyName} — Quick Question`;
    const bodyWithoutSubject = emailBody.replace(/Subject:\s*.+\n?/i, "").trim();

    // Step 3: Send via Resend (if email provided)
    let emailSent = false;
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && targetEmail) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || "outreach@sovereignmatrix.agency",
            to: targetEmail,
            subject,
            text: bodyWithoutSubject,
          }),
        });
        emailSent = resendRes.ok;
      } catch { /* email send failed — non-blocking */ }
    }

    return {
      success: true,
      target: companyName,
      researchGrounded: researchAvailable,
      generatedEmail: { subject, body: bodyWithoutSubject },
      emailSent,
      emailTarget: targetEmail || null,
    };
  },
});

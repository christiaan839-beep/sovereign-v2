import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * CASE STUDY GENERATOR — Takes client metrics and generates a polished
 * case study document in HTML format.
 */

const schema = z.object({
  clientName: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  metrics: z.record(z.string(), z.string()).optional(),
  challenge: z.string().max(2000).optional(),
  result: z.string().max(2000).optional(),
  prompt: z.string().max(5000).optional(),
  topic: z.string().max(500).optional(),
  context: z.string().max(5000).optional(),
}).refine(
  (d) => d.clientName || d.prompt || d.topic,
  { message: "Provide at least a clientName, prompt, or topic" }
);

export const POST = createAgentRoute({
  name: "case-study",
  schema,
  handler: async ({ input }) => {
    const clientName = (input.clientName as string) || "";
    const industry = (input.industry as string) || "Technology";
    const metrics = (input.metrics as Record<string, string>) || {};
    const challenge = (input.challenge as string) || "";
    const outcome = (input.result as string) || "";
    const prompt = (input.prompt || input.topic || "") as string;
    const context = (input.context || "") as string;

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v3.2",
        messages: [
          {
            role: "system",
            content: `You are a professional case study writer. Generate a detailed, persuasive case study in HTML format. Structure:
1. H1: "[Client Name] Case Study"
2. Executive Summary (2-3 sentences)
3. The Challenge (what problem they faced)
4. The Solution (how the platform solved it)
5. The Results (specific metrics and improvements)
6. Key Takeaways (3 bullet points)

Be specific and data-driven. Use semantic HTML.${context ? `\n\nCONTEXT:\n${context}` : ""}`,
          },
          {
            role: "user",
            content: `${prompt ? `Task: ${prompt}\n\n` : ""}Client: ${clientName || "Client"}
Industry: ${industry}
Metrics: ${JSON.stringify(Object.keys(metrics).length > 0 ? metrics : { leads: "+340%", revenue: "+R180,000/mo" })}
Challenge: ${challenge || "Not specified"}
Outcome: ${outcome || "Not specified"}`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!nimRes.ok) {
      throw new Error(`NIM API returned ${nimRes.status}`);
    }

    const nimData = await nimRes.json();
    const caseStudyHtml = nimData?.choices?.[0]?.message?.content || "";

    return {
      success: true,
      clientName: clientName || "Draft",
      industry,
      html: caseStudyHtml,
      wordCount: caseStudyHtml.split(/\s+/).length,
      slug: `/case-studies/${(clientName || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    };
  },
});

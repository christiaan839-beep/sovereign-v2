import { createAgentRoute } from "@/lib/agent-factory";

/**
 * GHOST FLEET — Competitive intelligence agent that generates targeted
 * outreach based on competitor weaknesses. Wrapped in security factory.
 */

export const POST = createAgentRoute({
  name: "ghost-fleet",
  requiredFields: ["competitorName"],
  handler: async ({ input }) => {
    const competitorName = input.competitorName as string;
    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) throw new Error("NVIDIA_NIM_API_KEY not configured");

    const prompt = `You are an elite B2B Sales Development Representative (SDR).
I am targeting unhappy customers of: ${competitorName}.
Create ONE highly realistic, specific complaint from a frustrated user.
Then, invent a realistic B2B buyer persona for this user (Name, Title, Company).
Finally, write a 3-sentence, hyper-personalized LinkedIn connection request acknowledging their frustration and softly pitching an alternative. DO NOT BE SALESY. Be conversational.

Respond ONLY in strict JSON format:
{
  "lead": { "name": "First Last", "title": "Job Title", "company": "Company Name", "linkedIn": "linkedin.com/in/firstlast" },
  "complaint": { "source": "G2 Review", "text": "The actual complaint text..." },
  "draftMessage": "The 3 sentence message..."
}`;

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: "nvidia/nemotron-4-340b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`NIM API error: ${res.status}`);

    const data = await res.json();
    const raw = data.choices[0].message.content;

    try {
      return JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error("Failed to parse AI JSON response");
    }
  },
});

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
const log = createLogger("ghost-fleet-agent");

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { competitorName } = await req.json();

    if (!competitorName) {
      return NextResponse.json({ error: "Missing competitor target." }, { status: 400 });
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) {
      return NextResponse.json({ error: "NVIDIA_NIM_API_KEY is not configured." }, { status: 500 });
    }

    // Phase 1: Simulate/Execute Tavily Search for Complaints
    // Since scraping G2/Twitter in real-time takes complex custom scrapers, we will simulate
    // the "insight" gathering using Nemotron to generate realistic complaint data for the demo,
    // assuming this would be replaced by a real Firecrawl/Tavily actor in production.
    const prompt = `You are an elite B2B Sales Development Representative (SDR). 
I am targeting unhappy customers of: ${competitorName}.
Create ONE highly realistic, specific complaint from a frustrated user.
Then, invent a realistic B2B buyer persona for this user (Name, Title, Company).
Finally, write a 3-sentence, hyper-personalized LinkedIn connection request acknowledging their frustration and softly pitching an alternative. DO NOT BE SALESY. Be conversational.

Respond ONLY in strict JSON format:
{
  "lead": {
    "name": "First Last",
    "title": "Job Title",
    "company": "Company Name",
    "linkedIn": "linkedin.com/in/firstlast"
  },
  "complaint": {
    "source": "G2 Review",
    "text": "The actual complaint text..."
  },
  "draftMessage": "The 3 sentence message..."
}`;

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-4-340b-instruct",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      }),
    });

    if (!res.ok) {
      throw new Error(`NIM API error: ${res.status}`);
    }

    const data = await res.json();
    let resultJson;
    try {
        resultJson = JSON.parse(data.choices[0].message.content);
    } catch {
        // Fallback if the model failed to return pure JSON
        const rawContent = data.choices[0].message.content;
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
            resultJson = JSON.parse(match[0]);
        } else {
            throw new Error("Failed to parse AI JSON response.");
        }
    }

    return NextResponse.json(resultJson);

  } catch (error: unknown) {
    log.error("Ghost fleet error", error as Record<string, unknown>);
    return NextResponse.json({ error: (error as Error).message || "Failed to execute Ghost Fleet operations." }, { status: 500 });
  }
}

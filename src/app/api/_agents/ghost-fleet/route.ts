import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
const log = createLogger("ghost-fleet-agent");

/**
 * GHOST FLEET — Synthetic competitor-complaint persona generator (BETA).
 *
 * IMPORTANT honest framing: this agent does NOT scrape G2, Twitter, or
 * any real review site. It uses NVIDIA Nemotron to *simulate* a
 * plausible-sounding complaint and matching B2B persona. The output is
 * useful as ICP-shaped inspiration for outbound, but every persona is
 * invented and must not be presented to a buyer as a real customer
 * complaint. Real scraping (Firecrawl / Apollo) is a separate
 * implementation tracked in the roadmap.
 *
 * The response carries `synthetic: true` and a human-readable
 * `disclaimer` so downstream UIs can clearly mark the output. Callers
 * that ignore those flags are responsible for any misrepresentation.
 */
export const POST = createAgentRoute({
  name: "ghost-fleet",
  handler: async ({ input }) => {
    const { competitorName } = input as Record<string, any>;

    if (!competitorName) {
      return { error: "Missing competitor target." };
    }

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) {
      return { error: "NVIDIA_NIM_API_KEY is not configured." };
    }

    // The prompt explicitly tells the model the persona is fictional so
    // the output never claims sourcing it doesn't have. A real-scraping
    // mode would replace this with a Firecrawl + dedup + verify chain.
    const prompt = `You are an SDR research assistant generating a SYNTHETIC ICP for outbound research against ${competitorName}.

The persona, complaint, and message you generate are FICTIONAL but should be plausible — useful as a concept for outbound campaigns, never to be presented as a real customer.

Respond ONLY in strict JSON, with these exact keys:
{
  "lead": {
    "name": "First Last",
    "title": "Job Title",
    "company": "Company Name",
    "linkedIn": "linkedin.com/in/firstlast"
  },
  "complaint": {
    "source": "synthetic",
    "text": "A plausible complaint a frustrated user might write (do not claim a real source)"
  },
  "draftMessage": "A 3-sentence LinkedIn connection note that acknowledges the frustration without being salesy."
}`;

    const res = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${nimKey}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-4-340b-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`NIM API error: ${res.status}`);
    }

    const data = await res.json();
    let resultJson;
    try {
      resultJson = JSON.parse(data.choices[0].message.content);
    } catch {
      const rawContent = data.choices[0].message.content;
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        resultJson = JSON.parse(match[0]);
      } else {
        log.error("Ghost-fleet: model returned non-JSON", {
          contentPreview: rawContent.slice(0, 200),
        });
        throw new Error("Failed to parse AI JSON response.");
      }
    }

    // Force-stamp the synthetic flag and disclaimer onto the response so
    // callers can't accidentally render this as real scraped data.
    if (resultJson?.complaint && typeof resultJson.complaint === "object") {
      resultJson.complaint.source = "synthetic";
    }

    return NextResponse.json({
      ok: true,
      mode: "simulated",
      synthetic: true,
      ...resultJson,
      disclaimer:
        "Persona, complaint, and message are AI-generated for ICP research. Do not present as a real customer. Real scraping is on the roadmap.",
    });
  },
});

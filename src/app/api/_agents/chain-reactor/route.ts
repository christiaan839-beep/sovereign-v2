import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * WEBHOOK CHAIN REACTOR — Autonomous Agent Orchestration Engine.
 * Chains multiple agents together into automated workflows.
 *
 * Example chain: Lead Submit → Sentinel Call → ABM Email → PII Scrub → Doc Embed
 *
 * Each chain is a sequence of agent API calls that execute sequentially,
 * passing output from one agent as input to the next.
 */

interface ChainStep {
  agent: string;
  endpoint: string;
  transform: (
    prevResult: Record<string, unknown>,
    initialInput: Record<string, unknown>,
  ) => Record<string, unknown>;
}

const CHAINS: Record<
  string,
  { name: string; description: string; steps: ChainStep[] }
> = {
  "lead-to-close": {
    name: "Lead-to-Close Pipeline",
    description:
      "Lead submits form → ABM Artillery researches company → generates email → PII scrubs data → embeds into knowledge base.",
    steps: [
      {
        agent: "ABM Artillery",
        endpoint: "/api/_agents/abm-artillery",
        transform: (_prev, input) => ({
          companyName: input.company || "Unknown Company",
          targetEmail: input.email,
        }),
      },
      {
        agent: "PII Redactor",
        endpoint: "/api/_agents/pii-redactor",
        transform: (prev) => ({ text: JSON.stringify(prev), redact: true }),
      },
      {
        agent: "Document Intelligence",
        endpoint: "/api/_agents/doc-intel",
        transform: (prev) => ({
          action: "embed",
          text:
            typeof prev === "object"
              ? (prev as Record<string, unknown>).redacted_text ||
                JSON.stringify(prev)
              : String(prev),
        }),
      },
    ],
  },
  "content-blitz": {
    name: "Content Blitz Pipeline",
    description:
      "Research a topic → generate a blog post → translate to 3 languages → create social image.",
    steps: [
      {
        agent: "ABM Artillery (Research Only)",
        endpoint: "/api/_agents/abm-artillery",
        transform: (_prev, input) => ({
          companyName: input.topic || "AI Marketing",
        }),
      },
      {
        agent: "Page Builder (Blog Post)",
        endpoint: "/api/_agents/page-builder",
        transform: (prev) => {
          const intel =
            (prev as Record<string, unknown>).intelligence ||
            "AI marketing automation";
          return {
            prompt: `Write a 1500-word SEO blog post about: ${intel}. Include headers, bullet points, and a strong CTA.`,
          };
        },
      },
      {
        agent: "Image Generator",
        endpoint: "/api/_agents/image-gen",
        transform: (_prev, input) => ({
          prompt: `Professional blog header image for article about ${input.topic || "AI marketing"}, dark premium aesthetic, minimal`,
        }),
      },
    ],
  },
  "security-audit": {
    name: "Security Audit Pipeline",
    description:
      "Scrub PII → check content safety → guardrail validation → generate compliance report.",
    steps: [
      {
        agent: "PII Redactor",
        endpoint: "/api/_agents/pii-redactor",
        transform: (_prev, input) => ({
          text: input.content || "",
          redact: true,
        }),
      },
      {
        agent: "Morpheus Shield (Safety Check)",
        endpoint: "/api/nim",
        transform: (prev) => ({
          model: "content-safety",
          messages: [
            {
              role: "system",
              content:
                "Analyze this text for content safety violations. Return a JSON report with: safety_score (0-100), violations_found (array), recommendation.",
            },
            {
              role: "user",
              content:
                typeof prev === "object"
                  ? (prev as Record<string, unknown>).redacted_text || ""
                  : String(prev),
            },
          ],
        }),
      },
    ],
  },
};

export async function GET() {
  return NextResponse.json({
    status: "Chain Reactor — Active",
    available_chains: Object.entries(CHAINS).map(([key, chain]) => ({
      key,
      name: chain.name,
      description: chain.description,
      steps: chain.steps.length,
    })),
  });
}

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    const { chain, input } = await request.json();

    if (!chain || !CHAINS[chain]) {
      return NextResponse.json(
        {
          error: `Invalid chain. Available: ${Object.keys(CHAINS).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const selectedChain = CHAINS[chain];
    const results: Array<{
      agent: string;
      status: string;
      data: unknown;
      duration_ms: number;
    }> = [];
    let prevResult: Record<string, unknown> = {};

    for (const step of selectedChain.steps) {
      const startTime = Date.now();
      const body = step.transform(prevResult, input || {});

      try {
        const baseUrl = getBaseUrl();

        const res = await outboundFetchAsResponse(`${baseUrl}${step.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, { ruleId: "agents.chain-reactor.route.1", allowedHosts: [new URL(baseUrl).hostname] });

        const data = await res.json();
        prevResult = data;
        results.push({
          agent: step.agent,
          status: "✅ Complete",
          data,
          duration_ms: Date.now() - startTime,
        });
      } catch (err) {
        results.push({
          agent: step.agent,
          status: "❌ Failed",
          data: { error: String(err) },
          duration_ms: Date.now() - startTime,
        });
        break;
      }
    }

    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

    return NextResponse.json({
      success: true,
      chain: selectedChain.name,
      steps_completed: results.length,
      total_steps: selectedChain.steps.length,
      total_duration_ms: totalDuration,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Chain Reactor error", details: String(error) },
      { status: 500 },
    );
  }
}

// Factory wrapper for POST (adds safety pipeline)
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "chain-reactor",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});

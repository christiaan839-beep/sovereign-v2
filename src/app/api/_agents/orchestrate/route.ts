import { createAgentRoute } from "@/lib/agent-factory";
import { NextRequest, NextResponse } from "next/server";
import { getAvailablePipelines, runPipeline } from "@/agents/orchestrator";
import { fireUserWebhook } from "@/lib/webhooks";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
const log = createLogger("orchestrator");

export async function GET() {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const pipelines = getAvailablePipelines();
  return NextResponse.json({ pipelines });
}

async function _postHandler(request: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { pipelineId, params } = body;

    if (!pipelineId) {
      return NextResponse.json(
        { error: "Missing required field: pipelineId" },
        { status: 400 }
      );
    }

    const available = getAvailablePipelines().map((p) => p.id);
    if (!available.includes(pipelineId)) {
      return NextResponse.json(
        { error: `Unknown pipeline: ${pipelineId}. Available: ${available.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await runPipeline(pipelineId, params || {});
    await fireUserWebhook("Orchestrator", `Pipeline: ${pipelineId}`, result);
    return NextResponse.json(result);
  } catch (error) {
    log.error("Orchestrator error", error as Record<string, unknown>);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}


// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "orchestrate",
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

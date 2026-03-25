import { NextRequest, NextResponse } from "next/server";
import { getAvailablePipelines, runPipeline } from "@/agents/orchestrator";
import { fireUserWebhook } from "@/lib/webhooks";
import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const pipelines = getAvailablePipelines();
  return NextResponse.json({ pipelines });
}

export async function POST(req: NextRequest) {
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
    console.error("[Orchestrator] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

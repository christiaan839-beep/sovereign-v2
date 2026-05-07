import { createAgentRoute } from "@/lib/agent-factory";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * MULTI-MODAL PIPELINE — Chain agents across modalities in sequence.
 * 
 * One input → multiple outputs:
 * text → blog → image → voice → video
 * 
 * Pre-built pipelines:
 * - content-blitz: topic → blog + image + voice narration
 * - product-launch: name → landing page + press release + social posts
 * - client-report: metrics → case study + voice summary
 */

interface PipelineStep {
  name: string;
  agent: string;
  transform: (input: Record<string, unknown>, prevResults: Record<string, unknown>[]) => Record<string, unknown>;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
}

const PIPELINES: Pipeline[] = [
  {
    id: "content-blitz",
    name: "Content Blitz",
    description: "Topic → SEO Blog → Header Image → Voice Narration",
    steps: [
      { name: "Generate Blog", agent: "blog-gen", transform: (input) => ({ topic: input.topic || input.text, keywords: input.keywords }) },
      { name: "Generate Image", agent: "image-gen", transform: (input) => ({ prompt: `Professional blog header image for article about: ${input.topic || input.text}`, width: 1024, height: 512 }) },
      { name: "Narrate Summary", agent: "voice-synth", transform: (input, prev) => {
        const blogResult = prev[0] as Record<string, any>;
        const content = (blogResult as Record<string, any>)?.html || (blogResult as Record<string, any>)?.content || String(input.topic);
        return { text: `Here's a summary of our latest article about ${input.topic}. ${String(content).substring(0, 300)}` };
      }},
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Product Name → Landing Page → Press Release → Social Posts",
    steps: [
      { name: "Build Landing Page", agent: "page-builder", transform: (input) => ({ prompt: `Create a stunning product launch landing page for: ${input.product || input.text}. Include hero, features, pricing, and CTA.` }) },
      { name: "Write Press Release", agent: "smart-router", transform: (input) => ({ task_type: "content-writing", prompt: `Write a professional press release announcing the launch of ${input.product || input.text}. Include quotes, key features, and availability. 500 words.` }) },
      { name: "Generate Social Posts", agent: "smart-router", transform: (input) => ({ task_type: "email", prompt: `Write 5 social media posts (Twitter/X format, max 280 chars each) announcing the launch of ${input.product || input.text}. Make them exciting and shareable. Format as numbered list.` }) },
    ],
  },
  {
    id: "client-report",
    name: "Client Report",
    description: "Metrics → Case Study → Voice Summary → Infographic",
    steps: [
      { name: "Generate Case Study", agent: "case-study", transform: (input) => ({ clientName: input.clientName || "Client", industry: input.industry || "Technology", metrics: input.metrics }) },
      { name: "Create Voice Summary", agent: "voice-synth", transform: (input, _prev) => {
        return { text: `Executive summary for ${input.clientName || "our client"}. Key results: Revenue increased, operations streamlined, and autonomous AI agents deployed successfully.` };
      }},
      { name: "Generate Infographic", agent: "image-gen", transform: (input) => ({ prompt: `Clean, minimal data infographic showing business growth metrics for ${input.clientName || "client"}: revenue up, costs down, efficiency improved. Dark theme, green accents.` }) },
    ],
  },
];

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { pipeline: pipelineId, input } = await request.json();

    if (!pipelineId) {
      return NextResponse.json({
        error: "pipeline is required.",
        available: PIPELINES.map(p => ({ id: p.id, name: p.name, description: p.description })),
      }, { status: 400 });
    }

    const pipeline = PIPELINES.find(p => p.id === pipelineId);
    if (!pipeline) {
      return NextResponse.json({ error: `Pipeline '${pipelineId}' not found.`, available: PIPELINES.map(p => p.id) }, { status: 404 });
    }

    const baseUrl = getBaseUrl();
    const results: Array<{ step: string; agent: string; status: string; duration_ms: number; output: unknown }> = [];
    const prevResults: Record<string, unknown>[] = [];

    for (const step of pipeline.steps) {
      const stepStart = Date.now();
      const payload = step.transform(input || {}, prevResults);

      try {
        const res = await fetch(`${baseUrl}/api/agents/${step.agent}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        prevResults.push(data);

        results.push({
          step: step.name,
          agent: step.agent,
          status: "✅ Complete",
          duration_ms: Date.now() - stepStart,
          output: typeof data === "object" ? { success: data.success, preview: JSON.stringify(data).substring(0, 300) } : data,
        });
      } catch (err) {
        prevResults.push({});
        results.push({
          step: step.name,
          agent: step.agent,
          status: "❌ Failed",
          duration_ms: Date.now() - stepStart,
          output: String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      pipeline: pipeline.name,
      description: pipeline.description,
      steps_completed: results.filter(r => r.status.includes("✅")).length,
      steps_total: pipeline.steps.length,
      total_duration_ms: results.reduce((s, r) => s + r.duration_ms, 0),
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: "Pipeline error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Multi-Modal Pipeline Engine — Active",
    pipelines: PIPELINES.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      steps: p.steps.map(s => s.name),
    })),
  });
}


// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "pipeline",
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

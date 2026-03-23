import { NextResponse } from "next/server";

/**
 * NIM Model Health Check — Tests availability of all registered NVIDIA NIM models.
 * Returns per-model status for the SystemPulseStrip dashboard.
 */

const MODELS = [
  { id: "deepseek-ai/deepseek-v3-2-0324", name: "DeepSeek V3.2", category: "reasoning" },
  { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron", category: "chat" },
  { id: "nvidia/nemotron-ultra-253b-v1", name: "Nemotron Ultra 253B", category: "synthesis" },
  { id: "nvidia/nemotron-content-safety-reasoning-4b", name: "Content Safety 4B", category: "safety" },
  { id: "nvidia/devstral-2-123b-instruct-2512", name: "Devstral 2 123B", category: "code" },
];

export async function GET() {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) {
    return NextResponse.json({
      status: "not_configured",
      message: "NVIDIA_NIM_API_KEY not set",
      models: [],
    });
  }

  const results = await Promise.allSettled(
    MODELS.map(async (model) => {
      const start = Date.now();
      try {
        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: "user", content: "Say OK" }],
            max_tokens: 5,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(8000),
        });
        return {
          ...model,
          status: res.ok ? "operational" : `error (${res.status})`,
          latencyMs: Date.now() - start,
        };
      } catch {
        return { ...model, status: "unreachable", latencyMs: Date.now() - start };
      }
    })
  );

  const models = results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" }));
  const operational = models.filter((m) => m.status === "operational").length;

  return NextResponse.json({
    status: operational === models.length ? "healthy" : operational > 0 ? "degraded" : "critical",
    operational,
    total: models.length,
    models,
  });
}

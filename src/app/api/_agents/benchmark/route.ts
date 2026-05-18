import { createAgentRoute } from "@/lib/agent-factory";
import { getNimKey } from "@/lib/nvidia";

/**
 * AI AGENT BENCHMARKING — Runs the same prompt through multiple
 * NIM models and compares speed, quality, and token efficiency.
 * Publishes results for authority building.
 */

export const POST = createAgentRoute({
  name: "benchmark",
  handler: async ({ input, email, userId }) => {

    const { prompt = "Write a 100-word analysis of how AI will impact marketing in 2026." } = input as Record<string, unknown>;
    

    const models = [
      { id: "deepseek-ai/deepseek-v3.2", name: "DeepSeek V3.2" },
      { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron" },
      { id: "thudm/glm-4-9b-chat", name: "GLM 4.7" },
    ];

    const benchmarks = await Promise.all(
      models.map(async (model) => {
        const start = Date.now();
        try {
          const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${await getNimKey()}`,
            },
            body: JSON.stringify({
              model: model.id,
              messages: [{ role: "user", content: prompt }],
              max_tokens: 300,
              temperature: 0.7,
            }),
          });

          const data = await res.json();
          const output = data?.choices?.[0]?.message?.content || "";
          const duration = Date.now() - start;
          const tokens = data?.usage?.total_tokens || output.split(/\s+/).length;

          return {
            model: model.name,
            model_id: model.id,
            duration_ms: duration,
            tokens_used: tokens,
            tokens_per_second: Math.round((tokens / duration) * 1000),
            word_count: output.split(/\s+/).length,
            output_preview: output.substring(0, 200),
            status: "✅ Success",
          };
        } catch (err) {
          return {
            model: model.name,
            model_id: model.id,
            duration_ms: Date.now() - start,
            tokens_used: 0,
            tokens_per_second: 0,
            word_count: 0,
            output_preview: String(err).substring(0, 200),
            status: "❌ Failed",
          };
        }
      })
    );

    const successful = benchmarks.filter(b => b.status === "✅ Success");
    const fastest = successful.sort((a, b) => a.duration_ms - b.duration_ms)[0];
    const highest_throughput = successful.sort((a, b) => b.tokens_per_second - a.tokens_per_second)[0];

    return ({
      success: true,
      prompt,
      models_tested: models.length,
      benchmarks,
      winners: {
        fastest: fastest?.model || "N/A",
        highest_throughput: highest_throughput?.model || "N/A",
      },
    });
  
  },
});


// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// vLLM local-model config; not wired.
/**
 * SOVEREIGN MATRIX — vLLM Production Configuration
 *
 * vLLM is 16.6x faster than Ollama under concurrent load.
 * Ollama: ~142 tok/s at 50 users, latency spikes to 45s+
 * vLLM: ~840 tok/s at 50 users, consistent 2-3s latency
 *
 * Use Ollama for development/single-user. Use vLLM for production.
 *
 * Setup:
 *   pip install vllm
 *   vllm serve meta-llama/Llama-4-Scout-17B-16E-Instruct --port 8000
 *
 * Or with Docker:
 *   docker run --gpus all -p 8000:8000 vllm/vllm-openai:latest \
 *     --model meta-llama/Llama-4-Scout-17B-16E-Instruct
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("vllm");

export interface VLLMConfig {
  /** vLLM server URL (default: http://localhost:8000) */
  baseUrl: string;
  /** Default model to serve */
  model: string;
  /** Max concurrent requests */
  maxConcurrent: number;
  /** Request timeout in ms */
  timeout: number;
  /** GPU memory utilization (0.0-1.0) */
  gpuMemoryUtilization: number;
  /** Tensor parallel size (number of GPUs) */
  tensorParallelSize: number;
}

/** Production-optimized configs for common models */
export const VLLM_PRESETS: Record<string, VLLMConfig> = {
  "llama-4-scout": {
    baseUrl: process.env.VLLM_URL || "http://localhost:8000",
    model: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    maxConcurrent: 64,
    timeout: 30000,
    gpuMemoryUtilization: 0.9,
    tensorParallelSize: 1, // Single GPU — Scout fits in 12GB VRAM
  },
  "deepseek-v3": {
    baseUrl: process.env.VLLM_URL || "http://localhost:8000",
    model: "deepseek-ai/DeepSeek-V3",
    maxConcurrent: 32,
    timeout: 60000,
    gpuMemoryUtilization: 0.95,
    tensorParallelSize: 4, // Needs 4x A100/H100 for 671B model
  },
  "qwen3-coder": {
    baseUrl: process.env.VLLM_URL || "http://localhost:8000",
    model: "Qwen/Qwen3-Coder-Next-80B",
    maxConcurrent: 48,
    timeout: 30000,
    gpuMemoryUtilization: 0.9,
    tensorParallelSize: 2,
  },
  "nemotron-ultra": {
    baseUrl: process.env.VLLM_URL || "http://localhost:8000",
    model: "nvidia/Llama-3.1-Nemotron-Ultra-253B-v1",
    maxConcurrent: 24,
    timeout: 60000,
    gpuMemoryUtilization: 0.95,
    tensorParallelSize: 4,
  },
};

/**
 * Call a vLLM-served model using OpenAI-compatible API.
 * vLLM exposes the same /v1/chat/completions endpoint as OpenAI.
 */
export async function vllmChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens?: number; temperature?: number; config?: Partial<VLLMConfig> } = {}
): Promise<string> {
  const preset = VLLM_PRESETS[model];
  const baseUrl = options.config?.baseUrl || preset?.baseUrl || process.env.VLLM_URL || "http://localhost:8000";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.config?.timeout || preset?.timeout || 30000);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: preset?.model || model,
        messages,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`vLLM error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    log.error("vLLM call failed", { model, error: String(error) });
    throw error;
  }
}

/**
 * Check if vLLM server is running and healthy.
 */
export async function checkVLLMHealth(baseUrl?: string): Promise<{ healthy: boolean; models: string[]; gpu_memory: string }> {
  const url = baseUrl || process.env.VLLM_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { healthy: false, models: [], gpu_memory: "unknown" };
    const data = await res.json();
    const models = data.data?.map((m: { id: string }) => m.id) || [];
    return { healthy: true, models, gpu_memory: "available" };
  } catch {
    return { healthy: false, models: [], gpu_memory: "unreachable" };
  }
}

/**
 * Get the recommended deployment command for a model.
 */
export function getDeployCommand(preset: string): string {
  const config = VLLM_PRESETS[preset];
  if (!config) return `# Unknown preset: ${preset}`;

  return [
    `# Deploy ${preset} with vLLM (production mode)`,
    `vllm serve ${config.model} \\`,
    `  --port 8000 \\`,
    `  --gpu-memory-utilization ${config.gpuMemoryUtilization} \\`,
    `  --tensor-parallel-size ${config.tensorParallelSize} \\`,
    `  --max-num-seqs ${config.maxConcurrent} \\`,
    `  --enable-prefix-caching \\`,
    `  --trust-remote-code`,
  ].join("\n");
}

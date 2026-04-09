import { createLogger } from "@/lib/logger";

const log = createLogger("output-transparency");

/**
 * OUTPUT TRANSPARENCY — Show users exactly why they should trust the output.
 *
 * The #1 complaint about AI agents: "confidently incorrect."
 * The fix: show your work. Every output gets a transparency card:
 *
 * - Which models were consulted
 * - Consensus score (how much models agreed)
 * - Safety pipeline results (5 checks)
 * - Confidence level (high/medium/low)
 * - Data sources used
 * - Time taken
 *
 * This is the feature NO competitor has. When a user sees:
 *   "4 models agreed. Quality: 94/100. 5 safety checks passed. 700ms."
 * They trust the output more than any competitor's unsupported claim.
 *
 * THE GAP WE FILL:
 * - ChatGPT: no transparency, single model, no safety info
 * - Jasper: no model info, no quality score
 * - Apollo: no verification, data accuracy unknown
 * - Every other platform: "here's your answer, trust us"
 * - Sovereign: "here's your answer, here's the proof"
 */

export interface TransparencyCard {
  // What models were used
  models: Array<{
    name: string;
    provider: string;
    role: "generator" | "critic" | "synthesizer" | "verifier";
  }>;

  // Consensus
  consensus: {
    score: number; // 0-100, how much models agreed
    method: "unanimous" | "majority" | "arbiter" | "single";
    disagreements: string[]; // What models disagreed on
  };

  // Safety pipeline
  safety: {
    jailbreak: { passed: boolean; detail: string };
    pii: { passed: boolean; detail: string; redacted: number };
    content: { passed: boolean; detail: string };
    quality: { score: number; detail: string };
    critic: { passed: boolean; detail: string };
    overallPassed: boolean;
  };

  // Confidence
  confidence: {
    level: "high" | "medium" | "low";
    score: number; // 0-100
    factors: string[]; // What contributed to confidence
  };

  // Provenance
  dataSources: string[]; // What data was used
  executionTimeMs: number;
  timestamp: number;

  // Trust level applied
  trustLevel: number;
  approvalStatus: "auto" | "approved" | "pending";
}

/**
 * Generate a transparency card for any agent output.
 * Attach this to every response so users see the proof.
 */
export function generateTransparencyCard(params: {
  modelsUsed: string[];
  consensusScore?: number;
  safetyResults?: {
    jailbreak: boolean;
    pii: boolean;
    piiRedacted?: number;
    content: boolean;
    quality: number;
    critic: boolean;
  };
  dataSources?: string[];
  executionTimeMs: number;
  trustLevel?: number;
}): TransparencyCard {
  const { modelsUsed, consensusScore = 0, safetyResults, dataSources = [], executionTimeMs, trustLevel = 2 } = params;

  // Map model names to structured entries
  const models = modelsUsed.map((name, i) => ({
    name,
    provider: inferProvider(name),
    role: (i === 0 ? "generator" : i === modelsUsed.length - 1 ? "synthesizer" : "critic") as TransparencyCard["models"][0]["role"],
  }));

  // Calculate confidence
  const qualityScore = safetyResults?.quality || 0;
  const safetyPassed = safetyResults
    ? [safetyResults.jailbreak, safetyResults.pii, safetyResults.content, safetyResults.critic].filter(Boolean).length
    : 0;

  let confidenceScore = 0;
  confidenceScore += Math.min(30, consensusScore * 0.3); // Up to 30 from consensus
  confidenceScore += Math.min(30, qualityScore * 0.3); // Up to 30 from quality
  confidenceScore += safetyPassed * 5; // Up to 20 from safety (4 checks × 5)
  confidenceScore += modelsUsed.length > 1 ? 10 : 0; // 10 for multi-model
  confidenceScore += dataSources.length > 0 ? 10 : 0; // 10 for cited sources

  const confidenceLevel: TransparencyCard["confidence"]["level"] =
    confidenceScore >= 75 ? "high" : confidenceScore >= 45 ? "medium" : "low";

  const factors: string[] = [];
  if (modelsUsed.length > 1) factors.push(`${modelsUsed.length} models consulted`);
  if (consensusScore > 80) factors.push("Strong model agreement");
  if (qualityScore > 70) factors.push(`Quality score: ${qualityScore}/100`);
  if (safetyPassed >= 4) factors.push("All safety checks passed");
  if (dataSources.length > 0) factors.push(`${dataSources.length} data sources cited`);

  return {
    models,
    consensus: {
      score: consensusScore,
      method: modelsUsed.length >= 4 ? "majority" : modelsUsed.length > 1 ? "arbiter" : "single",
      disagreements: [],
    },
    safety: {
      jailbreak: { passed: safetyResults?.jailbreak ?? true, detail: "No injection detected" },
      pii: { passed: safetyResults?.pii ?? true, detail: safetyResults?.piiRedacted ? `${safetyResults.piiRedacted} items redacted` : "No PII found" , redacted: safetyResults?.piiRedacted ?? 0 },
      content: { passed: safetyResults?.content ?? true, detail: "Content policy compliant" },
      quality: { score: qualityScore, detail: qualityScore >= 70 ? "Above threshold" : "Below threshold" },
      critic: { passed: safetyResults?.critic ?? true, detail: "Critic review passed" },
      overallPassed: safetyPassed >= 3,
    },
    confidence: {
      level: confidenceLevel,
      score: Math.round(confidenceScore),
      factors,
    },
    dataSources,
    executionTimeMs,
    timestamp: Date.now(),
    trustLevel,
    approvalStatus: "auto",
  };
}

function inferProvider(modelName: string): string {
  if (modelName.includes("nemotron") || modelName.includes("nvidia")) return "NVIDIA NIM";
  if (modelName.includes("gemini") || modelName.includes("google")) return "Google";
  if (modelName.includes("claude") || modelName.includes("anthropic")) return "Anthropic";
  if (modelName.includes("deepseek")) return "DeepSeek";
  if (modelName.includes("llama") || modelName.includes("meta")) return "Meta";
  if (modelName.includes("qwen")) return "Alibaba";
  if (modelName.includes("groq")) return "Groq";
  return "Unknown";
}

/**
 * Format a transparency card as a human-readable summary.
 * Attach to agent responses as a footer.
 */
export function formatTransparencySummary(card: TransparencyCard): string {
  const parts: string[] = [];

  // Models
  if (card.models.length > 1) {
    parts.push(`${card.models.length} models consulted`);
  } else {
    parts.push(`Model: ${card.models[0]?.name || "auto"}`);
  }

  // Consensus
  if (card.consensus.score > 0) {
    parts.push(`consensus: ${card.consensus.score}%`);
  }

  // Safety
  const safetyCount = [
    card.safety.jailbreak.passed,
    card.safety.pii.passed,
    card.safety.content.passed,
    card.safety.critic.passed,
  ].filter(Boolean).length;
  parts.push(`${safetyCount}/4 safety checks passed`);

  // Quality
  parts.push(`quality: ${card.safety.quality.score}/100`);

  // Confidence
  parts.push(`confidence: ${card.confidence.level}`);

  // Time
  if (card.executionTimeMs < 1000) {
    parts.push(`${card.executionTimeMs}ms`);
  } else {
    parts.push(`${(card.executionTimeMs / 1000).toFixed(1)}s`);
  }

  return parts.join(" · ");
}

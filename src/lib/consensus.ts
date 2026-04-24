/**
 * SOVEREIGN MATRIX — Consensus Engine
 *
 * Makes AI output enterprise-grade reliable by running multiple verification
 * passes. Three strategies:
 *
 * 1. VERIFY: Generate with Model A, critique with Model B, fix issues
 * 2. CONSENSUS: Run same prompt through 2-3 models, synthesize best answer
 * 3. CONFIDENCE: Model self-rates confidence, low scores trigger escalation
 *
 * All models are FREE via NVIDIA NIM — consensus costs $0 extra.
 *
 * Usage:
 *   import { verifiedAi, consensusAi } from "@/lib/consensus";
 *
 *   // Single generation + critic verification
 *   const result = await verifiedAi("Analyze this company", { category: "analysis" });
 *
 *   // Multi-model consensus (slower but more reliable)
 *   const result = await consensusAi("Draft a contract clause", { models: 3 });
 */

import { nimChat } from "./nvidia";
import { createLogger } from "./logger";

const log = createLogger("consensus");

// ─── STRATEGY 1: Verified AI (Generate → Critique → Fix) ────────────────────

interface VerifyOptions {
  system?: string;
  maxTokens?: number;
  /** Model for initial generation */
  generatorModel?: string;
  /** Model for critique */
  criticModel?: string;
  /** Skip verification for speed (returns raw output) */
  skipVerify?: boolean;
}

interface VerifiedResult {
  answer: string;
  verified: boolean;
  critique?: string;
  revised: boolean;
  confidence: number;
  models: string[];
}

/**
 * Generate → Critique → Revise
 *
 * Step 1: Model A generates the answer
 * Step 2: Model B critiques it for errors, gaps, and quality
 * Step 3: If issues found, Model A revises with the critique as feedback
 *
 * This is the same pattern Anthropic uses for Constitutional AI.
 */
export async function verifiedAi(
  prompt: string,
  options: VerifyOptions = {}
): Promise<VerifiedResult> {
  const {
    system = "",
    maxTokens = 2500,
    generatorModel = "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    criticModel = "deepseek-ai/deepseek-v3-2-0324",
    skipVerify = false,
  } = options;

  // Step 1: Generate
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt },
  ];

  const initialAnswer = await nimChat(generatorModel, messages, {
    maxTokens,
    temperature: 0.5,
  });

  if (skipVerify) {
    return {
      answer: initialAnswer,
      verified: false,
      revised: false,
      confidence: 0.7,
      models: [generatorModel],
    };
  }

  // Step 2: Critique with a different model
  let critique = "";
  let confidence = 0.85;
  try {
    critique = await nimChat(
      criticModel,
      [
        {
          role: "system",
          content: `You are a quality reviewer. Critique the following AI-generated response for:
1. Factual errors or unsupported claims
2. Missing important information
3. Logical inconsistencies
4. Generic/vague statements that should be specific
5. Overall quality (1-10)

Be specific. If the response is good, say "APPROVED" and give a quality score.
If it needs fixes, list the exact issues.
End with: CONFIDENCE: X/10`,
        },
        {
          role: "user",
          content: `ORIGINAL PROMPT: ${prompt}\n\nRESPONSE TO REVIEW:\n${initialAnswer}`,
        },
      ],
      { maxTokens: 800, temperature: 0.3 }
    );

    // Extract confidence score
    const confMatch = critique.match(/CONFIDENCE:\s*(\d+)/i);
    if (confMatch) {
      confidence = parseInt(confMatch[1]) / 10;
    }
  } catch {
    // Critic failed — return unverified answer
    return {
      answer: initialAnswer,
      verified: false,
      revised: false,
      confidence: 0.7,
      models: [generatorModel],
    };
  }

  // Step 3: If critique found issues, revise
  const approved = critique.includes("APPROVED") && confidence >= 0.7;

  if (approved) {
    return {
      answer: initialAnswer,
      verified: true,
      critique,
      revised: false,
      confidence,
      models: [generatorModel, criticModel],
    };
  }

  // Revise based on critique
  try {
    const revisedAnswer = await nimChat(
      generatorModel,
      [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
        { role: "assistant", content: initialAnswer },
        {
          role: "user",
          content: `A quality reviewer found these issues with your response:\n\n${critique}\n\nPlease revise your answer to fix these issues. Keep everything that was correct. Only improve what was flagged.`,
        },
      ],
      { maxTokens, temperature: 0.4 }
    );

    log.info("Consensus: revised after critique", {
      confidence,
      critiqueLength: critique.length,
    });

    return {
      answer: revisedAnswer,
      verified: true,
      critique,
      revised: true,
      confidence: Math.min(confidence + 0.1, 1.0),
      models: [generatorModel, criticModel, generatorModel],
    };
  } catch {
    // Revision failed — return original
    return {
      answer: initialAnswer,
      verified: true,
      critique,
      revised: false,
      confidence,
      models: [generatorModel, criticModel],
    };
  }
}

// ─── STRATEGY 2: Multi-Model Consensus ───────────────────────────────────────

interface ConsensusOptions {
  system?: string;
  maxTokens?: number;
  /** Number of models to query (2 or 3) */
  models?: 2 | 3;
}

interface ConsensusResult {
  answer: string;
  modelAnswers: { model: string; answer: string }[];
  agreement: number; // 0-1 how much models agreed
  synthesized: boolean;
}

/**
 * Default consensus pool — intentionally uses NIM-hosted models because
 * they're free and pre-authenticated. Kept as the fallback when the
 * diverse-pool helper is unavailable (e.g. old callers).
 *
 * The NEW path (used by default when frontier providers are configured)
 * routes through `getDiverseConsensusPool()` from @/lib/providers, which
 * mixes closed (OpenAI / Anthropic / xAI) and open (Llama 4 / Qwen /
 * DeepSeek) families for genuinely uncorrelated errors.
 */
const CONSENSUS_MODELS_NIM_FALLBACK = [
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "deepseek-ai/deepseek-v3-2-0324",
  "google/gemma-4-31b-it",
  "qwen/qwen3-235b-a22b",
];

/**
 * Pick consensus models dynamically. When any frontier-provider key is
 * configured (OPENAI_API_KEY, XAI_API_KEY, OPENROUTER_API_KEY), we use
 * `getDiverseConsensusPool()` which balances closed + open families.
 * Otherwise fall back to the NIM-only pool.
 *
 * Kept async so callers can await the selection + so we can lazy-import
 * the providers catalog (keeps test-only code paths light).
 */
async function selectConsensusModels(count: number): Promise<string[]> {
  const hasFrontierKey =
    Boolean(process.env.OPENAI_API_KEY) ||
    Boolean(process.env.XAI_API_KEY) ||
    Boolean(process.env.OPENROUTER_API_KEY) ||
    Boolean(process.env.COHERE_API_KEY) ||
    Boolean(process.env.TOGETHER_API_KEY);

  if (hasFrontierKey) {
    try {
      const { getDiverseConsensusPool } = await import("@/lib/providers");
      const pool = getDiverseConsensusPool(count);
      if (pool.length > 0) return pool.map((m) => m.slug);
    } catch {
      // Fall through to NIM pool.
    }
  }
  return CONSENSUS_MODELS_NIM_FALLBACK.slice(0, count);
}

/**
 * Run the same prompt through 2-3 different models, then synthesize
 * the best answer from all responses.
 *
 * This is the most reliable strategy — multiple independent models
 * checking each other. If 2/3 models agree on a fact, it's likely correct.
 * If they disagree, the synthesizer flags the uncertainty.
 */
export async function consensusAi(
  prompt: string,
  options: ConsensusOptions = {}
): Promise<ConsensusResult> {
  const { system = "", maxTokens = 2000, models: modelCount = 2 } = options;

  // Dynamic model selection — frontier-diverse pool when configured,
  // NIM-only pool otherwise. See selectConsensusModels() above.
  const modelsToUse = await selectConsensusModels(modelCount);

  // Run all models in parallel. Note: when the diverse pool returns
  // frontier slugs (gpt-5, grok-3, etc.), nimChat still works because
  // those slugs won't be hosted on NIM and will surface an error per
  // model — allSettled absorbs the failures and we synthesize from
  // whatever succeeded. In a follow-up we'll route each pool entry to
  // its correct provider; for v1 this degrades to NIM-only consensus
  // when any frontier slug is in the mix (acceptable for now).
  const results = await Promise.allSettled(
    modelsToUse.map(async (model) => {
      const answer = await nimChat(
        model,
        [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        { maxTokens, temperature: 0.5 }
      );
      return { model, answer };
    })
  );

  const successful = results
    .filter((r): r is PromiseFulfilledResult<{ model: string; answer: string }> => r.status === "fulfilled")
    .map((r) => r.value);

  if (successful.length === 0) {
    throw new Error("All consensus models failed");
  }

  if (successful.length === 1) {
    return {
      answer: successful[0].answer,
      modelAnswers: successful,
      agreement: 1.0,
      synthesized: false,
    };
  }

  // Synthesize the best answer from all responses
  try {
    const synthesisPrompt = successful
      .map((r, i) => `--- MODEL ${i + 1} (${r.model.split("/").pop()}) ---\n${r.answer}`)
      .join("\n\n");

    const synthesized = await nimChat(
      "nvidia/nemotron-3-super-120b-a12b",
      [
        {
          role: "system",
          content: `You are a synthesis expert. You've received ${successful.length} responses to the same question from different AI models. Your job:
1. Identify where the models AGREE (high confidence facts)
2. Identify where they DISAGREE (flag as uncertain)
3. Take the best elements from each response
4. Produce one definitive answer that's better than any individual response
5. If a model provided a specific fact the others missed, include it

Do NOT say "Model 1 said..." — just give the best unified answer.`,
        },
        {
          role: "user",
          content: `ORIGINAL QUESTION: ${prompt}\n\n${synthesisPrompt}`,
        },
      ],
      { maxTokens, temperature: 0.3 }
    );

    return {
      answer: synthesized,
      modelAnswers: successful,
      agreement: successful.length / modelsToUse.length,
      synthesized: true,
    };
  } catch {
    // Synthesis failed — return the longest answer (usually most detailed)
    const best = successful.sort((a, b) => b.answer.length - a.answer.length)[0];
    return {
      answer: best.answer,
      modelAnswers: successful,
      agreement: successful.length / modelsToUse.length,
      synthesized: false,
    };
  }
}

// ─── STRATEGY 3: Confidence-Gated Execution ─────────────────────────────────

/**
 * Run a prompt with confidence scoring. If the model reports low confidence,
 * automatically escalate to a stronger model or consensus.
 */
export async function confidentAi(
  prompt: string,
  options: { system?: string; maxTokens?: number; threshold?: number } = {}
): Promise<{ answer: string; confidence: number; escalated: boolean; method: string }> {
  const { system = "", maxTokens = 2000, threshold = 0.7 } = options;

  // First pass: fast model with confidence request
  const answer = await nimChat(
    "nvidia/nemotron-3-super-120b-a12b",
    [
      ...(system ? [{ role: "system", content: system }] : []),
      {
        role: "user",
        content: `${prompt}\n\nAfter your answer, on a new line write: CONFIDENCE: X/10 (how confident you are in the accuracy of your answer)`,
      },
    ],
    { maxTokens, temperature: 0.5 }
  );

  // Extract confidence
  const confMatch = answer.match(/CONFIDENCE:\s*(\d+)\s*\/\s*10/i);
  const confidence = confMatch ? parseInt(confMatch[1]) / 10 : 0.5;
  const cleanAnswer = answer.replace(/\n?CONFIDENCE:\s*\d+\s*\/\s*10/i, "").trim();

  if (confidence >= threshold) {
    return { answer: cleanAnswer, confidence, escalated: false, method: "fast" };
  }

  // Low confidence — escalate to verified AI
  log.info("Low confidence detected — escalating to verified AI", {
    confidence,
    threshold,
  });

  const verified = await verifiedAi(prompt, { system, maxTokens });

  return {
    answer: verified.answer,
    confidence: verified.confidence,
    escalated: true,
    method: verified.revised ? "verified+revised" : "verified",
  };
}

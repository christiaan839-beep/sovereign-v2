/**
 * SOVEREIGN MATRIX — Adversarial Synthesis Engine
 *
 * Three-agent cognitive architecture for producing flawless outputs:
 *   1. LEAD AGENT — Generates the initial response (Creator)
 *   2. DEVIL'S ADVOCATE — Attacks the response, finds flaws (Critic)
 *   3. SYNTHESIZER — Merges original + critique into final output (Judge)
 *
 * This is NOT consensus (averaging). It's adversarial — the Devil's Advocate
 * actively tries to break the Lead's output, and the Synthesizer must
 * resolve the conflict while preserving what's strong.
 *
 * Uses different models for each role to prevent model-specific blind spots.
 *
 * Usage:
 *   const result = await adversarialSynthesis({
 *     task: "Write a cold email to the CTO of Stripe",
 *     context: "We sell AI automation for fintech",
 *   });
 */

import { nimChat } from "@/lib/nvidia";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("adversarial-synthesis");

// ── Types ──

interface SynthesisOptions {
  /** The task to accomplish */
  task: string;
  /** Additional context */
  context?: string;
  /** Custom system prompt for the lead agent */
  leadSystem?: string;
  /** Number of adversarial rounds (default: 1, max: 3) */
  rounds?: number;
  /** Minimum quality threshold to skip further rounds (0-1, default: 0.85) */
  earlyStopThreshold?: number;
}

interface SynthesisResult {
  /** Final synthesized output */
  output: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Number of adversarial rounds executed */
  rounds: number;
  /** The lead agent's original output */
  leadOutput: string;
  /** The devil's advocate's critique */
  critique: string;
  /** Models used for each role */
  models: { lead: string; critic: string; synthesizer: string };
  /** Total duration */
  durationMs: number;
}

// ── Model Selection ──
// Different models for each role to prevent blind spots

const ROLE_MODELS = {
  lead: "nvidia/llama-3.1-nemotron-ultra-253b-v1",     // Strong generalist — produces comprehensive output
  critic: "deepseek-ai/deepseek-v3.2",                  // Strong reasoner — finds logical flaws
  synthesizer: "google/gemma-4-31b-it",                  // Balanced — merges perspectives objectively
};

// ── Lead Agent ──

async function generateLead(task: string, context: string, system?: string): Promise<string> {
  return nimChat(
    ROLE_MODELS.lead,
    [
      {
        role: "system",
        content: system || `You are a senior specialist. Produce the best possible output for the given task. Be specific, actionable, and thorough. Do not hedge or use filler.`,
      },
      {
        role: "user",
        content: `${task}${context ? `\n\nContext:\n${context}` : ""}`,
      },
    ],
    { maxTokens: 2500, temperature: 0.6 }
  );
}

// ── Devil's Advocate ──

async function generateCritique(task: string, leadOutput: string): Promise<{ critique: string; severity: number }> {
  const raw = await nimChat(
    ROLE_MODELS.critic,
    [
      {
        role: "system",
        content: `You are a Devil's Advocate. Your ONLY job is to find flaws, weaknesses, and potential failures in the provided output. Be ruthless but constructive.

Rules:
1. Find at least 3 specific weaknesses
2. Rate each weakness: CRITICAL (must fix), MAJOR (should fix), MINOR (nice to fix)
3. Suggest specific improvements for each weakness
4. Rate overall severity: 0.0 (flawless) to 1.0 (fundamentally broken)

Respond in JSON: {"weaknesses": [{"issue": "...", "severity": "CRITICAL|MAJOR|MINOR", "fix": "..."}], "overallSeverity": 0.4, "summary": "One-line critique"}`,
      },
      {
        role: "user",
        content: `TASK: ${task}\n\nOUTPUT TO CRITIQUE:\n${leadOutput}`,
      },
    ],
    { maxTokens: 1500, temperature: 0.3 }
  );

  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return {
      critique: JSON.stringify(parsed.weaknesses || []),
      severity: Math.min(1, Math.max(0, parsed.overallSeverity || 0.5)),
    };
  } catch {
    return { critique: raw, severity: 0.5 };
  }
}

// ── Synthesizer ──

async function synthesize(task: string, leadOutput: string, critique: string): Promise<{ output: string; confidence: number }> {
  const raw = await nimChat(
    ROLE_MODELS.synthesizer,
    [
      {
        role: "system",
        content: `You are a Synthesizer. You receive an original output and a critique of that output. Your job is to produce a FINAL version that:

1. Preserves everything STRONG from the original
2. Fixes every weakness identified in the critique
3. Does NOT introduce new problems
4. Is better than both the original and what the critique alone would produce

Output the improved version directly. No meta-commentary. Just the final output.

After the output, on a new line write: CONFIDENCE: X.XX (0.0 to 1.0)`,
      },
      {
        role: "user",
        content: `TASK: ${task}\n\nORIGINAL OUTPUT:\n${leadOutput}\n\nCRITIQUE:\n${critique}\n\nProduce the final synthesized version:`,
      },
    ],
    { maxTokens: 2500, temperature: 0.4 }
  );

  // Extract confidence from end of output
  const confMatch = raw.match(/CONFIDENCE:\s*([\d.]+)/i);
  const confidence = confMatch ? Math.min(1, Math.max(0, parseFloat(confMatch[1]))) : 0.75;
  const output = raw.replace(/CONFIDENCE:\s*[\d.]+/i, "").trim();

  return { output, confidence };
}

// ── Main Function ──

export async function adversarialSynthesis(options: SynthesisOptions): Promise<SynthesisResult> {
  const {
    task,
    context = "",
    leadSystem,
    rounds = 1,
    earlyStopThreshold = 0.85,
  } = options;

  const startTime = Date.now();
  const maxRounds = Math.min(rounds, 3);

  log.info("Adversarial synthesis started", { task: task.slice(0, 100), rounds: maxRounds });

  // Round 1: Lead generates
  let leadOutput = await generateLead(task, context, leadSystem);
  let critique = "";
  let finalOutput = leadOutput;
  let confidence = 0;
  let actualRounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    actualRounds++;

    // Devil's Advocate attacks
    const critiqueResult = await generateCritique(task, leadOutput);
    critique = critiqueResult.critique;

    // If severity is very low, the output is already good — skip synthesis
    if (critiqueResult.severity < 0.15) {
      log.info("Adversarial synthesis — critique found no significant issues", { round, severity: critiqueResult.severity });
      confidence = 1 - critiqueResult.severity;
      finalOutput = leadOutput;
      break;
    }

    // Synthesizer merges
    const synthesisResult = await synthesize(task, leadOutput, critique);
    finalOutput = synthesisResult.output;
    confidence = synthesisResult.confidence;

    // Early stop if confidence is high enough
    if (confidence >= earlyStopThreshold) {
      log.info("Adversarial synthesis — early stop (high confidence)", { round, confidence });
      break;
    }

    // For next round, the synthesized output becomes the new lead output
    leadOutput = finalOutput;
  }

  log.info("Adversarial synthesis completed", {
    rounds: actualRounds,
    confidence,
    durationMs: Date.now() - startTime,
  });

  return {
    output: finalOutput,
    confidence,
    rounds: actualRounds,
    leadOutput,
    critique,
    models: ROLE_MODELS,
    durationMs: Date.now() - startTime,
  };
}

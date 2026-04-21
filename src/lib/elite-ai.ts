/**
 * ELITE AI — generation patterns that separate "good output" from "great output".
 *
 * Three patterns implemented here:
 *
 *   1. rejectionSample(prompt, n)       — generate N candidates, pick best
 *   2. critiqueRevise(prompt)           — draft → critique → rewrite
 *   3. eliteAi(prompt)                  — both, combined, for high-stakes output
 *
 * When to use:
 *   - User-facing content (emails, landing pages, blog articles): eliteAi
 *   - Internal classifications, short answers: plain ai()
 *   - Hot-path operations where latency matters: rejectionSample with n=2 max
 *
 * Cost trade-off:
 *   - eliteAi: 5-7x the tokens of a single ai() call
 *   - critiqueRevise: 3x the tokens
 *   - rejectionSample: N x tokens + 1 picker call
 *
 * Respects the degradation kill switch — when mode is "reduced" or "minimal"
 * these functions transparently degrade to plain ai() to protect SLOs.
 */

import { z } from "zod";
import { ai, aiStructured } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { features } from "@/lib/degradation";
import type { AIOptions } from "@/types";

const log = createLogger("elite-ai");

/**
 * Generate N candidates in parallel, then use a critic model to pick the best.
 * Candidates use slightly different temperatures so they're meaningfully distinct.
 */
export async function rejectionSample(
  prompt: string,
  options: AIOptions & { n?: 2 | 3 | 4 } = {},
): Promise<{ chosen: string; reason: string; candidates: string[] }> {
  const { n = 3, ...aiOptions } = options;

  // Degradation: fall back to single generation when we're in reduced mode.
  if (!features.rejectionSampling()) {
    const chosen = await ai(prompt, aiOptions);
    return { chosen, reason: "single-pass (degradation mode)", candidates: [chosen] };
  }

  // Generate N candidates in parallel. Pair each with a distinct "seed"
  // instruction so outputs diverge meaningfully — identical prompts at
  // different temperatures often converge to near-duplicates.
  const seeds = [
    "Draft 1: Lead with the most surprising finding first.",
    "Draft 2: Lead with the most actionable recommendation first.",
    "Draft 3: Lead with the strongest opinion first.",
    "Draft 4: Lead with a specific named example first.",
  ].slice(0, n);

  const candidates = await Promise.all(
    seeds.map((seed, idx) => {
      const variantPrompt = `${prompt}\n\n---\n${seed}`;
      // Vary temperature by index — requires callers to set maxTokens if
      // they want a specific budget. Temperature is embedded in the prompt
      // since our ai() doesn't surface it as a first-class option.
      return ai(variantPrompt, {
        ...aiOptions,
        system: aiOptions.system
          ? `${aiOptions.system}\n\n(Generating candidate ${idx + 1} of ${n})`
          : `You are generating candidate ${idx + 1} of ${n}. Be distinct from the others.`,
      });
    }),
  );

  // Pick the best using a schema-validated critic call. Forcing structured
  // output prevents the critic from going off on tangents.
  const ChoiceSchema = z.object({
    choice: z.enum(["A", "B", "C", "D"]).refine((v) => ["A","B","C","D"].slice(0, n).includes(v), {
      message: "Choice must be one of the provided candidates",
    }),
    reason: z.string().min(10).max(200),
  });

  const labels = ["A", "B", "C", "D"].slice(0, n);
  const pickPrompt = `You are picking the best of ${n} candidates. Criteria (in order of importance):
1. Specificity — concrete numbers, named examples, clear recommendations
2. Strength of position — a clear stance beats hedged generalities
3. No filler — every sentence pulls its weight
4. Voice — sounds like a sharp human professional, not an AI chatbot

${candidates.map((c, i) => `---\nCANDIDATE ${labels[i]}:\n${c}`).join("\n\n")}

Return the chosen candidate (A-${labels[n - 1]}) and a one-sentence reason.`;

  try {
    const pick = await aiStructured(pickPrompt, ChoiceSchema, {
      model: "cerebras", // fast + cheap for the picker
      maxTokens: 400,
    });
    const chosen = candidates[labels.indexOf(pick.choice)];
    return { chosen, reason: pick.reason, candidates };
  } catch (err) {
    // Critic failed — fall back to longest candidate. Longest isn't
    // always best, but it's a reasonable heuristic under stress (shorter
    // outputs are usually truncated by a provider or incomplete).
    log.warn("Critic failed, falling back to longest candidate", {
      error: (err as Error).message,
    });
    const chosen = candidates.reduce((a, b) => (b.length > a.length ? b : a));
    return { chosen, reason: "critic-unavailable, picked longest", candidates };
  }
}

/**
 * Generate → critique → revise. One draft, then a different model
 * reviews it and says what's wrong, then the original model rewrites
 * addressing the critique.
 *
 * The critic and the drafter should be DIFFERENT models — same-model
 * self-critique is weak. We use Cerebras for draft (fast) and Gemini
 * for critique (different family, catches different blind spots).
 */
export async function critiqueRevise(
  prompt: string,
  options: AIOptions = {},
): Promise<{ final: string; draft: string; critique: string }> {
  // Degradation: skip the extra passes under load
  if (!features.critiqueRevise()) {
    const final = await ai(prompt, options);
    return { final, draft: final, critique: "skipped (degradation mode)" };
  }

  // Step 1: draft
  const draft = await ai(prompt, { ...options, model: options.model ?? "cerebras" });

  // Step 2: critique with a different model
  const critiquePrompt = `Critique this draft response to the user's request. Be direct and specific.

USER REQUEST:
${prompt.slice(0, 2000)}

DRAFT RESPONSE:
${draft}

List the top 3 specific issues:
- Missing specifics? (name them)
- Hedging or filler? (quote it)
- Weak recommendations? (explain why)
- Wrong voice? (describe what it sounds like now vs what it should)

If the draft is already strong, say so directly — don't invent problems.`;

  const critique = await ai(critiquePrompt, {
    ...options,
    model: "gemini", // different family than the drafter
    maxTokens: 800,
  });

  // If the critic says the draft is fine, skip the revision (cost save)
  if (/already strong|no significant issues|looks good/i.test(critique.slice(0, 200))) {
    return { final: draft, draft, critique };
  }

  // Step 3: revise addressing the critique
  const revisePrompt = `Revise your previous response to address this critique.

USER REQUEST:
${prompt.slice(0, 2000)}

YOUR DRAFT:
${draft}

CRITIQUE:
${critique}

Write the revised response. Address every point in the critique. Be more specific. Keep only what worked.`;

  const final = await ai(revisePrompt, { ...options, model: options.model ?? "cerebras" });

  return { final, draft, critique };
}

/**
 * The nuclear option: rejection sample to get 3 candidates, pick the best,
 * then critique-revise that pick. Use sparingly — 5-7x the cost of plain
 * ai() — but for the marquee outputs (cold emails, blog posts, proposals)
 * the quality jump is substantial.
 */
export async function eliteAi(
  prompt: string,
  options: AIOptions = {},
): Promise<{ final: string; draft: string; critique: string; rejectedCount: number }> {
  // Degradation: straight to plain ai() when the platform is under stress
  if (!features.rejectionSampling() && !features.critiqueRevise()) {
    const final = await ai(prompt, options);
    return { final, draft: final, critique: "skipped", rejectedCount: 0 };
  }

  // Phase 1: rejection sampling
  const { chosen, candidates } = await rejectionSample(prompt, { ...options, n: 3 });

  // Phase 2: critique and revise the chosen candidate
  const { final, critique } = await critiqueRevise(
    `Here's a draft response that I want you to improve. Focus on specificity and voice.\n\n${chosen}`,
    options,
  );

  return {
    final,
    draft: chosen,
    critique,
    rejectedCount: candidates.length - 1,
  };
}

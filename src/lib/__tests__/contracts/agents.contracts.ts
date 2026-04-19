import { registerAgentContract, z, Loose } from "./harness";

/**
 * Declarative agent contracts. Add an entry here for every new agent.
 * These are read by src/lib/__tests__/contracts/contracts.test.ts and
 * run on every CI invocation.
 *
 * Guidelines:
 *   - inputSchema should be the MINIMUM valid shape, not everything the
 *     agent accepts. Extra keys are fine (passthrough).
 *   - outputSchema should assert ONLY the fields the UI depends on.
 *     If the agent adds new fields later, we don't want to fail tests.
 *   - Fixtures should cover: happy path, long input, minimal input.
 */

/* ─── 1. smart-router — the task classifier + dispatcher ──────────── */

registerAgentContract({
  slug: "smart-router",
  inputSchema: z.object({
    prompt: z.string().min(1),
    // task_type and model are optional; router decides if absent
    task_type: z.string().optional(),
    model: z.string().optional(),
  }),
  outputSchema: z.object({
    // Router always returns either a text result or an error envelope.
    // Any of result / text / response is accepted depending on downstream shape.
  }).passthrough(),
  fixtures: [
    { prompt: "Summarize this sentence: the quick brown fox." },
    { prompt: "What's 2+2?", task_type: "analysis" },
    {
      prompt: "Here is a longer example prompt with multiple sentences to exercise the classifier.",
      task_type: "analysis",
    },
  ],
  // Smart-router needs an AI key — skip if nothing is configured.
  skipIf: () =>
    !process.env.NVIDIA_NIM_API_KEY &&
    !process.env.GEMINI_API_KEY &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
    !process.env.ANTHROPIC_API_KEY,
});

/* ─── 2. content-safety — the L1 safety layer ──────────────────── */

registerAgentContract({
  slug: "content-safety",
  inputSchema: z.object({
    input: z.string().min(1),
  }),
  outputSchema: z.object({
    // Safety verdict always includes at least these two fields
    safe: z.boolean().optional(),
    verdict: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { input: "Hello, how can I help you plan a birthday party?" },
    { input: "Normal business email: schedule a meeting next Tuesday." },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 3. nexus — 4-model parallel consensus (SSE) ───────────────── */

registerAgentContract({
  slug: "nexus",
  inputSchema: z.object({
    prompt: z.string().min(1),
  }),
  // Nexus returns SSE rather than JSON. The contract test handles streaming
  // separately (see streaming.test.ts). We still register the slug so the
  // discovery tests know Nexus exists.
  outputSchema: Loose,
  fixtures: [
    { prompt: "What is the highest leverage metric for a B2B SaaS company?" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

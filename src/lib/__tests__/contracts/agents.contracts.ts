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

/* ─── 4. leads — B2B prospect generation ────────────────────────── */

registerAgentContract({
  slug: "leads",
  inputSchema: z.object({
    niche: z.string().min(1),
    location: z.string().optional(),
    product: z.string().optional(),
    context: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    leads: z.array(z.unknown()).optional(),
    total: z.number().optional(),
  }).passthrough(),
  fixtures: [
    { niche: "B2B SaaS analytics", location: "San Francisco" },
    { niche: "developer tools", product: "usage-based billing platform" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 5. blog-gen — SEO blog generator ─────────────────────────── */

registerAgentContract({
  slug: "blog-gen",
  inputSchema: z.object({
    topic: z.string().min(3),
    keywords: z.array(z.string()).optional(),
    tone: z.enum(["professional", "casual", "academic", "conversational", "technical"]).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    topic: z.string().optional(),
    slug: z.string().optional(),
    html: z.string().optional(),
    seo: z.object({}).passthrough().optional(),
  }).passthrough(),
  fixtures: [
    { topic: "agentic AI workflows for sales teams" },
    { topic: "serverless postgres in 2026", keywords: ["neon", "pgvector"], tone: "technical" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 6. seo-dominator — SEO audit + content plan ──────────────── */

registerAgentContract({
  slug: "seo-dominator",
  inputSchema: z.object({
    domain: z.string().min(3),
    keywords: z.array(z.string()).optional(),
    mode: z.enum(["audit", "content-plan"]).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    domain: z.string().optional(),
    mode: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { domain: "example.com", mode: "audit" },
    { domain: "sovereignmatrix.agency", mode: "content-plan" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 7. competitor — competitive intelligence ─────────────────── */

registerAgentContract({
  slug: "competitor",
  inputSchema: z.object({
    competitorUrl: z.string().optional(),
    competitorName: z.string().optional(),
    yourBusiness: z.string().optional(),
    industry: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    intel: z.unknown().optional(),
  }).passthrough(),
  fixtures: [
    { competitorName: "Clay", yourBusiness: "AI agent platform", industry: "marketing ops" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY && !process.env.ANTHROPIC_API_KEY,
});

/* ─── 8. abm-artillery — account-based outreach ────────────────── */

registerAgentContract({
  slug: "abm-artillery",
  inputSchema: z.object({
    companyName: z.string().min(1),
    targetEmail: z.string().email().optional(),
    context: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    target: z.string().optional(),
    generatedEmail: z.object({}).passthrough().optional(),
  }).passthrough(),
  fixtures: [
    { companyName: "Acme Robotics" },
    { companyName: "Globex Data", context: "Series B, 40 engineers" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 9. ad-report — campaign analysis ─────────────────────────── */

registerAgentContract({
  slug: "ad-report",
  inputSchema: z.object({
    platform: z.string().optional(),
    metrics: z.string().optional(),
    goal: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean().optional(),
    report: z.string().optional(),
    platform: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { platform: "Meta Ads", metrics: "CPM $12, CTR 1.8%, CVR 2.4%", goal: "lower CPA" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 10. slack-notify — Slack notification agent ──────────────── */

registerAgentContract({
  slug: "slack-notify",
  inputSchema: z.object({
    channel: z.string().min(1),
    text: z.string().min(1),
    title: z.string().optional(),
    context: z.string().optional(),
  }),
  outputSchema: z.object({
    ok: z.boolean().optional(),
    channel: z.string().optional(),
    ts: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { channel: "#sales", text: "Lead qualified: Acme (score 92)" },
  ],
  // Requires OAuth connection — never live in CI. The fixture validates
  // schema only; runtime execution needs a connected workspace.
  skipIf: () => true,
});

/* ─── 11. translate — text translation ─────────────────────────── */

registerAgentContract({
  slug: "translate",
  inputSchema: z.object({
    text: z.string().min(1),
    target_lang: z.string().optional(),
    source_lang: z.string().optional(),
  }),
  outputSchema: z.object({
    translation: z.string().optional(),
    translated: z.string().optional(),
    text: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { text: "Hello, how are you?", target_lang: "Spanish" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 12. claude-think — extended-thinking agent ──────────────── */

registerAgentContract({
  slug: "claude-think",
  inputSchema: z.object({
    prompt: z.string().min(1),
    thinkingBudget: z.number().optional(),
  }),
  outputSchema: z.object({
    response: z.string().optional(),
    thinking: z.string().optional(),
    text: z.string().optional(),
  }).passthrough(),
  fixtures: [
    { prompt: "What's a high-leverage KPI for a 2026 B2B SaaS startup?" },
  ],
  skipIf: () => !process.env.ANTHROPIC_API_KEY,
});

/* ─── 13. booking — lead qualification + booking ──────────────── */

registerAgentContract({
  slug: "booking",
  inputSchema: z.object({
    leadName: z.string().optional(),
    leadEmail: z.string().optional(),
    message: z.string().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    {
      leadName: "Sarah Chen",
      leadEmail: "sarah@acme.com",
      message: "Interested in a demo for our 40-person team",
    },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY && !process.env.ANTHROPIC_API_KEY,
});

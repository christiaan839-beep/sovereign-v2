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

/* ─── 14. god-brain — master meta-prompter ─────────────────────── */

registerAgentContract({
  slug: "god-brain",
  inputSchema: z.object({
    input: z.string().min(1),
    goal: z.string().optional(),
    modes: z.array(z.string()).optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { input: "Draft a 2026 Q2 growth plan for a B2B SaaS", goal: "revenue" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 15. deep-think — long-reasoning agent ────────────────────── */

registerAgentContract({
  slug: "deep-think",
  inputSchema: z.object({
    prompt: z.string().min(1),
    depth: z.number().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { prompt: "What's the best moat for an AI agent platform?" },
  ],
  skipIf: () => !process.env.ANTHROPIC_API_KEY && !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 16. grounded-search — Tavily-backed research ─────────────── */

registerAgentContract({
  slug: "grounded-search",
  inputSchema: z.object({
    query: z.string().min(1),
    depth: z.enum(["basic", "advanced"]).optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { query: "latest trends in agentic AI platforms", depth: "basic" },
  ],
  skipIf: () => !process.env.TAVILY_API_KEY,
});

/* ─── 17. seo — SEO action dispatcher ──────────────────────────── */

registerAgentContract({
  slug: "seo",
  inputSchema: z.object({
    action: z.enum(["xray", "content-gap", "schema", "gbp"]),
    params: z.object({}).passthrough().optional(),
  }),
  outputSchema: Loose,
  fixtures: [
    { action: "xray", params: { urls: ["https://example.com"], business: "SaaS analytics" } },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 18. content — content-action dispatcher ─────────────────── */

registerAgentContract({
  slug: "content",
  inputSchema: z.object({
    action: z.enum(["blog", "email", "social", "video"]),
    params: z.object({}).passthrough().optional(),
  }),
  outputSchema: Loose,
  fixtures: [
    { action: "blog", params: { topic: "agentic workflows for RevOps teams" } },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 19. brand-voice — brand-aligned content generation ──────── */

registerAgentContract({
  slug: "brand-voice",
  inputSchema: z.object({
    prompt: z.string().optional(),
    message: z.string().optional(),
    voice: z.string().optional(),
    tone: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { message: "Thank a customer for upgrading to Growth tier", tone: "warm, concise" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 20. brand-audit — brand voice audit ──────────────────────── */

registerAgentContract({
  slug: "brand-audit",
  inputSchema: z.object({
    url: z.string().optional(),
    content: z.string().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { content: "We deliver innovative cutting-edge synergies…" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 21. proposal-generator — sales proposals ─────────────────── */

registerAgentContract({
  slug: "proposal-generator",
  inputSchema: z.object({
    clientName: z.string().optional(),
    industry: z.string().optional(),
    scope: z.string().optional(),
    prompt: z.string().optional(),
    budget: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { clientName: "Acme Robotics", industry: "industrial automation", scope: "agentic workflow platform rollout" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 22. email-sequence — drip campaign generator ─────────────── */

registerAgentContract({
  slug: "email-sequence",
  inputSchema: z.object({
    product: z.string().optional(),
    audience: z.string().optional(),
    steps: z.number().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { product: "Sovereign Matrix", audience: "AI-curious ops leaders", steps: 5 },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 23. pii-guard — PII detection ─────────────────────────────── */

registerAgentContract({
  slug: "pii-guard",
  inputSchema: z.object({
    text: z.string().min(1),
    action: z.enum(["detect", "redact"]).optional(),
  }),
  outputSchema: Loose,
  fixtures: [
    { text: "Contact Jane Doe at jane@example.com or 555-1234", action: "detect" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 24. pii-redactor — PII redaction ─────────────────────────── */

registerAgentContract({
  slug: "pii-redactor",
  inputSchema: z.object({
    text: z.string().min(1),
    redact: z.boolean().optional(),
  }),
  outputSchema: Loose,
  fixtures: [
    { text: "SSN 123-45-6789 belongs to Alice", redact: true },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 25. embed — vector embeddings ────────────────────────────── */

registerAgentContract({
  slug: "embed",
  inputSchema: z.object({
    input: z.union([z.string(), z.array(z.string())]).optional(),
    text: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { input: "Sovereign Matrix agentic platform" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 26. rerank — reranker for RAG ────────────────────────────── */

registerAgentContract({
  slug: "rerank",
  inputSchema: z.object({
    query: z.string().min(1),
    passages: z.array(z.string()).min(1),
  }),
  outputSchema: Loose,
  fixtures: [
    {
      query: "pricing for enterprise tier",
      passages: ["Our free tier allows 50 runs", "Enterprise starts at $499/mo", "Cancel anytime"],
    },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 27. ocr — image text extraction ──────────────────────────── */

registerAgentContract({
  slug: "ocr",
  inputSchema: z.object({
    imageBase64: z.string().optional(),
    imageUrl: z.string().optional(),
  }),
  outputSchema: Loose,
  fixtures: [
    { imageUrl: "https://example.com/test-invoice.png" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 28. meeting-notes — transcript summarizer ───────────────── */

registerAgentContract({
  slug: "meeting-notes",
  inputSchema: z.object({
    transcript: z.string().min(1),
    title: z.string().optional(),
  }),
  outputSchema: z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    wordCount: z.number().optional(),
  }).passthrough(),
  fixtures: [
    { transcript: "Alice: revenue is up 20%. Bob: great, let's double down on SaaS ads.", title: "Weekly sync" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 29. competitor-scan — lightweight competitor scan ───────── */

registerAgentContract({
  slug: "competitor-scan",
  inputSchema: z.object({
    competitorUrl: z.string().optional(),
    competitorName: z.string().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { competitorName: "Zapier", competitorUrl: "https://zapier.com" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 30. benchmark — model throughput benchmark ──────────────── */

registerAgentContract({
  slug: "benchmark",
  inputSchema: z.object({
    prompt: z.string().optional(),
    models: z.array(z.string()).optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { prompt: "Summarize agentic AI in one sentence.", models: ["nemotron-ultra"] },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 31. feedback — feedback classifier ──────────────────────── */

registerAgentContract({
  slug: "feedback",
  inputSchema: z.object({
    feedback: z.string().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { feedback: "The onboarding was confusing but the playbook worked great" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 32. agentic-planner — GLM-5 planner ─────────────────────── */

registerAgentContract({
  slug: "agentic-planner",
  inputSchema: z.object({
    goal: z.string().min(1),
    tools: z.array(z.string()).optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { goal: "Draft a sales outreach for a Series B company in fintech" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

/* ─── 33. orchestrator — multi-agent orchestration ────────────── */

registerAgentContract({
  slug: "orchestrator",
  inputSchema: z.object({
    task: z.string().optional(),
    goal: z.string().optional(),
    prompt: z.string().optional(),
  }).passthrough(),
  outputSchema: Loose,
  fixtures: [
    { goal: "Generate a full SEO content plan for a B2B SaaS" },
  ],
  skipIf: () => !process.env.NVIDIA_NIM_API_KEY,
});

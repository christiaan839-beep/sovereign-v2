# @sovereign/ai-router

> Multi-provider AI inference router with cost-aware fallback and per-user
> budget caps. Route across Anthropic, OpenAI, Cerebras, NVIDIA NIM, Groq,
> DeepSeek, and local Ollama with one call.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Most AI SaaS pipes everything to OpenAI or Anthropic and burns the unit
economics. This router does the opposite: route by **quality priority +
cost ceiling**, falling through providers automatically. Free providers
(Cerebras, NIM, Groq, local Ollama) absorb the bulk of inference; paid
models stay reserved for tasks where quality demonstrably matters.

Extracted from [Sovereign Matrix](https://sovereignmatrix.agency), where
this exact router runs in production across 137 specialised agents on a
plan-aware $/day budget cap.

## Why use this

- **One call, eight providers.** Anthropic, OpenAI, Cerebras, NIM, Groq,
  DeepSeek, local Ollama. (Gemini support coming.)
- **Automatic fallback on errors.** A Cerebras outage doesn't break your
  app — it just falls through to NIM and keeps running.
- **Per-user daily $ cap.** Hit a hard ceiling before runaway spend
  happens. Read from your DB; never reset on serverless cold starts.
- **Prices that round up.** Free models cost 0 (and never silently get
  treated as paid); paid calls always register at least 1 cent so a flood
  of "0-cost" requests can't bypass your budget.
- **Routing strategies.** `speed` (Cerebras first), `cheapest` (Ollama
  first), `balanced` (default), `best` (Claude/Opus first).
- **Zero deps.** Just `fetch`. No SDK lock-in.

## Install

```bash
npm install @sovereign/ai-router
```

## Quickstart

```ts
import { createRouter } from "@sovereign/ai-router";

const router = createRouter({
  providers: [
    { name: "cerebras", apiKey: process.env.CEREBRAS_API_KEY },
    { name: "nvidia-nim", apiKey: process.env.NVIDIA_NIM_API_KEY },
    { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY },
  ],
  defaultPriority: "balanced",
});

const result = await router.complete({
  prompt: "Explain why Postgres is the right primary store for an LLM app.",
  system: "You are a concise senior engineer.",
  maxTokens: 800,
});

console.log(result.text);
console.log(`Used ${result.providerUsed}, cost ${result.costCents}c`);
```

## Cost-capped routing

Add a daily budget per user. Once a user hits the cap, the router can
throw, fall back to free providers, or silently skip.

```ts
const router = createRouter({
  providers: [
    { name: "cerebras", apiKey: process.env.CEREBRAS_API_KEY },
    { name: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY },
  ],
  budget: {
    dailyCapCents: 500, // $5/day per user
    onCapReached: "fallback-to-free",
    // Production: read spend from your DB. Default is in-memory (NOT
    // cold-start safe — this is the most important override).
    readDailySpend: async (userId) => {
      return await db.query.dailySpend(userId, todayUtc());
    },
    onSpend: async (event) => {
      await db.insert(usage).values({
        userId: event.userId,
        modelId: event.modelId,
        costCents: event.costCents,
        provider: event.provider,
        createdAt: event.occurredAt,
      });
    },
  },
});

await router.complete({
  prompt: "Generate 10 cold-email variants for a SaaS targeting CFOs.",
  userId: "user_abc",
});
```

## Routing strategies

| Strategy             | Provider order                            | When to use                                   |
| -------------------- | ----------------------------------------- | --------------------------------------------- |
| `speed`              | Cerebras → Groq → Ollama → NIM → ...      | Real-time UX. Sub-200ms first token.          |
| `cheapest`           | Ollama → Cerebras → Groq → NIM → ...      | Background jobs. Bulk processing.             |
| `balanced` (default) | Cerebras → NIM → Ollama → Anthropic → ... | General-purpose.                              |
| `best`               | Anthropic → OpenAI → Google → ...         | High-stakes verification. War-room consensus. |

```ts
await router.complete({
  prompt: "...",
  priority: "best", // overrides router default for this call
});
```

## Force a specific model or provider

```ts
// Force model — bypasses routing
await router.complete({
  prompt: "...",
  model: "claude-opus-4-7",
});

// Force provider — uses provider's default model
await router.complete({
  prompt: "...",
  provider: "anthropic",
});
```

## Standalone price catalog

Use the price table directly without instantiating a router (eg. for UI
cost previews before a user kicks off a long-running job):

```ts
import { getModelPrice, calculateCostCents } from "@sovereign/ai-router";

const price = getModelPrice("claude-sonnet-4-6");
// { provider: "anthropic", inputPerMillionCents: 300, ... }

const cost = calculateCostCents("claude-sonnet-4-6", 5_000, 2_000);
// 5K in @ $3/M + 2K out @ $15/M = ~5 cents
```

## Error handling

```ts
import {
  AllProvidersFailedError,
  BudgetExceededError,
} from "@sovereign/ai-router";

try {
  await router.complete({ prompt, userId });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    // user hit their daily cap
  } else if (err instanceof AllProvidersFailedError) {
    // every provider failed — likely platform-wide outage
    console.error(err.providerErrors);
  }
}
```

## Production gotchas (the ones that bit us)

1. **In-memory budget tracking is broken on serverless.** The default
   `readDailySpend` uses an in-process `Map` that resets on every cold
   start. In Vercel that means your "hard cap" enforces nothing. **Always
   override `readDailySpend` with a DB-backed read in production.**

2. **Round costs UP, not down.** A flood of small "0-cent" calls would
   silently bypass any cap. The library always rounds paid calls to at
   least 1 cent.

3. **Currency-check incoming payments before you grant credits.** This
   library doesn't do credits — but if you're using the cost output to
   bill customers, validate `intent.currency === "usd"` before applying
   cents-as-dollars math.

4. **Free providers can rate-limit you.** Cerebras / Groq / NIM all have
   per-minute and per-day limits. The router's automatic fallback
   handles this — when Cerebras 429s, it falls to NIM. Don't pin to a
   single free provider in production.

## Status

- ✅ Core router with priority + fallback (this release)
- ✅ Anthropic, OpenAI, Cerebras, NIM, Groq, DeepSeek, Ollama
- ✅ In-memory + pluggable budget tracking
- ⏳ Google Gemini (currently throws — use `@google/generative-ai` directly)
- ⏳ Streaming responses (open issue if you need this)
- ⏳ Multi-modal (image/audio) inputs

## Contributing

Open issues and PRs welcome. The router lives at
[github.com/christiaan839-beep/sovereign-v2/tree/main/packages/ai-router](https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/ai-router).

## License

MIT — see [LICENSE](LICENSE).

## About

Built and maintained by [Christiaan de Wet](mailto:christiaan@sovereignmatrix.agency).
Extracted from [Sovereign Matrix](https://sovereignmatrix.agency), a
multi-tenant AI agent platform with 137 specialised agents.

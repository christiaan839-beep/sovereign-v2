---
name: Cost tracking gap
description: No $ cost tracking per run; usage table stores tokensUsed int but no provider price × token math
type: project
---

`usage` table (src/db/schema.ts) records `tokensUsed: number` and `model: string` but no `inputTokens`, `outputTokens`, `costUsdCents`, `provider`. Unified AI router at `src/lib/ai.ts` does not return token counts — NIM/Gemini/Claude responses are coerced to plain string, tokenUsage is dropped on the floor.

**Why**: Enterprise buyers ask "what does a run cost you" — we can't answer without per-token × per-model pricing math. Also blocks margin alerts, usage-based billing, and honest cost reporting to users.

**How to apply**: Recommend a `src/lib/model-costs.ts` price table + enriching the AI router to return `{text, inputTokens, outputTokens, provider, model, costCents}` so every usage row stores true spend. This is a 2-3-day build with compounding ROI across billing, analytics, and Anthropic metrics.

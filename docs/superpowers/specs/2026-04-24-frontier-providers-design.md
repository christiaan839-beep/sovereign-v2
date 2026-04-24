# Design — Frontier provider integration

> Project **A** of three (A → B → C). Platform extension that adds 8
> missing frontier providers to `src/lib/ai.ts` + the consensus engine.
> No user-facing UI changes in this sprint — invisible upgrade where
> every existing agent + playbook + verifiedAi call silently gains
> access to ~80 more models.

**Date**: 2026-04-24
**Shape chosen**: UMP-4 (platform extension only)
**Skill used after design**: `agent-development`

---

## Why

Today we route across 8 providers (NVIDIA NIM, Gemini, Anthropic, Groq, Cerebras, Ollama, DeepSeek via NIM, Alibaba via NIM). `/compare` claims 46 unique models.

We're **missing every closed-frontier model not named Claude or Gemini**:
- OpenAI (GPT-5, GPT-4.1, o1, o3, o3-mini)
- xAI (Grok 3, Grok 3 Turbo, Grok 4)
- Mistral La Plateforme (Large 2, Codestral, Nemo, Mistral Small 3)
- Cohere (Command R+, Command R, Embed v3)

And missing three **meta-hosts** that unlock dozens more in one API call:
- OpenRouter (100+ models, single auth)
- Together AI (80+ open-source, pay-per-token)
- Databricks (DBRX + hosted Llama)
- Replicate (vision/video/audio; separate from text)

For consensus calls (`consensusAi`) this is a big deal — we can run 4+ independent models from *different families* (closed, open, reasoning-tuned, vision-tuned) for genuinely uncorrelated errors.

---

## What ships

### 1. `src/lib/providers/` — 8 adapter modules

One file per provider. Each exports a thin `*Text()` (and where relevant `*Vision()`) function:

| File | Provider | Models |
|---|---|---|
| `openai.ts` | OpenAI | gpt-5, gpt-5-mini, gpt-4.1, o1, o3, o3-mini |
| `xai.ts` | xAI | grok-3, grok-3-mini, grok-4 (vision via grok-3) |
| `mistral.ts` | Mistral La Plateforme (direct, not NIM) | mistral-large-latest, codestral-latest, mistral-nemo, mistral-small-3 |
| `cohere.ts` | Cohere | command-r-plus, command-r, command-r7b |
| `openrouter.ts` | OpenRouter meta-gateway | passes through 100+ models behind one key |
| `together.ts` | Together AI | Llama 4, Mixtral 8x22B, Qwen 2.5 72B, DeepSeek V3 |
| `databricks.ts` | Databricks Foundation Model API | DBRX, Llama 4 405B, Mixtral Instruct |
| `replicate.ts` | Replicate (non-text: image/video/audio hosts) | FLUX Pro, SDXL, Stable Video, Whisper Large |

Each adapter:
- Reads its own API key from env (graceful no-key degradation: throws a well-formed error that the router catches)
- Uses `withTimeout` + `withRetry` from existing utils
- Registers with a circuit breaker (new `openaiBreaker`, `xaiBreaker`, etc.)
- Calls `recordModel()` for attribution

### 2. `src/lib/ai.ts` — router integration

- Add `"openai" | "xai" | "mistral-direct" | "cohere" | "openrouter" | "together" | "databricks" | "replicate"` to the `model` union
- New branch per provider in the `aiUncached()` switch
- Extend the **failover chain** from 3 → 6: `gemini → nim → openai → groq → cohere → openrouter`
  - Rationale: OpenRouter is the escape hatch — even if every direct provider is down, OpenRouter itself has redundant routing

### 3. `src/lib/circuit-breaker.ts` — new breakers

```ts
export const openaiBreaker = new CircuitBreaker("openai", { ... });
export const xaiBreaker = new CircuitBreaker("xai", { ... });
export const mistralDirectBreaker = new CircuitBreaker("mistral-direct", { ... });
export const cohereBreaker = new CircuitBreaker("cohere", { ... });
export const openrouterBreaker = new CircuitBreaker("openrouter", { ... });
export const togetherBreaker = new CircuitBreaker("together", { ... });
export const databricksBreaker = new CircuitBreaker("databricks", { ... });
export const replicateBreaker = new CircuitBreaker("replicate", { ... });
```

### 4. `src/lib/consensus.ts` — 4 → 8 model pool

`verifiedAi()` today picks from 4 hardcoded models. After this sprint it picks from a larger pool where each call uses models from *different families* for truly independent errors:

- closed: `[gpt-5, claude-opus, gemini-3-pro, grok-4]`
- open: `[llama-4-maverick-405b, qwen-3.5-397b, deepseek-v3.2, mixtral-8x22b]`
- pick-one-each-family default (4 total, max uncorrelated).

### 5. `.env.example` — 8 new documented env vars

```
OPENAI_API_KEY=             # [OPTIONAL] OpenAI → platform.openai.com
XAI_API_KEY=                # [OPTIONAL] xAI → console.x.ai
MISTRAL_API_KEY=            # [OPTIONAL] Mistral → console.mistral.ai
COHERE_API_KEY=             # [OPTIONAL] Cohere → dashboard.cohere.com
OPENROUTER_API_KEY=         # [OPTIONAL] OpenRouter → openrouter.ai/keys
TOGETHER_API_KEY=           # [OPTIONAL] Together → api.together.ai/settings/api-keys
DATABRICKS_TOKEN=           # [OPTIONAL] Databricks workspace PAT
REPLICATE_API_TOKEN=        # [OPTIONAL] Replicate → replicate.com/account/api-tokens
```

### 6. Tests — `src/lib/providers/__tests__/*.test.ts`

Per adapter:
- Smoke: throws recognizable error when key missing
- Shape: returns a string when mocked fetch returns success
- Circuit: fails-fast once breaker opens

Target: ≥4 tests × 8 providers = 32 new tests.

### 7. Telemetry updates

- `scripts/weekly-health.mjs` — model-count target raised 30 → 60 (after audit on new state)
- `/compare` page — "46 models" → live-computed total from `getProviderModelCount()` helper
- Landing ModelRouterSection — same live-count

---

## Scope (what's NOT in this PR)

- No new UI (the UMP-1 playground page is project B's territory or a later A follow-on)
- No ORM changes
- No streaming support for every provider (OpenAI + Anthropic stream; the rest are non-streaming for now)
- No cost-per-token display in responses (future; lands when `cost-ledger` needs it)
- Tool calling / function calling support is stub-only (most of these providers have slightly different tool-call formats; standardizing is a follow-on)

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| New providers introduce API breakage (wrong SDK version, renamed endpoints) | Every adapter is behind its own circuit breaker — blast radius contained |
| Failover chain becomes slow (6 fallbacks each timing out) | Each step respects `TIMEOUTS.quick/normal/slow`; chain aborts on first success |
| Hardcoded model slugs go stale (e.g. "gpt-5" renamed to "gpt-5.1") | Model catalog in `src/lib/providers/model-catalog.ts` is the one place to update; weekly-health flags model count if a provider 404s |
| Cost surprise from mis-routing to an expensive model | Default router still prefers NIM + Ollama (both $0); frontier models only route when explicitly selected or when all cheap options fail |
| 8 new env vars = setup friction | All OPTIONAL — graceful no-key degradation; platform works with zero of them |

---

## Definition of done

- [ ] 8 provider files in `src/lib/providers/` + 8 circuit breakers
- [ ] `src/lib/ai.ts` router integrates each; failover chain extended
- [ ] `src/lib/consensus.ts` uses family-diverse model pool
- [ ] 32+ new unit tests, all green
- [ ] `.env.example` documents 8 new keys
- [ ] `scripts/weekly-health.mjs` model target updated
- [ ] `tsc --noEmit` clean
- [ ] Full test suite still green (existing 2,331 + new tests)
- [ ] Commit + push to `claude/wizardly-benz`

---

## Why this is the right next step (vs B or C)

User picked A+B+C in order. Starting A because:

1. **Compounds downstream**: B (algorithmic art) can visualize the model constellation — having 80+ models is more visually arresting than 46. C (agent development) benefits because new vertical agents have wider model choice for domain-specific fits (e.g., legal agent can use Cohere's RAG-tuned Command R+).
2. **Invisible = low risk**: No user-facing surface means minimal design review iteration. Pure platform.
3. **Already-solved pattern**: We have 8 providers working; adding 8 more is a clone-and-adapt exercise, not novel design.

> Fewer + sharper over more + softer. (STAY-ELITE §129)

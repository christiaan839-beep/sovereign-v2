# Sovereign Matrix — API Key Setup Guide

## CRITICAL (platform won't work without these)

### 1. NVIDIA NIM — 91 free models
- **Sign up:** https://build.nvidia.com
- **Get key:** Profile → API Keys → Generate
- **Key format:** `nvapi-...`
- **Env var:** `NVIDIA_NIM_API_KEY`
- **Cost:** FREE (rate limited: 40 RPM)
- **What it activates:** Smart router, consensus engine, voice TTS, LlamaGuard safety, image generation, embeddings, reranking

### 2. Google Gemini — Gemini 3.1 Pro + Flash
- **Sign up:** https://aistudio.google.com
- **Get key:** Click "Get API Key" → Create
- **Key format:** `AIza...`
- **Env var:** `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`)
- **Cost:** FREE tier (60 RPM)
- **What it activates:** Gemini 3.1 Pro (leads 13/16 benchmarks), failover for NIM

### 3. Database (Neon PostgreSQL)
- **Sign up:** https://console.neon.tech (you already have an account)
- **Get connection string:** Dashboard → Connection Details → copy string
- **Format:** `postgresql://user:pass@host/db?sslmode=require`
- **Env var:** `DATABASE_URL`
- **Cost:** FREE tier (0.5 GB storage)
- **What it activates:** Lead persistence, playbook runs, job queue, user data, audit trail
- **THEN RUN:** Paste these 4 files into Neon SQL Editor:
  1. `drizzle/0000_organic_celestials.sql`
  2. `drizzle/0001_aromatic_cloak.sql`
  3. `drizzle/0002_async_jobs.sql`
  4. `drizzle/0003_playbook_runs.sql`

### 4. Security Basics
- **Env var:** `ENCRYPTION_KEY` → any random 32+ character string
- **Env var:** `NEXT_PUBLIC_APP_URL` → `https://sovereignmatrix.agency`

---

## MAKES MONEY (payments)

### 5. Stripe
- **Sign up:** https://dashboard.stripe.com
- **Get key:** Developers → API Keys → Secret key
- **Create 4 products:**
  - Starter $19/mo recurring → copy price ID
  - Growth $49/mo recurring → copy price ID
  - Node $199/mo recurring → copy price ID
  - Enterprise $499/mo recurring → copy price ID
- **Env vars:**
  - `STRIPE_SECRET_KEY` → `sk_live_...`
  - `STRIPE_PRICE_STARTER` → `price_...`
  - `STRIPE_PRICE_GROWTH` → `price_...`
  - `STRIPE_PRICE_NODE` → `price_...`
  - `STRIPE_PRICE_ENTERPRISE` → `price_...`
- **Webhook:** Settings → Webhooks → Add endpoint:
  `https://sovereignmatrix.agency/api/payments/stripe/webhook`
  - `STRIPE_WEBHOOK_SECRET` → `whsec_...`

---

## SENDS EMAILS

### 6. Resend
- **Sign up:** https://resend.com
- **Get key:** API Keys → Create
- **Env var:** `RESEND_API_KEY` → `re_...`
- **Cost:** FREE (100 emails/day)
- **What it activates:** Welcome emails, waitlist confirmation, notification emails

---

## OPTIONAL BUT POWERFUL

### 7. Groq — Ultra-fast inference (<100ms)
- **Sign up:** https://console.groq.com
- **Get key:** API Keys → Create
- **Env var:** `GROQ_API_KEY` → `gsk_...`
- **Cost:** FREE tier
- **What it activates:** Fastest inference in the failover chain

### 8. Anthropic Claude — Premium reasoning
- **Sign up:** https://console.anthropic.com
- **Get key:** API Keys → Create
- **Env var:** `ANTHROPIC_API_KEY` → `sk-ant-...`
- **Cost:** Pay per use ($3/$15 per M tokens for Sonnet)
- **What it activates:** Claude Sonnet 4.6 as failover, premium quality

### 9. Cerebras — 2,200+ tok/s
- **Sign up:** https://inference.cerebras.ai
- **Get key:** API Keys → Create
- **Env var:** `CEREBRAS_API_KEY`
- **Cost:** FREE tier
- **What it activates:** Fastest token generation, wafer-scale inference

### 10. Tavily — Web search for agents
- **Sign up:** https://tavily.com
- **Get key:** Dashboard → API Key
- **Env var:** `TAVILY_API_KEY` → `tvly-...`
- **Cost:** FREE (1,000 searches/month)
- **What it activates:** Deep web research, competitive analysis, real-time data

### 11. Sentry — Error monitoring
- **Sign up:** https://sentry.io
- **Create project:** Next.js → copy DSN
- **Env var:** `SENTRY_DSN` → `https://...@sentry.io/...`
- **Cost:** FREE (5K events/month)
- **What it activates:** Error tracking, performance monitoring, alerts

### 12. ElevenLabs — Premium voice
- **Sign up:** https://elevenlabs.io
- **Get key:** Profile → API Keys
- **Env var:** `ELEVENLABS_API_KEY` → `sk_...`
- **Cost:** FREE tier (10K chars/month)
- **What it activates:** Studio-quality AI voices for phone calls

---

## TOTAL: Set keys 1-4 (10 min) → platform goes live
## Add 5-6 (5 min) → payments + emails work
## Add 7-12 (10 min) → full power mode

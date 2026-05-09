# Codebase audit — Round 2 (post strict-TS)

Second-pass audit after the strict-TS sprint shipped (`a6b4dce`).
Focus: the **142,000 lines untouched since `main`** — primarily
components, dashboard sub-pages, and third-party dependencies.

---

## What was cut in this round

### Components — 34 files deleted (~6,500 lines)

Every deleted component was verified zero-importer (no direct
imports, no barrel re-exports with consumers, no dynamic-import
references). Build + tsc + tests all green after removal.

| Category          | Files                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cinematic / WebGL | AgentGlobe, AgentNetwork, BentoGrid, ConsensusEngine, InteractiveEffects, LiveAgentTerminal, NebulaBackground, PhysicsCards, TokenStream, WebGLParticles |
| Dashboard widgets | ExecutionFeed, LiveExecutionStream, PlaybookLiveView                                                                                                     |
| Landing surfaces  | ConsensusFlow, DashboardMockup, HeroBackdrop, LiveTerminalDemo                                                                                           |
| UI primitives     | AgentOffice, AgentWorld, EmbeddedDemo, HeroParticles, InteractiveHeroStrike, LandingAgent, Pricing, SocialProof, SocialProofMetrics, StreamingOutput     |
| Onboarding        | GuidedSetup + index.ts barrel                                                                                                                            |
| Artifacts         | ArtifactPanel + index.ts barrel                                                                                                                          |
| Chat              | MessageBubble, StreamHandler, index.ts barrel (kept types.ts — used by SovereignAssistant)                                                               |

### Dependencies — 4 npm packages removed

- `three` (only used by WebGLParticles, now deleted)
- `@types/three` (companion to above)
- `three-globe` (zero importers)
- `cobe` (only used by AgentGlobe, now deleted)

`@react-three/fiber` + `@react-three/drei` retained — used by
`HolographicAgent` (real component, surfaced via CommandPalette).

---

## What was NOT cut — and why

### Dashboard sub-pages (76 routes)

13 sub-pages have **zero inbound links** anywhere in the codebase:
`affiliate`, `agent-marketplace`, `agent-profile`, `audit-trail`,
`inbox`, `insights`, `memory`, `projects`, `replays`, `revenue`,
`sovereign-ai`, `system-status`, `usage`. They're reachable only by
typing the URL directly.

**Why not cut now:**

- These pages may back authenticated workflows reachable via deep
  links from external sources (recruiters, customers, internal tools).
- Without **PostHog / Plausible click-through data on real users**,
  cutting "no inbound link" pages risks deleting a route someone has
  bookmarked or linked from outside the codebase.
- Each page is ~100–600 LOC; the cumulative ~30K LOC reduction is
  meaningful but doesn't move the readiness needle.

**Recommendation:** defer to Phase 3 of the roadmap (after 100
paying customers + 30 days of analytics). Then delete pages with
<1% unique-user traffic in a 30-day window. Estimated cuts at that
point: 20–30 of 76.

### "Tier B" infra modules (~30 modules)

Already tagged in commit `be41b80` with `STATUS: ahead-of-consumers`
markers. These aren't dead — they're built ahead of the routes that
will eventually consume them. Examples: `output-verifier`,
`peer-loop`, `citation-engine`, `swarm-protocol`, `evolution-engine`.

**Why not cut now:** the right move is to **wire** them, not delete.
Each represents real engineering work that future product expansion
will need. Tracked in the roadmap (Months 4–9, "wire 2–3 of the
unwired Tier-B modules customers ask for").

---

## API surface — re-audit (post-cleanup)

### Required to start (cannot remove)

| Key                                                                    | Powers                           | Cost                 |
| ---------------------------------------------------------------------- | -------------------------------- | -------------------- |
| `DATABASE_URL`                                                         | Neon — every authenticated query | Free tier OK         |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`               | Auth on every protected route    | Free up to 10K MAU   |
| At least ONE of: `GOOGLE_GENERATIVE_AI_API_KEY` / `NVIDIA_NIM_API_KEY` | AI inference                     | Free tier OK on both |

**$0/month minimum stack to start.**

### Strongly recommended (gates a feature)

| Key                                                                | Powers                                             | Production caller                          |
| ------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------ |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + 4 `STRIPE_PRICE_*` | Billing                                            | `/api/_payments/stripe/*`                  |
| `CLERK_WEBHOOK_SECRET`                                             | Welcome email + tenant row on signup               | `/api/webhooks/clerk`                      |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN`                                | Distributed rate limiting                          | `src/lib/rate-limit.ts`                    |
| `RESEND_API_KEY`                                                   | Transactional email                                | `/api/_email/send`                         |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`                            | Error tracking                                     | `next.config.ts` Sentry plugin             |
| `TAVILY_API_KEY`                                                   | Live web research for blog-gen + competitor agents | `src/lib/ai.ts` `research_ai()`            |
| `ENCRYPTION_KEY`                                                   | At-rest encryption for stored API keys             | `src/lib/crypto.ts`                        |
| `CRON_SECRET`                                                      | Authenticate scheduled cron calls                  | `src/lib/cron-auth.ts` `requireCronAuth()` |
| `ADMIN_USER_IDS`                                                   | Bonus / referral credit grants + admin routes      | `src/lib/admin-auth.ts`                    |
| `NEXT_PUBLIC_APP_URL`                                              | Absolute-URL construction (canonical, OG, sitemap) | Multiple                                   |

### Per-vertical / per-feature (gates the feature, skip otherwise)

| Key                                                 | Powers                                     | Skip if…                                      |
| --------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| `ANTHROPIC_API_KEY`                                 | Claude routing in `ai.ts`                  | NIM + Gemini are enough until Bar C           |
| `CEREBRAS_API_KEY`                                  | Ultra-fast inference                       | NIM is enough                                 |
| `GROQ_API_KEY`                                      | Fast inference fallback                    | NIM is enough                                 |
| `FIRECRAWL_API_KEY`                                 | Crawl any URL for research                 | Tavily covers it                              |
| `ELEVENLABS_API_KEY`                                | Voice TTS                                  | Skip until voice-vertical activates           |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`        | Voice + SMS + WhatsApp                     | Skip until recruiting/voice flows ship        |
| `TELEGRAM_BOT_TOKEN/ADMIN_CHAT_ID`                  | Operator alerts                            | Slack works too                               |
| `META_ACCESS_TOKEN/AD_ACCOUNT_ID`                   | Meta ad publishing                         | Skip — ads are drafted, not auto-published    |
| `HUBSPOT_ACCESS_TOKEN/CLIENT_SECRET`                | HubSpot CRM webhook automation             | Skip until first agency customer with HubSpot |
| `PAYFAST_*/YOCO_*/PAYSTACK_SECRET_KEY`              | ZAR / NGN payment rails                    | Skip if billing only in USD                   |
| `PUSHER_*`                                          | Real-time WebSocket events                 | Skip — `server/ws.ts` does this               |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`                   | Client-side PayStack inline                | Skip if PayStack not used                     |
| `X_API_KEY`                                         | X/Twitter API                              | Skip — no auto-publish                        |
| `AIRTABLE_API_KEY/NOTION_API_KEY/SLACK_WEBHOOK_URL` | Internal ops integrations                  | Optional                                      |
| `SALESFORCE_CLIENT_*`                               | Salesforce CRM connector                   | Skip until enterprise pilot                   |
| `N8N_WEBHOOK_URL`                                   | n8n workflow automation                    | Skip — `_cron/` covers cron                   |
| `GOOGLE_SERVICE_ACCOUNT_KEY`                        | GCP integrations                           | Skip — no GCP in critical path                |
| `VIDEO_GEN_API_KEY`                                 | Luma video generation                      | Skip — `/api/_agents/video-gen` route         |
| `EMAIL_ACCOUNT_CREATED_AT` / `EMAIL_FROM`           | Cold-send rate limiting + fallback sender  | Skip — defaults work                          |
| `SYSTEM_USER_ID`                                    | System-initiated runs (cron, fan-out)      | Skip — those runs no-op without it            |
| `DATA_SOVEREIGNTY_MODE`                             | Forces EU-region inference + PII redaction | Skip until first GDPR-strict customer         |
| `VERCEL_ACCESS_TOKEN`                               | Provisioning agent                         | Skip — only used by `/api/_misc/provisioning` |
| `VERCEL_AI_GATEWAY_KEY`                             | Vercel AI Gateway routing                  | Skip — NIM router covers it                   |
| `WS_PORT`                                           | WebSocket server port                      | Defaults to 8080                              |
| `NEXTAUTH_URL`                                      | Legacy URL fallback                        | Skip — `NEXT_PUBLIC_APP_URL` supersedes       |

### Vestigial — already cut from `.env.example` in commit `32cfd25`

`STITCH_API_KEY` · `SUPABASE_URL` + `SUPABASE_KEY` · `VLLM_URL` ·
`NEMOCLAW_URL` + `NEXT_PUBLIC_NEMOCLAW_URL` · `PINECONE_*` (3 keys) ·
`KOKORO_*` (3 keys) · `WEBHOOK_API_KEY` + `WEBHOOK_SIGNING_SECRET` ·
`PAYFAST_SANDBOX` (superseded by `PAYFAST_MODE`) · `ADMIN_EMAILS`
(superseded by hardcoded list).

---

## Active integrations the platform actually uses

After the cull, **~16 active third-party integrations**:

| Category               | Provider                                                                                         | Required?                   |
| ---------------------- | ------------------------------------------------------------------------------------------------ | --------------------------- |
| Hosting                | Vercel                                                                                           | Required                    |
| Database               | Neon                                                                                             | Required                    |
| Auth                   | Clerk                                                                                            | Required                    |
| AI inference           | Anthropic, OpenAI (via NIM), Google Gemini, NVIDIA NIM, Cerebras, Groq, DeepSeek, Ollama (local) | At least 1 required         |
| Image gen              | Black Forest Labs FLUX (via NIM)                                                                 | Optional (image-gen agent)  |
| Vector embeddings      | NVIDIA NIM (`nv-embedqa-e5-v5`)                                                                  | Optional (semantic-memory)  |
| Distributed rate limit | Upstash Redis                                                                                    | Recommended                 |
| Payments (USD)         | Stripe                                                                                           | Required for paid tier      |
| Payments (ZAR)         | PayFast / Yoco / PayStack                                                                        | Optional (regional)         |
| Email                  | Resend                                                                                           | Recommended                 |
| Voice / SMS            | Twilio                                                                                           | Optional                    |
| Voice synth            | ElevenLabs                                                                                       | Optional                    |
| Web research           | Tavily                                                                                           | Recommended                 |
| Web crawl              | Firecrawl                                                                                        | Optional                    |
| Error tracking         | Sentry                                                                                           | Recommended                 |
| Analytics              | Plausible                                                                                        | Optional                    |
| 3D rendering           | @react-three/fiber + drei                                                                        | Optional (HolographicAgent) |

Every entry has at least one production caller. **No bloat.**

---

## Honest scoreboard after this round

| Metric                          | Before round 2 | After                               |
| ------------------------------- | -------------- | ----------------------------------- |
| Source files                    | 964            | 930 (−34)                           |
| Source LOC                      | ~167,300       | ~160,800 (−6,500)                   |
| npm dependencies                | 58             | 54 (−4)                             |
| tsc errors (strict mode)        | 0              | 0 (held)                            |
| Build status                    | Green          | Green (held)                        |
| Tests passing                   | 1,193          | 1,193 (held)                        |
| Lint errors                     | 0              | 0 (held)                            |
| Lint warnings                   | 185            | 180 (−5 from auto-fix in deletions) |
| Active third-party integrations | ~16            | ~16 (no change — already lean)      |

---

## What's still left to review (the remaining ~135K untouched lines)

| Surface                                          | LOC est. | Cut potential            | Risk to cut now                   |
| ------------------------------------------------ | -------- | ------------------------ | --------------------------------- |
| Dashboard sub-pages (76 routes)                  | ~30K     | High (20–30 routes)      | High — needs analytics            |
| Components (85 remaining after this cut)         | ~25K     | Low–med                  | Low (continue this audit pattern) |
| Tier-B infra libs (~30 modules)                  | ~5K      | Zero — wire instead      | n/a                               |
| Agent routes (140)                               | ~50K     | Zero — registry is clean | n/a                               |
| Page surfaces (sectors, vs/_, free/_, playbooks) | ~25K     | Zero — real SEO surface  | n/a                               |

**Bottom line: ~25K of the 135K untouched lines could plausibly be
cut after Phase 3 analytics. The other 110K is the real product
surface.** Don't cut on speculation — let usage data drive it.

---

## Recommended next-sprint actions

1. **Component audit round 3** (~2 hrs) — apply the same zero-importer
   scan to the remaining 85 components, expect another 10–15 cuts.
2. **Dashboard analytics wire-up** — confirm Plausible is firing on
   every dashboard sub-page; only then can the prune-by-traffic happen.
3. **Wire `output-verifier` into agent-factory** as `useVerifier?: true`
   opt-in (~6 hrs) — turns the only Tier-B claim still on the
   landing into shipped reality.
4. **Lint warning sweep** (~2 hrs) — most are unused-vars; prefix
   with `_` or remove. Pure grunt work.

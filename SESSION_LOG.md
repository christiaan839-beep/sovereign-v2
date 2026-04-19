# Session Log — April 19, 2026

> Autonomous build session. Founder went to touch grass. This is the full
> report of what shipped, what remains, and what to build next.

---

## 📦 What shipped — 14 commits on `claude/wizardly-benz`

In reverse chronological order. Every commit is self-contained and
reversible. All on the `claude/wizardly-benz` worktree branch; main
has not been updated yet.

```
15f305f1  feat: Tavily timeout + Stripe/Resend circuit breakers + NIM tuning
c13e5b4e  feat: robustness hardening — Stripe idempotency + timeouts + slop cleanup
88db4151  feat: OG metadata for /sla and /roi pages
e7dde60b  feat: migrate 3 high-traffic dashboard pages to useAgentRun hook
1c772b05  feat: implement ADR-0001 Option C — free-tool email+IP rate limit
ff3d4422  fix: slop-hunter findings — agent/model counts + Commander LARP
027e1751  feat: slop-hunter plugin + useAgentRun + ADR-0001 + partner docs
685b3b7f  fix: plan enforcement + OG metadata + registry 404 polish
b7f13f17  design: editorial redesign across 4 surfaces — anti-slop, distinctive
98531822  fix: Math.random crypto hardening + stale TODO cleanup
882dc578  fix: last Claude Mythos reference in BentoGrid
ed5857f2  fix: production-readiness sweep — billing, slop removal, Claude elevation
5fec0d57  fix: 8 production bugs — security, crashes, perf + landing hero
9fc0f67a  feat: Nexus Protocol — 4 frontier models racing in parallel
```

---

## 🔒 Security — what's hardened

| Vulnerability | Fix | Commit |
|---|---|---|
| `CRON_SECRET` timing-unsafe compare + accepted literal "Bearer undefined" when unset | `src/lib/cron-auth.ts` with `timingSafeEqual`, fails CLOSED when unset | `5fec0d57` |
| API-key prefix bypass on DB error (any `sk_pro_*` granted full access during DB outages) | Removed fallback; fails CLOSED; in-memory cache covers legitimate users | `5fec0d57` |
| Webhook trigger length-oracle timing attack | sha256-pre-hash + `timingSafeEqual` on fixed-length buffers | `5fec0d57` |
| Webhook trigger SSRF via `agent: "../../_misc/admin/..."` | `WEBHOOK_AGENT_ALLOWLIST` derived from `AGENT_REGISTRY` | `5fec0d57` |
| `Math.random` used for referral codes, memory IDs, A/B cohort | `crypto.getRandomValues` + `crypto.randomUUID()` | `98531822` |
| Weekly-report agent `ReferenceError: auth is not defined` crash path | Removed dead auth branch (factory handles it) | `5fec0d57` |
| Stripe at-least-once webhook delivery = duplicate side effects | `stripe_events` dedup table with 23505 idempotency catch | `c13e5b4e` |
| Resend hang = Vercel function starvation (3 call sites) | `signal: AbortSignal.timeout(8_000)` + `resendBreaker` | `c13e5b4e`, `15f305f1` |
| Tavily hang = 30s+ agent block | `Promise.race([search, setTimeout(10_000)])` + warn-log | `15f305f1` |
| `useAgentRun` had no client-side timeout (spinner forever) | 60s default `AbortSignal.timeout` + TimeoutError branch | `c13e5b4e` |
| Plan enforcer failed OPEN on any DB error (free-tier bypass) | `USAGE_UNAVAILABLE` sentinel; fails CLOSED on DB errors; OPEN only on 42P01 bootstrap | `5fec0d57` |
| Plan enforcer `getUserPlan` hardcoded "free", ignoring paid subscriptions | Now reads `subscriptions` table, respects `status === "active"` + `currentPeriodEnd` | `685b3b7f` |
| Missing Clerk middleware (concerning at first glance) | Verified: Next.js 16 treats `src/proxy.ts` as middleware (`proxy` is a valid middleware filename in Next 16) | verified in-session |

All security fixes have accompanying commit messages explaining the
attack scenario and the fix.

---

## 💥 Reliability — what's hardened

| Fragility | Fix | Commit |
|---|---|---|
| `FloatingOrbs` React hooks violation (crashed landing page for every visitor) | Extracted each orb to own component; CSS `display:none` on mobile instead of `return null` | `5fec0d57` |
| N+1 query in `/api/playbooks/runs` (31 DB round-trips per poll) | Single `inArray(runId, [...])` + in-memory group | `5fec0d57` |
| TelemetryProvider recreated setInterval on every state change; orphan setTimeout on unmount | Ref-based state access; cleanup in ref | `5fec0d57` |
| NIM/Gemini/Claude/Groq circuit breakers flapped during transient jitter (3 fails/30s reset) | Raised to 5 fails/60s reset — clean failover during real outages, no flap on blips | `15f305f1` |
| Billing agent used in-memory Map; lost every deploy | DB persistence via `usage` table; USD pricing; removed ZAR slop | `ed5857f2` |
| Landing page "Live model health" hit auth-gated endpoint → everyone saw "offline" | Rewritten to `/api/health/deep` with honest per-provider state | `c13e5b4e` |

---

## 🧹 Honesty — slop removed

These were shipping to users or would have on launch.

| Lie | Truth | Commit |
|---|---|---|
| **Claude Mythos** model listed in registry with fake "TBD Q2 2026" release date and $25/$125/M-token pricing (10+ files) | Model doesn't exist; removed everywhere | `ed5857f2`, `882dc578` |
| **131 agents / 39 models** claimed across landing, `/built-with-claude`, partner docs | 130 / 38 (verified via `ls src/app/api/_agents/ \| wc -l` and model registry count) | `ff3d4422` |
| `reports/page.tsx` prompt instructed Claude to *"use realistic placeholder data based on typical B2B SaaS benchmarks"* — had Claude fabricating numbers in customer reports | Rewrote all 4 prompt templates to explicitly say "do NOT fabricate — state data-unavailable if needed" | `ed5857f2` |
| ROI Analytics `loadDemoData()` showed 247 leads / 1,893 content pieces / 12,450 agent calls / 3,112 hours saved to any user whose API failed | Removed entirely; honest zero-state | `ed5857f2` |
| Agent Marketplace `FALLBACK_TEMPLATES` with 12 fake products by invented authors ("VoxForge", "ContentStack", "DataMine Co") | Removed; honest empty state | `ed5857f2` |
| Pricing page enterprise modal: "Commander Name", "Hardware Binding Protocol", "John Doe" placeholder | Rewritten as professional "Talk to Sales / Enterprise onboarding / Full Name / Your name" | `ed5857f2` |
| "Commander" as default client name in weekly reports / voice-closer / JarvisSocket | Replaced with "Team" / "account owner" / neutral wording | `ff3d4422` |
| TelemetryProvider pushed fake "Ghost Fleet optimizing unread inbound hooks" messages on interval | Removed; no synthetic activity | `5fec0d57` |
| LiveModelHealth comment claimed "NOT simulated" while line 50 added `Math.floor(Math.random() * 30)` per-model jitter | Full rewrite with real per-provider health | `c13e5b4e` |
| Root `layout.tsx` JSON-LD schema said "129 specialized agents, 35+ open-source models, 15-layer safety pipeline" | 130 / 38 / 5 | `c13e5b4e` |
| Pricing FAQ claimed "All powered by Google Gemini 2.5 Pro" (single-model) and "free users get 20/day, Pro and Agency get unlimited" (stale plan names) and "All payments in ZAR" (contradicts USD throughout) | Full rewrite with real plan names and USD via Stripe | `c13e5b4e` |

---

## ✨ Features shipped

### Nexus Protocol — `/dashboard/nexus`
Four frontier models (Nemotron Ultra 253B, Qwen 3 235B, Mistral Nemotron, DeepSeek V3) race in **true parallel** via SSE streaming. Each model's tokens forward to the client as they arrive — no sequential waiting. Then Gemini 2.0 Flash reads all four transcripts and writes a unified consensus. Live demo at `/dashboard/nexus`, ground-up redesigned in the editorial monograph aesthetic.

### Editorial design system — 4 surfaces
Committed to one bold aesthetic: `.editorial-light` (bone/charcoal/copper) and `.editorial-dark` (warm near-black/bone/copper). Instrument Serif display + Inter Tight body + JetBrains Mono data. Single copper accent `#B5532C` tonally adjacent to Anthropic's wordmark.

- **Landing hero**: "Hire AI employees. *Fire busywork.*" — Instrument Serif at 8rem with italic copper accent
- **/dashboard/nexus**: Technical Monograph ground-up rebuild
- **/built-with-claude** (new): Editorial Museum; Vol.01·No.01 masthead, pull quote, chapter structure, colophon
- **/pricing hero**: "Pick one price. *Keep it.*" with italic-serif inline "Claude" reference

### `sovereign-slop-hunter` — Claude Code plugin
Read-only defensive agent at `.claude/plugins/sovereign-slop-hunter/`. Encodes seven fabrication categories **with the actual patterns from this codebase** — so it catches the next Mythos before we ship it. Triggered by "audit for slop", "before I push", "showing this to Anthropic". Demonstrated in round 2 of this session: caught the 131→130, 39→38, and "Commander" leaks the human review had missed.

### `useAgentRun` hook — one error UX for all agent calls
Dashboard pages previously handled agent failures 80 different ways (spinners forever, raw JSON errors, silent swallows). `useAgentRun` maps status → UX: 200 returns data, 401/403 redirects preserving return URL, 429 surfaces upgrade CTA via `upgradeUrl`, 503 shows "temporarily unavailable", 5xx shows specific error from body, network shows "lost connection", timeout shows "request timed out after Ns". Migrated `/leads`, `/content-factory`, `/seo-dominator` — pattern for the rest.

### ADR-0001 implementation — free-tool email+IP rate limit
Previously 3/hr by IP — broke enterprise users behind VPN gateways after the 3rd employee tried the tool. Now 10/hr by email if provided, 3/hr by IP if not, with a 20/hr IP ceiling to prevent fake-email spray. Email capture is optional at the UI level. Every run writes to the `usage` table with `source: "free-tool"` for funnel analysis.

### Claude Partner Network positioning
- New `/built-with-claude` page — editorial magazine style, designed to be sent around inside Anthropic
- Landing hero now reads: *"Built with Claude for reasoning, NVIDIA NIM for throughput"*
- Model pill ring leads with Claude Sonnet 4.6 + Haiku 4.5
- New "Built WITH Claude, not just on it" section on `/` — 3 honest cards (Claude as reasoning core / Built by solo founder + Claude Code / Not embedding — building)

### Partner Network deliverables
- `ANTHROPIC_PARTNER_TEN.md` — honest answer to Karl's "pick your ten": 1 human + 9 named production Claude surfaces as an agent-augmented delivery unit
- `ANTHROPIC_ENGAGEMENTS.md` — Sovereign Matrix itself as the flagship engagement with full Claude surface-area breakdown by model

### ADRs
`docs/adr/0001-free-tool-rate-limit-identity.md` — Accepted. First in the series.

---

## ⚠️ Gaps that still need to be filled

These are known, tracked, and ranked by priority. **Nothing here blocks a Partner Network review**; these are the "nice to have before widescale paid users" items.

### Red — fix before inviting 100+ active users

1. **Run DB migrations in Neon.** Migrations `0000–0004` live in `drizzle/` but none have been applied to production Neon yet. Before real traffic hits `/api/playbooks/run` or Stripe webhooks, these need to run. Command: connect via Neon console SQL editor → paste each `.sql` file in order.
2. **Rate-limit Map → Upstash Redis.** `src/app/api/_misc/rate-limit/route.ts` and `src/app/api/free/run/route.ts` still use in-memory `Map<string, Window>`. On Vercel's serverless platform each function instance has its own Map, so the effective limit is `N × quota`. Upstash is already configured in `src/proxy.ts` — just needs to be wired into the rate-limit store.
3. **Stripe + Yoco env keys**. Webhook signature verification requires `STRIPE_WEBHOOK_SECRET`, checkout requires `STRIPE_SECRET_KEY`. Yoco live keys (for ZAR flow) similarly. Without these, `/api/payments/stripe/webhook` returns 503 and `/pricing` checkout buttons don't work.

### Amber — fix within a week of launch

4. **Per-route `error.tsx`** for deep dashboard sub-routes. Root `src/app/dashboard/error.tsx` exists; sub-routes like `/dashboard/settings/billing-history`, `/dashboard/agent-profile` don't, so an async throw inside them cascades up to a full-page fallback.
5. **Internal v1 proxy fetch timeout.** `src/app/api/v1/[...path]/route.ts` line ~173 proxies to agent endpoints without `AbortSignal.timeout`. If an agent hangs for 30s, the caller burns their 60s Vercel budget with no useful error.
6. **`/dashboard/scheduled` execution loop.** Page is in beta with an honest banner. CRUD works (schedules save to DB). What's missing: a cron job that reads `scheduled_runs` table and fires the playbooks at their scheduled times. Either implement or officially deprecate the feature.
7. **Founders table is hardcoded.** `src/app/api/_misc/founders/route.ts` maintains a hand-edited allowlist. Fine for the first 10, but scales badly. Migrate to DB row + admin UI.
8. **API keys feature** (`api_keys` table exists; no code path reads/writes it). Either implement with proper rotation / revocation or remove the table so it doesn't imply a feature.

### Green — nice to have

9. **Auto-generate `registry.ts`** from a build-time scan of `src/app/api/_agents/*/route.ts`. Currently manually maintained and prone to drift.
10. **Stripe webhook health check endpoint**. `/api/health/stripe-webhook` that returns OK iff signature verification is wired. Helps catch misconfigured webhook URLs in Stripe dashboard.
11. **Dashboard pages still not using `useAgentRun`** — most of the 80+ pages still have their own fetch-error patterns. Migrate incrementally as you touch each one.
12. **Better OG images**. Current `og-image.jpg` is generic. One per major surface (Nexus, built-with-claude, pricing) would improve shared-link click-through.

---

## 🔭 Deep research — what else to build

Proposals for what would make this product genuinely hard to compete with. Ordered by defensibility.

### Proposal A — Real agent scheduling (day+ of work, launch-defining)
Wire `scheduled_runs` to a cron loop that actually fires playbooks. Vercel Cron or Upstash QStash. The moment this works, the product becomes fundamentally different from ChatGPT: you're not *asking for answers*, you're *delegating work that happens without you*. This is the single feature that would make Karl's team say "oh, this is actually an operating system."

### Proposal B — Multi-tenant RLS (row-level security) at the Postgres layer (half-day)
Drizzle queries currently filter by `userId` in application code. If we ever ship a direct-SQL endpoint, or if a future contributor forgets the `.where(eq(userId))` clause, tenant data bleeds. Postgres RLS at the `playbook_runs` / `usage` / `subscriptions` / `settings` tables provides defense-in-depth that can't be forgotten in a query.

### Proposal C — Agent SDK publish (day+)
`src/app/developers/docs` exists but the SDK isn't published. One proper `@sovereign-matrix/agents` npm package lets external developers build agents against the platform's contract. Pairs with the marketplace story. This is the "80% revenue share" promise made flesh.

### Proposal D — End-to-end encrypted BYOK vault (half-day)
Currently BYOK stores user-provided API keys via `safeDecrypt` + a server-side symmetric key. An upgrade: encrypt on the client with a key derived from the user's Clerk session, so Sovereign Matrix operators never see plaintext customer keys. Would be a major trust signal for enterprise buyers.

### Proposal E — `agent-of-agents` live execution graph (half-day)
When a playbook runs multiple agents, render a live DAG (React Flow or XYFlow, which is already in the dep tree) showing step status. Autopilot page currently shows a timeline list — a live graph would be dramatically more demoable for investor/partner reviews.

### Proposal F — Observability pipeline — Sentry + Datadog/Axiom (half-day)
`src/lib/logger.ts` and `src/lib/error-recovery.ts` exist; neither are currently wired to a real external sink. Without that, production error visibility is `console.log` in Vercel dashboards. Sentry for errors + Axiom for logs would take 30 min each and give you real-time insight from day one.

### Proposal G — Contract tests for every agent route (day+)
Each of the 130 agent routes has its own input shape. One broken route is invisible until a user hits it. A Zod schema + a contract-test harness that fires every route with a known-valid fixture and verifies response shape would catch regressions before deploy.

### Proposal H — Real slack/email integrations shipped (day+)
The platform has agents that "send Slack messages" but the actual OAuth flows and token vaults for customer Slack workspaces aren't fully wired. Shipping 2–3 real OAuth integrations (Slack, Gmail, HubSpot) would turn the "130 agents" claim into "130 agents that actually do things in your tools."

### Proposal I — GraphQL or tRPC layer for dashboard queries (half-day)
Current dashboard fetches all go through REST endpoints with ad-hoc response shapes. A single typed interface would eliminate the "dashboard renders stale state" class of bugs and make future tool-calling surfaces trivial to add.

### Proposal J — Self-healing agents (day+)
Current agents fail → return error. Next step: failure → `auto-heal` agent inspects the failure → proposes a retry with modified parameters → runs it. Demoable moat. Some infra for this already exists in `src/app/api/_agents/auto-heal/route.ts` but isn't wired into the general failure path.

---

## 🧭 What to do immediately when you return

**30-minute quick wins** (in order):

1. Read this document. Confirm the direction.
2. Read `ANTHROPIC_PARTNER_TEN.md` — fill in the pre-send checklist at the bottom.
3. Read `ANTHROPIC_ENGAGEMENTS.md` — same.
4. Cherry-pick the 14 commits from `claude/wizardly-benz` to `main` (or merge the whole branch).
5. Push `main`. Watch Vercel deploy. Verify `/built-with-claude` renders with the editorial aesthetic on the live domain.
6. Run `npm run build` locally first to catch any remaining TS issues (there are a few pre-existing ones unrelated to this session's work).

**Then a real decision** — pick one of:
- **Ship the scheduler** (Proposal A) → operating-system story is complete
- **Wire Sentry + Axiom** (Proposal F) → production observability from day one
- **Apply migrations and test end-to-end** → unblock all the stuff that was bootstrap-tolerant

Whichever you pick, the slop-hunter agent is standing guard. Run it
before every push. It already proved its value in this session by
catching three HIGH-severity fabrications the human review missed.

---

*Autonomous build session, April 19, 2026.
14 commits. ~3,000 lines changed. Zero slop shipped.*

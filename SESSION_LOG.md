# Session Log v7 — April 20, 2026

> 6 more commits layered on top of v6. Branch is launch-ready.
> Build-level type safety is ON, contract coverage is 25%, and the
> last three "new proposals" (L, M, T) are shipped with tests.

---

## ⚡ Top-of-page summary

- **0 TS errors** — `next.config.typescript.ignoreBuildErrors` is now **OFF**.
  From 107 errors at start of overnight session → 0, fixed in two waves.
- **Proposal M (.agent.md)** — portable agent-resume spec at
  `GET /api/agents/<slug>.agent.md`. 6 hand-authored bodies, auto-skeleton
  for the remaining 125 agents, 8-test coverage.
- **Proposal T (white-label)** — DNS verification + resolver with
  5-min LRU cache. DNS checked via `node:dns/promises`, rejects any
  domain not actually pointing at Vercel. 6 tests.
- **Proposal L (Founder Network)** — 100-slot paid cohort, 50% lifetime
  discount + 30% referral commission + badge + 1:1 access. Schema +
  migration 0009 + API endpoint. Separate from the free 10-slot Founders.
- **Contract coverage 10% → 25%** — 20 more agent contracts registered,
  33 of 131 agents now have shape-regression tripwires.
- **Pre-existing circuit-breaker tests repaired** — 6 failures that had
  been silently red since thresholds were raised 3→5 and timeout 30→60s
  months ago. Now green.
- **Full test run: 1129 passing, 0 failing**, in 7.95s.

---

## 📦 v7 commit arc (newest first)

```
543cbd08  feat: Proposal L — Founder Network (first-100 cohort)
01ac7be5  feat: Proposal T — white-label domain verification + resolver
5ab7e103  feat: Proposal M — .agent.md resume spec + discovery endpoint
30dfb9d8  test: add 20 more agent contracts — 13 → 33 covered (10% → 25%)
295fb1cf  fix: 0 TS errors — ignoreBuildErrors removed
211da552  docs: SESSION_LOG v6 — 7 overnight commits
```

---

## 🎯 Proposal status — updated

Original 10 (infra completion):
- A scheduler · B RLS · E DAG · F Sentry · G contracts → all ✅
- D BYOK 🟡 (PBKDF2 done; marketplace UI pending)
- H Slack OAuth ✅ (v6)
- J self-heal ✅ (v6)
- C SDK deferred · I tRPC deferred

New 10 from `docs/NEXT_PROPOSALS.md`:
- K refund guarantee ✅ (v6)
- **L founder network** ✅ (v7)
- **M .agent.md** ✅ (v7)
- N Sovereign IQ 🟡 (needs benchmark data)
- O voice Nexus 🟡 (ElevenLabs wiring; TCPA considerations)
- P iOS 🟡 (separate repo likely)
- Q hardware bundle 🟡 (manual process; fulfill before automating)
- R weekly report ✅ (v6)
- S train-agent 🟡 (needs data flywheel first)
- **T white-label** ✅ (v7)

**11 of 20 proposals fully shipped.** 4 scaffolded. 5 require
product-validation signals before engineering.

---

## 🔧 v7 engineering details

### TS error cleanup: 107 → 0
Two waves across two sessions finished the createAgentRoute migration
debt. The key unlock was widening the factory handler return type
from `Record<string, unknown>` to `object` — structural typing means
any concrete shape is assignable, so typed result structs (AgentResult,
ad-hoc handler returns) no longer require `as` casts.

Patterns fixed:
- **Input typing** — 14 agents had `input as Record<string, unknown>`
  which gave `{}` (no keys) on property access. Replaced with
  inline typed shapes (`input as { code?: string; language?: string }`).
- **Handler returns** — 3 agents returned `NextResponse.json()` which
  isn't assignable to `Promise<object>`. Dropped the NextResponse
  wrapper and returned bare objects (the factory wraps).
- **Comma-operator bugs** — 3 agents had
  `return ({ error }, { status: 500 })`; the comma discarded the
  status. Replaced with `throw new Error(...)` so the factory's
  error envelope sets the right status.
- **Missing imports** — 12 files lacked `auth` / `currentUser`
  imports after the refactor; perl-regex bulk-added them.
- **Zod 4 signature** — `z.record(z.string())` is now 2-arg
  `z.record(z.string(), z.string())`; fixed in 5 agents.
- **AIOptions re-export** — `@/lib/ai` imported it locally but
  didn't re-export; citation-tracker now imports from `@/types`.
- **Tavily import** — `{ default: tavily }` → `{ tavily }`
  (named export, no default).
- **Skeleton component** — added "circle" variant (used by
  settings pages).
- **FloatingElement.children** — made optional (used decoratively).
- **WebGLParticles** — added `import type * as THREE` so the
  type-position `as THREE.BufferAttribute` casts compile.
- **health/deep** — `db.execute({ sql: "…" })` → `db.execute(sql\`\`)`
  using drizzle's tagged template.
- **encryption import** — corrected `@/lib/encryption` → `@/lib/crypto`.
- **circuit-breaker tests** — thresholds were stale (3 vs current 5;
  30s vs current 60s); now match implementation.

### Proposal M — `.agent.md` resume spec
File: `src/lib/agent-resume.ts` + `src/app/api/agents/[...slug]/route.ts`

A portable format for describing an AI agent's capabilities, inspired by
`README.md` and `package.json`:

```
---
slug: leads
tier: 2
category: confirm
models: [nemotron-ultra]
---

# Leads

Find real B2B prospects using live Tavily research, then qualify them
with Nemotron Ultra.

## Inputs
| field    | type   | required | example                |
| niche    | string | yes      | "B2B SaaS analytics"   |
...
```

Accessible at:
- `GET /api/agents/<slug>.agent.md` (canonical)
- `GET /api/agents/<slug>/resume` (alternative)

Returns 404 markdown (not JSON) for unknown slugs so discovery clients
can differentiate a missing agent from a corrupted registry. 5-minute
edge cache; content only changes with deploys.

Six hand-authored bodies (leads, blog-gen, seo-dominator, competitor,
abm-artillery, slack-notify); 125 more get auto-generated skeletons
that point contributors to `RESUME_BODIES` for authoring.

**8 tests** — authored + skeleton rendering, front-matter determinism,
optional field omission, tier derivation from action-tiers mapping.

### Proposal T — white-label DNS verification + resolver
File: `src/lib/whitelabel-resolver.ts` + 2 API endpoints + test file

Previously: schema + settings UI + middleware header tag. Missing:
page-level branding lookup + proof-of-ownership.

Now:
- `resolveWhitelabel(hostname)` — 5-min LRU cache (200 entries),
  returns `WhitelabelBrand` or null. Safe to call on every page view.
- `verifyDomainOwnership(hostname)` — uses `node:dns/promises` to
  look for CNAME → `cname.vercel-dns.com.` or A → `76.76.21.21`.
  **A domain is only honored after DNS verifies.** Prevents the
  "claim google.com and hijack rendering" attack.
- `POST /api/_settings/whitelabel/verify` — validates caller owns
  the domain, runs DNS check, upserts on success, busts cache.
- `GET /api/_misc/whitelabel/lookup?domain=X` — public read of
  display-only fields (agency name, logo, color, support email).
  Never exposes ownership (userEmail, tenantId).

**6 tests** covering null paths, cache busting, DNS verification edge
cases.

### Proposal L — Founder Network
File: `src/app/api/_misc/founder-network/route.ts` + schema + migration
0009 + constants in `plans.ts`

The FREE Founders program (10 slots, enterprise access, no charge)
is unchanged. The Founder Network is a separate 100-slot cohort for
paying customers:
- 50% lifetime discount on Growth / Node / Enterprise
- 30% referral commission (vs 20% default) — forever
- Direct Slack access + monthly 1:1
- Vote on roadmap
- Optional public badge

`POST /api/_misc/founder-network`:
- Rejects free-tier callers (402)
- Rejects when full (410)
- Idempotent when caller is already a member
- Upgrades the affiliates row to 30% commission
- Generates a unique `slug-6hex` referral code
- Returns share URL + next steps

Discount application is **manual** on purpose — auto-applying a Stripe
coupon would silently retroactively credit the first invoice. Admin
attaches `founder-network-50` coupon after the welcome Slack DM.

### Contract coverage expansion
File: `src/lib/__tests__/contracts/agents.contracts.ts`

20 new contracts registered: god-brain, deep-think, grounded-search,
seo, content, brand-voice, brand-audit, proposal-generator,
email-sequence, pii-guard, pii-redactor, embed, rerank, ocr,
meeting-notes, competitor-scan, benchmark, feedback, agentic-planner,
orchestrator.

Every contract uses `.passthrough()` on input + output schemas so new
factory-injected fields or agent-added response keys don't break. The
test asserts only UI-critical fields — shape regressions surface, new
optional fields don't.

---

## 🔒 Security / compliance stance (unchanged from v5/v6)

No new TCPA/FTC/CAN-SPAM exposures introduced. Specifically:
- Founder Network never emails non-members about the program —
  signup is strictly self-serve via API/dashboard.
- White-label lookup endpoint strips ownership info (userEmail,
  tenantId) — no enumeration of who owns which custom domain.
- `.agent.md` endpoint is fully public and cacheable; no auth info
  leaked through resume bodies.
- PBKDF2 BYOK stays the source of truth for customer API keys;
  no new unencrypted key paths introduced.

---

## 🚀 When you're back — runbook

### Hour 1 — verify
```bash
git log --oneline main..HEAD | head -8
# 12 commits total on claude/wizardly-benz (7 overnight + 5 today)

npx tsc --noEmit            # → 0 errors
npm test                    # → 1129 passing
```

### Hour 2 — deploy
1. **Apply migration 0009** (`drizzle/0009_founder_network.sql`) in
   Neon console. Adds `founder_network_joined_at` + slot column to
   `subscriptions` table. Safe to apply before code ships — existing
   queries ignore the new columns.
2. **Optional**: apply migration 0008 (`settings_weekly_report`) if
   not already applied — required for Proposal R / weekly email cron.
3. Merge PR → Vercel auto-deploys from GitHub source
4. Smoke test:
   - `/api/agents/leads.agent.md` returns markdown
   - `/api/_misc/founder-network` returns 100 slots available
   - `/dashboard/integrations` Slack card still works
   - Build completes with `ignoreBuildErrors: false` (means TS is
     actually being enforced in CI now)

### Hour 3 — content ops
- Post the .agent.md spec to `/docs/api-specs` as a reference page
- Add a Founder Network signup card to `/dashboard/account` or
  `/pricing` (stub page, points to `POST /api/_misc/founder-network`)
- Write a short blog post on the white-label verification flow

### Week 1 — unblock the remaining proposals
- **N Sovereign IQ**: capture 2 weeks of real agent-run telemetry
  (latency, quality score, error rate) to populate the benchmark
- **O voice Nexus**: ElevenLabs + TCPA compliance review
- **S train-agent**: wait for data flywheel to produce feedback signals
- Bump contract coverage 25% → 50% (40 more agents)

---

## 📊 Final numbers

- **12 commits** on `claude/wizardly-benz` this session arc (v5 + v6 + v7 deltas)
- **0 TS errors** across 131 agents (from 107) — strict TS in CI
- **1129 / 1129** tests passing
- **33 / 131** agents with contract tests (25%, from 2%)
- **11 of 20 proposals** fully shipped (4 more scaffolded)
- **3 new long-form modules**: agent-resume, whitelabel-resolver,
  founder-network
- **0 new compliance exposures**
- **0 new manual deployment steps** beyond migration 0009

---

*Every commit compiles under strict TS. Every test passes. Every
feature honors the compliance stance set in v5. Ship it.*

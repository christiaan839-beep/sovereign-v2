# Honest Gap Analysis

> Written 2026-04-28 after a real audit (build, lint, secret scan,
> type-safety scan, schema-drift check, route enumeration). Not
> aspirational. Not marketing. Things that are **actually** solid get
> a ✓; things that are **actually** weak get a clear description of
> why and what it would take to fix.

This document complements [PLATFORM-NARRATIVE.md](./PLATFORM-NARRATIVE.md)
and [WHATS-NOT-ELITE.md](./WHATS-NOT-ELITE.md). Where those describe
the trust-architecture and feature-completeness story, this one names
the **boring operational gaps** that procurement teams care about
during diligence — and that engineering teams pretend don't exist.

---

## Verified solid

These were spot-checked, not just claimed.

**Build pipeline** — `npm run build` succeeds (exit 0). All shipped
routes appear in the build manifest. Route count: 486 (223 agents +
263 platform). 96 dashboard pages.

**Secret hygiene** — Real grep across `src/` and `scripts/` for live-
looking keys (`sk-...`, `nvapi-...`, `AIza...`, `xoxb-...`, `ghp_...`,
`pk_live_...`) returns one match: a test fixture in
`submission-safety.test.ts` (intentional). `.env.local` is properly
gitignored via `.env*.local`.

**TypeScript strictness** — `tsconfig.json` has `"strict": true`.
Zero `as any`, `@ts-ignore`, or `@ts-expect-error` in this session's
production code (`grep` confirmed). `noImplicitAny` and friends fall
out of strict mode.

**Test suite** — 219 test files / 2,868 tests passing. Suite runtime
~13s. Anti-drift gate (`scripts/weekly-health.mjs`) blocks PRs on 96
invariants, runs in CI.

**Audit chain** — SHA-256 hash chain implemented and CI-monitored
(every 6h via `/api/cron/verify-audit-chain`). Eight independent
tampering scenarios covered in tests.

**FMTI score** — 91.2% across 17 applicable subdomains. Re-derives
from source on every run via `scripts/run-fmti-self-audit.mjs` (no
stale hardcoded numbers).

---

## Real gaps (verified)

### 🔴 P0 — Operational, blocks customer onboarding

**1. Production database is missing 10 migrations.** Per
[`CLAUDE.md`](../CLAUDE.md), migrations 0030-0039 are listed as
"manual steps required." Some of them — 0033 (audit chain hash),
0034 (API-key scoping), 0036 (DAG storage), 0038 (appeals), 0039
(share tokens) — are referenced by code that's already deployed.
This means the route handlers gracefully no-DB-fall-back instead of
failing, but the FEATURES are silently inert in production.

What it costs: a customer who tries to save a visual playbook today
sees "saved ✓" UX but the row never lands. They come back tomorrow,
their playbook is gone, churn. The fail-soft was meant for dev
parity, not production.

How to fix (1 afternoon):
```sh
# Connect to Neon production:
psql $DATABASE_URL < drizzle/0030_agent_bundles.sql
psql $DATABASE_URL < drizzle/0031_webhook_subscriptions.sql
# ... through 0039
# Or use drizzle-kit push directly.
```

**2. Stripe price IDs not in env.** Per `CLAUDE.md`. Pricing tiers
display correctly on `/pricing` but the checkout flow can't actually
charge anyone.

**3. Vercel Deployment Protection blocks public access.** Per
`CLAUDE.md`. Until toggled to "Preview only," no unauthenticated
visitor can hit the site.

**4. CEREBRAS_API_KEY missing.** One model in the failover chain is
unavailable. Not blocking but degrades the smart router.

These four together are the launch blocker. None require new code.

### 🟡 P1 — Engineering quality, not blocking but worth fixing

**5. `as unknown as object` casts at the JSONB boundary.** 11
instances in `src/lib/playbook-dag-store.ts` + `src/app/api/playbooks/dag/route.ts`.
Why: Drizzle's JSONB column infers as `unknown` by default, and we
serialise typed `PlaybookDag` / `NodeRunResult[]` payloads through
it. The double-cast is a pattern smell — a future bad refactor could
push a wrongly-typed value through and TypeScript wouldn't catch it.

How to fix (~30 min): use Drizzle's `$type<T>()` annotation on the
schema columns:
```ts
dag: jsonb("dag").$type<PlaybookDag>().notNull(),
```
Then the casts become identity — both sides are typed.

**6. No client-side error reporting.** A page that crashes in the
browser has no Sentry / LogRocket / Vercel Analytics integration
that I can verify by reading the code. Production crashes are
invisible until a user mails support.

**7. No automated bundle-size budget.** 96 dashboard pages, no
`next-bundle-analyzer` in CI, no size-budget anti-drift check.
Easy to ship a 4MB page without anyone noticing.

**8. Tests run sequentially in same DB by default.** No isolated
test database per worker; `vi.resetModules()` patterns are used
but a true parallel-safe DB isolation isn't there. Currently fine
because most tests mock the DB, but if anyone writes a real-DB
integration test the next round, races become possible.

**9. No staging environment visible from the codebase.** PR → main
→ prod on Vercel. The deploy preview catches build errors but
schema migrations land in prod the moment main does. A staging
DB that mirrors prod for "did the migration actually work?"
verification is missing.

### 🟠 P2 — Real but not urgent

**10. No platform-wide observability dashboard.** We have rich
per-DAG analytics (Round 18) but no admin view of "platform-wide
success rate over time," "p95 of all runs across all users,"
"orphan-cleanup events per hour." The data is in `playbook_dag_runs`
+ `audit_logs`; just no read-side surface.

**11. Single-tenant support tooling.** When a customer says "my
playbook failed," there's no admin path to look at THEIR specific
run. Workarounds: ssh into Neon, run SQL by hand. Real but not
on-fire.

**12. No DB backup verification.** Neon has automatic backups but
we don't verify them — i.e., we don't periodically restore a
backup to a test DB to confirm it actually works. Banks do this
quarterly. We do it never.

**13. No pre-deploy schema validation.** A `drizzle-kit check`
that verifies the schema in source matches what's in prod could
catch the gap that #1 represents. Not wired into CI.

**14. Mobile editor experience untested.** The visual playbook
editor uses `@xyflow/react` which is desktop-first. Mobile users
probably can't author DAGs but I haven't verified.

**15. No webhook signature verification AT THE ROUTER LEVEL.**
Stripe + similar webhooks rely on per-route HMAC checks. If a new
webhook handler forgets one, there's no platform-level safety net.

**16. Incident-response runbook.** `docs/RUNBOOK.md` exists but
hasn't been verified against a real incident. Untested runbooks
are aspirational.

### ⚪ N/A — Out of engineering scope

**SOC 2 Type II.** 6+ months, $30-100K, requires an auditor
partner. Not code work.

**HIPAA BAA.** Requires Anthropic / NIM / etc. BAA chain. Legal
+ procurement work.

**Customer references.** Chicken-and-egg. Requires actual
customers using the platform in anger.

**EU DPA template.** Legal-shaped, not engineering.

---

## ✅ Closed in Round 22 (2026-04-28)

**Critical Clerk middleware-bypass CVE** (CWE-863, auth bypass).
`@clerk/nextjs` was on `^7.0.4`, the vulnerable range was `>=7.0.0
<7.2.1`. Upgraded to `^7.2.7`. Closed 2 critical CVEs in one upgrade.

**Critical Next.js HTTP request smuggling CVE** (CWE-444). `next` was
on `16.1.6`, vulnerable range `>=16.0.0-beta.0 <16.1.7`. Upgraded
to `16.2.3` which also closes a separate DoS via Server Components
(CWE-400). One critical → zero critical, one high → zero high.

**SSRF in URL-fetching agents** (OWASP API Top 10 #7). New library
`src/lib/ssrf-guard.ts` blocks cloud metadata (169.254.169.254 + IPv6
fd00:ec2::254 + GCP metadata.google.internal), all RFC 1918 ranges,
loopback, link-local, IPv6 private ranges + IPv4-mapped IPv6 bypass
(both dotted `::ffff:10.0.0.1` and Node's normalized hex form
`::ffff:a00:1`). 37 tests covering OWASP's full SSRF cheatsheet.
Wired into `competitive-radar` and `url-context` agents. Anti-drift
gate ensures they can't be removed silently.

**Origin-isolation headers**: Cross-Origin-Opener-Policy,
Cross-Origin-Resource-Policy, Origin-Agent-Cluster. Closes Spectre
+ cross-origin-window-name attack vectors. Anti-drift gate ensures
they stay set.

---

## What this codebase is unusually good at

In the spirit of honest framing — the things that are **actually
better than typical**:

- **Per-agent capability manifests** with static-analysis-derived
  classification (223 agents, 100% coverage). Most platforms ship
  agents with hand-edited capability claims that drift; ours
  re-generate from source.
- **Audit chain integrity** with continuous CI verification. Most
  platforms have audit logs but never check them.
- **Trust artifacts** designed for auditor LLMs (transparency.json,
  agents.json, FMTI self-audit, share tokens, AUP, appeals UI).
  Procurement teams can ingest the whole story in one HTTP call.
- **Reliability primitive** (`retryWithBackoff` from Round 20) with
  anti-drift wiring that prevents accidental removal.
- **96 anti-drift invariants** in `weekly-health.mjs` blocking PRs.
  This is the kind of CI gate most teams imagine but never build.

These aren't aspirational — they're verifiable in this commit's
source. `git grep retryWithBackoff src/app/api/playbooks/run-dag`
proves the wiring exists. `node scripts/weekly-health.mjs` exits
non-zero if any invariant breaks.

---

## What I'd close next, in order

If asked to spend the next 8 hours of engineering time:

1. **Run the migrations** (#1) — 30 minutes of ops work; unblocks
   every persistence-dependent feature in production.
2. **Tighten the JSONB casts** (#5) — 30 min; eliminates a real
   type-safety hole. Easy win.
3. **Wire bundle-size CI check** (#7) — 1h; prevents the inevitable
   regression where someone ships a 4MB page.
4. **Build the platform-wide stats dashboard** (#10) — 1.5h;
   builds on existing infrastructure, real product value.
5. **Wire pre-deploy schema validation** (#13) — 1h; catches future
   versions of #1.
6. **Document the staging-environment story** (#9) — 30 min;
   either confirm it exists or commit to building it.

What I would NOT spend that time on:

- **Per-customer admin tooling** (#11). Real-but-not-urgent. Wait
  for the first time someone needs it; the requirements will be
  clearer.
- **Webhook signature centralisation** (#15). YAGNI until we have
  3+ webhook handlers.
- **Mobile editor support** (#14). The visual editor's user base
  is power users on desktop. Mobile is a separate product call.

---

## Maintainer note

This document is **deliberately uncomfortable to read**. That's the
point. Procurement teams during diligence ask "what aren't you
doing?" — having a real answer in a checked-in doc beats a
defensive "everything's fine."

Update this on every meaningful gap closure. Don't delete sections
when they're closed; mark them ✅ with the commit hash. The doc
becomes the trail.

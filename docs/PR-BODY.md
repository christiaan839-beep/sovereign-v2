# PR body — copy into GitHub after clicking the compare URL

**URL**: https://github.com/christiaan839-beep/sovereign-v2/compare/main...claude/wizardly-benz?expand=1

**Title**: `feat(platform): 218 agents · 5 industries · measured SLO · elite-tier benchmarks`

---

## Summary

Lands the `claude/wizardly-benz` feature branch — 354 commits including today's elite-tier sprint.

Headline deltas on `main` after merge:

- **Agents**: 203 → **218** (10 new vertical-depth agents across Insurance, Logistics, Healthcare, Agriculture, Construction + 5 vision-factory agents)
- **Industry pages**: 6 → **10** (added /for-insurance, /for-logistics, /for-construction, plus polished /for-agriculture + /for-healthcare)
- **New competitor-positioning page**: /compare — 12-metric live matrix vs CrewAI/Zapier/n8n/LangChain/Lindy
- **Measured reliability**: /api/_health/slo + /api/_health/performance (rolling uptime, P50/P95/P99 per endpoint, cache hit rate with stampede saves)
- **Structured errors**: 18-code taxonomy via `src/lib/error-codes.ts` (category, HTTP status, docHint, retryAfter)
- **Ops tooling**: `npm run db:apply` — idempotent migration applier with SHA256 drift detection
- **Creator/admin surfaces**: /dashboard/creator (unified home), /admin/bundles (curator), /dashboard/webhooks (HMAC-secret one-shot reveal), /creators/status/[refId] (public capability-token status)
- **Evals**: 10 → 25 / 218 agents (5% → 11% coverage)
- **Tailwind v4 bug fix**: `bg-${color}-500` interpolated classes on for-healthcare + for-agriculture were silently broken — replaced with literal-class map

## Verification state

- `npx tsc --noEmit` — clean
- `npx vitest run` — **2331/2331 passed** (189 test files)
- Lint: 0 errors on new code (27 pre-existing errors in files this PR doesn't touch)

## ⚠️ Merge conflicts expected (~14 files)

The feature branch is **103 commits behind + 354 ahead** of `main`. The following files have content conflicts and need a merge commit / conflict resolution:

- `package.json` (lenis version bump)
- `src/app/page.tsx` (landing restructure: HEAD has LivePlatformMetrics + /compare nav + code-split + RecentRunsTicker; main has A2EGraph + different section map)
- `src/app/for-healthcare/page.tsx` (HEAD has Tailwind v4 fix; main has the broken dynamic-classname version)
- `src/app/for-agriculture/page.tsx` (same Tailwind fix)
- `src/config/models.ts`, `src/lib/ai.ts`, `src/lib/nvidia.ts`, `src/lib/constants.ts` (model/provider registry evolution)
- `src/db/schema.ts` (schema evolution on both sides)
- `src/lib/agent-factory.ts` (HEAD adds recordSloEvent wire-in; main has other changes)
- `src/lib/__tests__/plans.test.ts`, `src/lib/plan-enforcement.ts`, `src/lib/env-check.ts`, `src/lib/semantic-memory.ts`, `src/lib/cron-auth.ts`, `src/lib/cta-track.ts`, `src/lib/idempotency.ts`, `src/lib/model-discovery.ts`

**Recommended resolution strategy**:
- For `for-healthcare` + `for-agriculture`: **keep HEAD** (the Tailwind fix is correct; mainline is the bug)
- For `src/app/page.tsx`: **merge both** — keep main's section structure, splice in HEAD's `<LivePlatformMetrics />` + `/compare` nav + footer industries
- For schema/models/config: **prefer main** (the 103 commits of mainline work is mostly config/model registry evolution we want to keep)
- For `agent-factory.ts`: keep main's structural changes + splice in HEAD's `recordSloEvent` import + 2 call sites

See `docs/MERGE-STRATEGY.md` in this PR for the full step-by-step.

## ⚠️ Migration 0004 collision

Both branches claim migration slot 0004:
- `main`: `drizzle/0004_remaining_tables.sql`
- `this PR`: `drizzle/0004_stripe_events.sql`

Both files land on merged main. `scripts/apply-migrations.mjs` applies them in lex order (remaining_tables → stripe_events). Verify no table-level conflict before running on prod — see `docs/MERGE-STRATEGY.md` §3.

## Deploy checklist (after merge)

1. `DATABASE_URL="$PROD_NEON_URL" npm run db:apply` — applies 0028–0031 + any stragglers
2. Set Vercel env vars (cross-check `.env.example`)
3. Confirm Vercel Deployment Protection is "Only Preview Deployments"
4. Watch GitHub-native deploy complete (not `vercel build && deploy --prebuilt`)
5. Smoke-test:
   - https://sovereignmatrix.agency/compare — should show live SLO/cache numbers
   - https://sovereignmatrix.agency/for-insurance — new industry page
   - https://sovereignmatrix.agency/api/_health/slo — JSON payload
   - https://sovereignmatrix.agency/api/_health/performance — P95 + cache stats

## Risk

- **Medium**: 14 files with merge conflicts — resolution requires review
- **Low**: Code additions are all factory-pattern + graceful-degradation (SLO tracker, error codes, new agents). No breaking changes.
- **Low**: 0 test regressions; 15 new evals added.

## Rollback

Squash-merge means one commit on main. Revert command:

```bash
git revert -m 1 <merge-sha>
git push origin main
# Vercel auto-deploys the revert
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)

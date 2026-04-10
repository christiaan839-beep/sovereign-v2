---
name: deploy-check
description: "Pre-deploy verification gate for Sovereign Matrix. Runs build, type check, lint, and scans for the critical gotchas documented in CLAUDE.md before pushing to production. Use this skill when the user says 'deploy check', 'pre-deploy', 'ready to ship', 'verify build', 'check before push', or before any production deployment. Make sure to use this skill whenever the user is about to deploy, push to main, or merge a PR that affects the main branch, even if they don't explicitly ask for a check."
disable-model-invocation: false
---

# Deploy Check

A pre-deploy verification gate that catches the 6 critical gotchas that have historically broken Sovereign Matrix builds. Run this before any production push.

## When to Run

- Before `git push` to main
- Before merging PRs that touch `src/app/`, `next.config.ts`, or `package.json`
- After adding new client components (Turbopack HMR can break)
- After adding new API routes (Vercel bundling can fail)
- Whenever the user says "deploy", "ship", "push to prod"

## The Checks

Run these in order. Stop and report on first failure — don't cascade noise.

### 1. Build

```bash
npm run build 2>&1 | tail -60
```

**Watch for:**

- `_global-error` prerender crash → verify `prerenderEarlyExit: false` in next.config.ts
- `Module not found` → likely a new client component imported via `dynamic()` — convert to static import
- `serverExternalPackages` warnings → add the package to next.config.ts
- Out of memory → retry with `NODE_OPTIONS='--max-old-space-size=8192' npm run build`

### 2. Type Check (advisory only)

```bash
npx tsc --noEmit 2>&1 | tail -30
```

**Note:** `typescript: { ignoreBuildErrors: true }` is intentional — legacy agent routes have pre-existing TS errors. Report new errors but don't block.

### 3. Lint

```bash
npm run lint 2>&1 | tail -30
```

### 4. SSR / Client Component Audit

Grep for the patterns that crash prerendering:

```bash
# ssr:false inside server components is forbidden in Next.js 16
grep -rn "ssr: false" src/app/ --include="*.tsx" --include="*.ts" | grep -v '"use client"'
```

If results appear that aren't in `"use client"` files, that's a blocker.

### 5. Dynamic Import Audit

New client components using `dynamic()` cause Turbopack HMR errors and Vercel bundling failures:

```bash
grep -rn "dynamic(" src/app/ --include="*.tsx" --include="*.ts" | grep -v "webpackIgnore"
```

Flag any new results since last deploy — they should be static imports.

### 6. Secret Scan

Make sure no secrets were accidentally staged:

```bash
git diff --cached | grep -iE '(sk_live_|pk_live_|_secret|_api_key|password)' | head
```

If anything matches, STOP the deploy.

### 7. Database Migration Check

```bash
ls drizzle/*.sql 2>/dev/null | tail -5
```

Remind the user if migrations 0002-0004 haven't been run in Neon Console yet (per CLAUDE.md).

## Output Format

```
## Deploy Check Report

### ✅ Passed
- Build: [status]
- Lint: [status]
- SSR audit: [status]
- Secret scan: [status]

### ⚠️ Warnings
- [non-blocking issues]

### ❌ Blockers
- [critical issues that must be fixed]

### Verdict
[READY TO DEPLOY | NEEDS FIXES]
```

## Why This Matters

Per CLAUDE.md, these are the gotchas that have actually broken deploys:

1. `_global-error` prerender crash (needs `prerenderEarlyExit: false`)
2. Dynamic imports breaking Turbopack HMR
3. `ssr: false` in server components
4. Missing `serverExternalPackages` entries
5. New client components not wrapped in `ClientOnlyEffects`
6. ClerkProvider crashes during static prerendering

This skill catches all 6 before they hit Vercel.

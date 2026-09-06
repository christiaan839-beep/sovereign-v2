---
name: deploy-check
description: "Pre-deploy verification gate for Sovereign Matrix. Runs the full gate set via `npm run verify`, then interprets any failure against the build gotchas documented in CLAUDE.md. Use this skill when the user says 'deploy check', 'pre-deploy', 'ready to ship', 'verify build', 'check before push', or before any production deployment. Make sure to use this skill whenever the user is about to deploy, push to main, or merge a PR that affects the main branch, even if they don't explicitly ask for a check."
disable-model-invocation: false
---

# Deploy Check

Run the gates, then interpret what failed. This skill does **not** carry its
own list of checks — that list lives in `scripts/verify.mjs` and nowhere
else, so it cannot drift from what CI and the pre-push hook enforce.

(It used to carry its own list, and had drifted: it claimed
`ignoreBuildErrors: true` and told the reader type errors were advisory,
when `next.config.ts:16` sets `false` and the tree typechecks at 0 errors.
It also referenced a `ClientOnlyEffects` wrapper deleted in wave 121 and a
ClerkProvider prerender crash that the current `SafeClerkProvider` SSR path
deliberately does not have.)

## When to run

- Before `git push` to main
- Before merging PRs that touch `src/app/`, `next.config.ts`, or `package.json`
- After adding new client components or new API routes
- Whenever the user says "deploy", "ship", "push to prod"

## Step 1 — run every gate

```bash
npm run verify
```

That is the whole mechanical check: registry drift, `ssr:false` placement,
Suspense traps, staged-secret scan, lint, typecheck, tests, migration
parity, build, and `npm audit --audit-level=high`.

Read the summary line carefully:

- `all gates passed` — everything green, nothing skipped.
- `no blocking failures` — something **warned or skipped**. A skip is an
  unknown, not a pass. `build` skips without Clerk/DB env; `migration
  parity` skips without `DATABASE_URL`. Say which gates were skipped and
  that they are therefore unverified — don't report the run as clean.
- Any `✗` — blocked. Go to step 2.

To see the gate list and which profile each belongs to:

```bash
node scripts/verify.mjs --list
```

To re-run one gate while fixing it:

```bash
node scripts/verify.mjs --only=build
```

## Step 2 — interpret a failure

The gates tell you *that* something broke. These are the failure modes that
have actually broken this repo's deploys, and what each one means:

**`build` fails**

- `_global-error` prerender crash → check `prerenderEarlyExit: false` is
  still in `next.config.ts`.
- `Module not found` on a new client component → it was imported via
  `dynamic()`. Turbopack's stale-module bug means new client components
  need **static** imports.
- `serverExternalPackages` warning → add the package to `next.config.ts`
  (pinecone, twilio, drizzle-orm, neon are already there).
- Out of memory → retry with
  `NODE_OPTIONS='--max-old-space-size=8192' npm run build`.

**`typecheck` fails** — a real blocker, not advisory. `ignoreBuildErrors`
is `false`, so a type error is a build failure. Fix it, or scope an
`@ts-expect-error` on the offending line with a concrete one-line reason.

**`ssr:false placement` fails** — `next/dynamic` with `ssr: false` landed in
a server component, which Next 16 rejects. Wrap it in a `"use client"`
component. Do **not** "fix" `SafeClerkProvider` this way: its SSR path is
deliberate and build-verified (see CLAUDE.md).

**`suspense trap` warns** — a `"use client"` file calls `useSearchParams` /
`useParams` without Suspense in the same file. Warn-only because a parent
may legitimately wrap it. Confirm the parent does; if not, add Suspense.

**`registry drift` fails** — run `npm run gen:registry` and commit the
result.

**`secret scan` fails** — stop. Do not commit. Rotate anything that already
left the machine.

**`audit (high+)` fails** — a high or critical advisory landed. Prefer
`npm audit fix`; if a vendor genuinely has no fix path, scope an allowlist
in a follow-up PR rather than weakening the gate.

## Step 3 — the operator step gates can't check

Migrations are applied by hand in the Neon SQL Editor, so no gate can
confirm they ran. Check what's on disk against what CLAUDE.md says is
pending:

```bash
ls drizzle/*.sql | tail -5
```

Remind the user to apply pending migrations before deploying.

## Output format

```
## Deploy Check Report

### Gates
[paste the npm run verify summary — including any skipped gates]

### Blockers
- [each ✗, with the interpretation from step 2]

### Warnings
- [each ⚠, and whether it's actually a problem here]

### Unverified
- [each ∅ skip, and what would need to be set to verify it]

### Verdict
[READY TO DEPLOY | NEEDS FIXES]
```

Never report READY when a gate was skipped without saying so.

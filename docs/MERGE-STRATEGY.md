# Merge strategy: landing `claude/wizardly-benz` on `main`

> A surgical, step-by-step plan for shipping the 353-commit branch to
> production without losing work or breaking Vercel. Written for the
> operator (you) — not an aspirational rubric.

---

## State of the repo (snapshot)

| Dimension          | Value                                                               |
|--------------------|---------------------------------------------------------------------|
| Feature branch     | `claude/wizardly-benz`                                              |
| Tracking target    | `origin/main`                                                       |
| Commits ahead      | **353** on `claude/wizardly-benz`, not on `main`                    |
| Commits behind     | **103** on `origin/main`, not on the feature branch                 |
| FF merge possible? | **No.** Branches have genuinely diverged. Expect conflicts.         |
| Migration slot     | `0004` exists on BOTH sides with different filenames — see §3.      |
| Deploy target      | Vercel, GitHub-native deploys (NOT `vercel build && deploy --prebuilt`) |

Run `git fetch origin && git rev-list --left-right --count origin/main...HEAD`
to verify before every attempt.

---

## 1. Pick your merge shape

There are four shapes. Pick one up front — the steps depend on the choice.

### (a) Squash-merge via GitHub PR **← recommended default**

- Collapses all 353 commits into a single commit on `main`.
- Feature branch retains full granularity for audits / bisect.
- One-click revert from the GitHub UI (the whole thing becomes one commit).
- Loses per-file blame nuance — if that matters, pick (b).

### (b) Merge-commit via GitHub PR

- Preserves every commit on `main`. `git log --first-parent main` still
  reads as a tidy release log because merge commits are the only first-parent
  entries.
- Fat PR to review (354 commits). Skim, don't audit.

### (c) Rebase then fast-forward (linear history)

- `git rebase origin/main` on the feature branch, resolve conflicts, push
  `--force-with-lease`, then `git merge --ff-only` into `main`.
- Purest linear history. Breaks any other clones of the feature branch.
- Forbidden on shared/remote feature branches unless you're the only user.

### (d) Surgical cherry-pick

- Identify only the gap-closing commits, cherry-pick them to a fresh
  branch off `main`, PR the small branch.
- Highest precision, highest effort. Use this when only a subset of
  the 353 commits is actually wanted.

**Default recommendation: (a) squash-merge** unless you explicitly want
per-commit blame on main.

---

## 2. Pre-merge checklist

Before opening the PR:

```bash
# 1. Sync the feature branch with main so the PR only shows YOUR changes.
#    Choose rebase OR merge — they have different blast radii.
git fetch origin

# Option A: rebase (cleaner, but rewrites feature-branch history)
git checkout claude/wizardly-benz
git rebase origin/main
#   …resolve conflicts file-by-file; `git rebase --continue` as you go.
#   If it becomes a mess, `git rebase --abort` and switch to option B.
git push --force-with-lease origin claude/wizardly-benz

# Option B: merge (safer, preserves history)
git checkout claude/wizardly-benz
git merge origin/main
#   …resolve conflicts; `git commit` to finalize the merge commit.
git push origin claude/wizardly-benz
```

```bash
# 2. Verify tsc + tests still green after the sync.
npx tsc --noEmit
npx vitest run --reporter=dot

# 3. Dry-run migrations against staging first (never prod first).
DATABASE_URL="$STAGING_NEON_URL" npm run db:apply:dry
```

Only after all three pass, open the PR.

---

## 3. The 0004 migration collision

Both branches claim slot `0004`:

| Branch                    | File                                  |
|---------------------------|---------------------------------------|
| `origin/main`             | `drizzle/0004_remaining_tables.sql`   |
| `claude/wizardly-benz`    | `drizzle/0004_stripe_events.sql`      |

**What this means**

- `git merge` will bring BOTH files onto the merged branch — they have
  different filenames, so there's no file-level conflict.
- `scripts/apply-migrations.mjs` sorts by filename, so the order becomes:
  `0004_remaining_tables.sql` → `0004_stripe_events.sql`.
- If your live DB has already run `0004_remaining_tables` (from main), it
  will be marked applied in `_ops_migrations`. Adding `0004_stripe_events`
  afterward is fine — they operate on different tables. Verify by reading
  both files before merging.

**Resolution options**

1. **Keep both (recommended if live prod has already run `0004_remaining_tables`)**:
   no action — the applier handles lex ordering. Document the anomaly in
   your ops notes.

2. **Rename our 0004 to `0032_stripe_events.sql`**: cleaner, but changes
   a filename that may be recorded in `_ops_migrations` on any Neon branch
   you've already touched. Drift-warn will fire next run.

3. **Manually merge into a single 0004**: highest clarity, but requires
   schema-by-schema reconciliation. Only do this if the two files
   actually conflict on a table or constraint.

Before the PR, cat both files and confirm no schema conflict:

```bash
cat drizzle/0004_remaining_tables.sql drizzle/0004_stripe_events.sql
# Look for: same table created twice, same constraint name, same sequence.
```

---

## 4. Open the PR

```bash
gh pr create \
  --base main \
  --head claude/wizardly-benz \
  --title "feat: land sovereign matrix elite-tier improvements (208 agents, SAM v1.0, marketplace)" \
  --body "$(cat <<'EOF'
## Summary

Lands 353 commits of work from `claude/wizardly-benz` onto `main`.

Highlights:
- 208 agents registered (was 203), including 5 vertical-depth OCR agents
- SAM v1.0 manifest spec frozen, extensions namespace for future growth
- Marketplace: bundles, creator earnings, webhook subscriptions
- Admin: bundle curator UI at /admin/bundles
- Ops: `npm run db:apply` for idempotent migration application
- Full test suite green (2316 tests across 189 files)

## Pre-merge verification

- [x] `npx tsc --noEmit` clean
- [x] `npm test` passes (2316/2316)
- [x] `npm run db:apply:dry` against staging — reviewed output
- [x] 0004 migration collision reviewed — see docs/MERGE-STRATEGY.md §3

## Test plan

- [ ] Vercel preview deploys clean from this PR
- [ ] Smoke-test production flows: /dashboard/creator, /admin/bundles,
      /dashboard/webhooks, /creators/status/<refId>
- [ ] `npm run db:apply` on production Neon — verify _ops_migrations reflects
      all pending files

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 5. Post-merge deployment

Vercel is wired to GitHub auto-deploy `main`. After the squash-merge:

```bash
# 1. Pull the new main locally
git checkout main && git pull origin main

# 2. Apply migrations on production (ONE operator at a time)
DATABASE_URL="$PROD_NEON_URL" npm run db:apply

# 3. Watch the Vercel build
gh run watch   # or check https://vercel.com/<team>/sovereign-v2

# 4. Smoke-test production
curl -fsSL https://sovereignmatrix.agency/api/_health/production-readiness | jq .
```

**Do not** run `vercel build && vercel deploy --prebuilt` unless you have
a fresh reason to believe Vercel's CLI file-resolution bug is fixed. The
GitHub-native deploy path is proven (55+ consecutive READY deploys per
session learnings).

---

## 6. Rollback plan

If smoke-test fails or a regression surfaces in the first hour:

```bash
# Option A: revert the squash commit (squash-merge only)
git checkout main
git revert -m 1 <squash-commit-sha>
git push origin main
# Vercel auto-deploys the revert.

# Option B: redeploy the previous production
#   Vercel Dashboard → Deployments → previous READY → "Promote to Production"

# Migration rollback:
#   Only needed if a new migration CREATED state (tables with data) that
#   the previous code doesn't know about. Usually safe to leave schema
#   forward and just redeploy older code — Postgres tolerates unused tables.
#   If strictly required, write an 0032_rollback_*.sql and apply it.
```

---

## 7. Pitfalls specific to this repo

| Pitfall                                     | Mitigation                                  |
|---------------------------------------------|---------------------------------------------|
| Vercel Deployment Protection blocks prod    | Set to "Only Preview Deployments" in Settings |
| Prebuilt deploys miss .next chunk files     | Use GitHub-native deploys only              |
| Turbopack stale module after new file add   | Use static imports for new client components |
| Migration 0004 collision                    | See §3 above                                |
| Missing env vars in Vercel                  | Cross-check `.env.example` against Vercel Settings → Environment Variables |

---

## 8. When in doubt

- Feature branch green, main broken? Use Vercel rollback (§6 option B).
  Don't fix on `main` — fix on `claude/wizardly-benz` and land a new PR.
- Conflicts too gnarly to rebase? Use option B (merge).
- Reviewer asks for per-commit blame? Switch to merge-commit shape (1b).
- Something asks for credentials you don't have? Stop. Document the
  required env/credential and surface it to the operator. Do not paste
  credentials into commits or chat.

> When in doubt, choose: fewer + sharper over more + softer.
> (From `docs/STAY-ELITE.md`)

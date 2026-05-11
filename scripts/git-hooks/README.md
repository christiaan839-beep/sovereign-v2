# Git Hooks

Local mirror of the CI checks that catch the most regressions. Wired up so
your laptop refuses to push code that CI is going to reject anyway.

## Install (once per clone)

```bash
npm run hooks:install
```

That points `core.hooksPath` at this directory. From then on, `git push`
runs `pre-push` automatically.

## Bypass (emergencies only)

```bash
PRE_PUSH_SKIP=1 git push
```

Then fix forward — don't leave the gap open.

## What runs

| Hook       | Checks                                                         | Blocking?                            |
| ---------- | -------------------------------------------------------------- | ------------------------------------ |
| `pre-push` | `npm run lint`, `npm run test`                                 | yes                                  |
| `pre-push` | `npm run typecheck`                                            | informational (warns, doesn't block) |
| `pre-push` | `node scripts/check-migrations.mjs` (if `DATABASE_URL` is set) | yes                                  |

## Why not Husky?

Husky adds another tool + npm postinstall side-effects. A bare bash hook
under version control is portable, auditable, and removable in one
`git config --unset core.hooksPath`. Add Husky if you ever need
JS-based hook composition; we don't yet.

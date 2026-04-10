---
name: ship
description: "Complete dev-to-production pipeline for Sovereign Matrix in a single command. Runs deploy-check, invokes the security-reviewer agent on staged changes, commits with a conventional message, pushes to main, and monitors the Vercel deploy. Use this skill when the user says 'ship it', 'ship', 'deploy', 'push to prod', 'release', or 'let's ship'. Make sure to use this skill whenever the user wants to move completed work to production, even if they don't explicitly name all the steps."
disable-model-invocation: true
---

# Ship

The complete pipeline from dev to production. One command, one gate, zero surprises.

## The Pipeline

Run these steps in order. **Stop on first failure** and report. Never skip steps to "save time" — every step exists because a past deploy broke without it.

### Step 1: Gather Context

```bash
git status
git diff --stat
git log --oneline -5
```

Understand what's changing before anything else.

### Step 2: Deploy Check

Run the `deploy-check` skill's full verification (build, lint, SSR audit, dynamic import audit, secret scan).

**Blockers stop the ship.** Warnings get surfaced to the user for acknowledgement.

### Step 3: Security Review on Staged Changes

Identify which files are API routes, auth code, webhook handlers, or payment code:

```bash
git diff --cached --name-only | grep -E '(api/|auth|webhook|stripe|payment|clerk)'
```

If any sensitive files are staged, invoke the `security-reviewer` agent on the diff. If it returns any Critical or High findings, **block the ship** and surface them.

### Step 4: Commit

Draft a conventional commit message based on the actual diff:

- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for restructuring without behavior change
- `chore:` for tooling/config
- `docs:` for docs-only changes

Keep the subject under 72 chars. Body explains the _why_, not the _what_ (the diff shows what).

Commit with HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type: concise subject

Why this change was needed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Step 5: Push

```bash
git push origin main
```

Per CLAUDE.md: Vercel deploys from GitHub source — never use `vercel build && vercel deploy --prebuilt`.

### Step 6: Monitor Deploy

Use the Vercel MCP tools to watch the build:

```
mcp__claude_ai_Vercel__list_deployments
mcp__claude_ai_Vercel__get_deployment_build_logs
```

Tail the logs until status is READY or ERROR. If ERROR, fetch runtime logs and diagnose.

### Step 7: Report

```
## Ship Report

### Commit
[commit hash] [subject]

### Deploy
- URL: [vercel url]
- Status: [READY | ERROR]
- Duration: [seconds]

### Security Review
- Files audited: [count]
- Findings: [count by severity]

### Next Steps
[any follow-ups needed]
```

## Hard Rules

- **NEVER skip deploy-check** — the 6 gotchas in CLAUDE.md are real and have broken prod
- **NEVER push on security Critical/High findings** — fix first, ship second
- **NEVER use `--no-verify`** — hooks exist for a reason
- **NEVER force push to main** — create a new commit instead
- **NEVER commit `.env*` files** — the PreToolUse hook blocks edits, but double-check `git status`
- **NEVER proceed past a failed step** — each gate protects the next

## When This Skill Doesn't Apply

- Hotfix branches going to a staging environment (use manual git)
- Feature branches with open PRs (use `/commit-commands:commit-push-pr` instead)
- WIP commits mid-development (just use plain `git commit`)

## Why User-Only Invocation

This skill has `disable-model-invocation: true` because shipping to production is a decision the user makes, not an autonomous action Claude takes. Claude can prepare, verify, and suggest — but the user says "ship it".

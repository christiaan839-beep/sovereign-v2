---
name: security-check
description: "Full security verification workflow for Sovereign Matrix. Runs the regression test suite, invokes the security-reviewer agent on git diff (or a target scope), and reports findings with fix recommendations. Use this skill when the user says 'security check', 'security audit', 'check security', 'verify security', 'scan for vulnerabilities', or before any production deploy that touches webhooks, auth, or payments. Make sure to use this skill whenever touching API routes, auth middleware, or payment code, even if not explicitly asked for a security scan."
disable-model-invocation: false
---

# Security Check

Automates the security verification workflow for Sovereign Matrix: runs regression tests first (fast feedback), then launches the security-reviewer agent for deeper analysis on changed or targeted code.

## When to Run

- Before any push to main
- After editing any file in `src/app/api/_payments/`, `src/app/api/_webhooks/`, or `src/app/api/webhooks/`
- After editing auth/middleware code
- When the user explicitly asks for a security audit
- As part of the `/ship` skill's pre-deploy gate

## The Workflow

### Step 1: Fast Regression Check

Run the existing security regression tests first — they're fast (~250ms) and catch any reintroduction of previously-fixed bugs:

```bash
npx vitest run \
  src/lib/__tests__/idempotency.test.ts \
  src/app/api/_webhooks/__tests__/twilio-security.test.ts \
  src/app/api/_webhooks/__tests__/signature-verification.test.ts
```

**If any test fails, STOP and surface the failure.** Don't proceed to the deeper audit — a regression is a blocker.

### Step 2: Determine Scope

If the user specified a target (e.g., "audit the voice routes"), use that scope.

Otherwise, audit the diff:

```bash
git diff --name-only main...HEAD | grep -E '\.(ts|tsx)$'
git diff --name-only | grep -E '\.(ts|tsx)$'  # include unstaged
```

Filter to security-relevant files:

```bash
# Files worth a deep review
git diff --name-only HEAD | grep -E '(api/|auth|webhook|stripe|payment|clerk|middleware|crypto|rate-limit|jailbreak|guard)'
```

If no security-relevant files changed, report "no security-relevant changes" and exit — don't waste tokens on a vacuous audit.

### Step 3: Invoke the security-reviewer Agent

Launch the `security-reviewer` agent (`.claude/agents/security-reviewer.md`) with the scoped file list. The agent will check:

- Auth (Clerk `auth()` + userId scoping)
- Webhook signature verification
- Input validation (no raw `req.json()` → DB)
- IDOR vectors (tenant/user scoping on every query)
- Secret exposure in logs and responses
- Rate limiting on public endpoints
- Error response leakage

### Step 4: Grade Findings

The agent returns findings classified by severity. Apply this policy:

| Severity | Action                                                      |
| -------- | ----------------------------------------------------------- |
| CRITICAL | **BLOCKER** — must fix before deploy. Surface immediately.  |
| HIGH     | **BLOCKER** — fix before deploy unless explicitly deferred. |
| MEDIUM   | Report for follow-up. Don't block unless there are several. |
| LOW      | Log and continue.                                           |

### Step 5: Offer to Fix

For each Critical/High finding, offer a concrete fix. Reference the patterns already established in the codebase:

- **Signature verification**: see `src/app/api/_webhooks/crm/route.ts` (HubSpot v3) or `src/app/api/_webhooks/booking/route.ts` (Cal.com HMAC)
- **Rate limiting**: `import { rateLimit } from "@/lib/rate-limit"` then `const limiter = rateLimit({ interval: 60, limit: 30 })`
- **IDOR protection**: `const { userId } = await auth(); if (!userId) return 401;` then scope all DB queries by `eq(table.userId, userId)`
- **Idempotency**: `import { alreadyProcessed } from "@/lib/idempotency"`
- **XML escaping for TwiML**: see the `xmlEscape()` function in `src/app/api/_webhooks/twilio/route.ts`
- **Timing-safe comparison**: always length-check before `crypto.timingSafeEqual`

### Step 6: Verify the Fix

After applying any fix:

1. Re-run the regression tests (should still pass)
2. Re-run the specific file through lint: `npx eslint <file>`
3. Verify the fix addresses the specific finding (don't mark it resolved if the change doesn't match)

### Step 7: Report

```
## Security Check Report

### Regression Tests
[PASS | FAIL] — N tests in Yms

### Scope
- Files audited: [list]
- Source: [git diff | user-specified]

### Findings
- Critical: N [list]
- High: N [list]
- Medium: N [list]

### Verdict
[CLEAN | FIXES APPLIED | NEEDS MANUAL REVIEW]

### Next Steps
[specific actions]
```

## Why This Skill Exists

The Sovereign Matrix codebase has 53+ API routes handling payments, webhooks, and AI-powered agents. Manual security review at that scale doesn't scale. The `security-reviewer` agent + this skill turn security review into a repeatable, automatable gate that runs on every significant change.

The regression test suite was built specifically to catch the 6 critical vulnerabilities found in the initial audit. Those tests are the first line of defense — they run in ~250ms and fail loudly if any fix gets reverted.

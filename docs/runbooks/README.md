# Sovereign Matrix Runbooks

When something goes wrong, open the matching runbook before you start
coding. Each one is the **shortest path from "we have a problem" to
"problem fixed,"** with the exact commands and dashboards to hit.

Runbooks are written for the on-call operator at 03:00, not for someone
who already knows the system.

## Index

| Symptom                                                              | Runbook                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Ready to take this branch from "demo grade" to first paying customer | [`launch-checklist.md`](./launch-checklist.md)       |
| `/api/health/ready` returns 503, customers can't sign in             | [`db-down.md`](./db-down.md)                         |
| Webhook deliveries failing, agent runs error with `42P01`            | [`migration-drift.md`](./migration-drift.md)         |
| Sign-in stuck on "Loading…", `/api/health/ready` shows clerk:down    | [`clerk-jwks-failing.md`](./clerk-jwks-failing.md)   |
| Checkout button errors, `/api/payments/stripe/checkout` 500s         | [`stripe-keys-rotated.md`](./stripe-keys-rotated.md) |
| CI smoke job red, preview URL shows the wrong content                | [`smoke-failing.md`](./smoke-failing.md)             |
| Multi-tenant isolation: ready to flip RLS from permissive → strict   | [`rls-enforcement.md`](./rls-enforcement.md)         |

## Conventions

Every runbook has the same shape:

1. **Symptoms** — exact strings you'll see in Sentry, monitoring, or the dashboard
2. **Diagnose** — the 1-3 commands or dashboard checks that confirm the root cause
3. **Fix** — the steps to resolve, ordered fastest-first
4. **Verify** — how to confirm the fix worked
5. **Postmortem** — what to add to the test suite or runbook so this can't bite the same way twice

When you fix a real incident, **edit the runbook** while it's fresh. Future
you will thank you.

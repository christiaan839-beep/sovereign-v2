# Runbook: Clerk auth is failing

## Symptoms

- Sign-in page hangs on "Loading…"
- All authenticated API routes return 401 (even for users who were
  signed in five minutes ago)
- Sentry: `Failed to verify token`, `JWKS endpoint unreachable`, or
  `Clerk: invalid publishable key`
- `/api/health/ready` returns 503 with `failures: ["clerk:down"]`
  or `["clerk:unconfigured"]`

## Diagnose

1. Hit the readiness probe and inspect the `clerk` block:

   ```bash
   curl -s https://sovereignmatrix.agency/api/health/ready | jq '.critical.clerk'
   ```

2. Decode the publishable key to confirm the JWKS host:

   ```bash
   echo "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | cut -d_ -f3- | base64 -d
   ```

   Should print something like `clerk.sovereignmatrix.com`. Then:

   ```bash
   curl -s "https://<host>/.well-known/jwks.json" | jq '.keys | length'
   ```

   Expect a number ≥ 1.

3. Check Clerk's status: <https://status.clerk.com/>

## Fix

**If `clerk:unconfigured`** (env vars missing):

1. Vercel → Project → Settings → Environment Variables
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from
   Clerk Dashboard → API keys for the right environment (test vs live)
3. Also confirm `CLERK_WEBHOOK_SECRET` is present if you rely on user
   lifecycle webhooks
4. Redeploy

**If `clerk:down`** (JWKS unreachable):

- Clerk-side outage → wait it out, post status notice
- Wrong publishable key shape → confirm `pk_test_…` vs `pk_live_…`
  matches the deployment environment
- Custom domain DNS broken → if you use `clerk.sovereignmatrix.com`,
  verify the CNAME points where Clerk says it should

**If sign-in works but webhooks don't fire**:

1. Clerk Dashboard → Webhooks → Endpoints
2. Confirm `https://sovereignmatrix.agency/api/webhooks/clerk` is listed
3. Match the signing secret to `CLERK_WEBHOOK_SECRET` in Vercel
4. Use Clerk's "Send test event" to verify reception

## Verify

```bash
curl -s https://sovereignmatrix.agency/api/health/ready | jq '.critical.clerk.status'
# expect: "ok"
```

Then sign in with a fresh browser session (incognito) — confirm the full
auth → dashboard → agent run flow works.

## Postmortem

- Did the readiness probe catch this before users hit it? If not, the
  probe needs tightening.
- Add a Sentry alert that fires when `Clerk: invalid` appears in logs
  more than 5x/minute — that's a key-rotation event in disguise.
- Document the rotation process: every Clerk key change must update
  Vercel env vars **before** the old key is revoked.

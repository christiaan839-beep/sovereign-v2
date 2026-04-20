# Sovereign Matrix — Incident Runbook

> When something's broken at 2 AM, this is the recipe.
> Last updated: 2026-04-20 (SESSION_LOG v8)

## 🚨 Emergency contacts

| Service | Account | Contact |
|---|---|---|
| **Vercel** | christiaan@sovereignmatrix.agency | [vercel.com/support](https://vercel.com/support) |
| **Neon** | christiaan@sovereignmatrix.agency | [neon.tech/docs/introduction/support](https://neon.tech) |
| **Clerk** | christiaan@sovereignmatrix.agency | [clerk.com/support](https://clerk.com/support) |
| **Stripe** | christiaan@sovereignmatrix.agency | [support.stripe.com](https://support.stripe.com) |
| **Upstash** | christiaan@sovereignmatrix.agency | support@upstash.com |
| **Sentry** | christiaan@sovereignmatrix.agency | [sentry.io/support](https://sentry.io) |
| **Anthropic API** | christiaan@sovereignmatrix.agency | [anthropic.com/support](https://anthropic.com) |

## 🔥 Incident playbooks

### "Site is completely down"

**Symptoms**: sovereignmatrix.agency returns 500 / 502 / times out.

1. **Check Vercel status** — [vercel-status.com](https://www.vercel-status.com)
2. **Check last deploy** — `vercel ls --meta` → did the latest deploy break prod?
3. **If yes**: `vercel rollback` to previous READY deployment
4. **If no**: Check runtime logs — `vercel logs <deployment-url>` or Vercel dashboard → Logs tab
5. **Check Sentry** — [sentry.io](https://sentry.io) for error spike
6. **Update status page** — [betterstack.com](https://betterstack.com) → trigger "Investigating" incident
7. **Tweet** via `@sovereignmatrix` if >5 min outage
8. **Post-mortem** in `docs/incidents/YYYY-MM-DD-<summary>.md` within 48 hrs

**Fast rollback command:**
```bash
vercel rollback --token=$VERCEL_TOKEN
# or via dashboard: Deployments → previous READY → "Promote to Production"
```

### "Database is slow / erroring"

**Symptoms**: API routes take >5s, agent runs fail with DB timeouts, users see spinner forever.

1. **Neon console** — check compute CPU + connection count
2. **Identify query** — Neon dashboard → Monitoring → Slow Queries
3. **If connection pool exhausted**: scale Neon compute tier up one level (Launch → Scale)
4. **If runaway query**: kill it via `SELECT pg_cancel_backend(pid)` in SQL console
5. **If table lock**: check for long transactions — `SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start`
6. **Emergency read-only mode**: set `DB_READ_ONLY=1` in Vercel → redeploy → app serves cached responses + blocks writes

**Restore from backup (worst case):**
```bash
# Neon PITR (point-in-time recovery)
# Console → Branches → Restore → Select timestamp → Create new branch
# Then promote the new branch to primary
```

### "Stripe webhook is failing"

**Symptoms**: Subscription events not updating in our DB, users paid but plan not upgraded.

1. **Stripe Dashboard** → Developers → Webhooks → our endpoint → Recent deliveries
2. **Find failing event** → View response body
3. Common causes:
   - `stripe_events` table missing → apply migration `0004_stripe_events.sql`
   - Webhook secret rotated but `STRIPE_WEBHOOK_SECRET` not updated in Vercel
   - `processed_at` stuck on `received` state (check `stripe_events` DB table)
4. **Manual replay** — Stripe dashboard → "Resend" button on failed delivery
5. **Bulk backfill** — If >20 events failed:
   ```bash
   # From Stripe CLI
   stripe events list --limit 100 --created "gte:2026-04-20" \
     | jq -r '.data[] | select(.type | startswith("customer.subscription")) | .id' \
     | xargs -I {} stripe events resend {}
   ```
6. **Verify idempotency**: our code uses 2-state `stripe_events.status` — should dedupe natural retries.

### "AI provider outage cascade"

**Symptoms**: Agents throwing 502s, Smart Router stuck, customers complaining "AI isn't working".

1. **Check provider status pages**:
   - NVIDIA NIM: [status.build.nvidia.com](https://status.build.nvidia.com)
   - Anthropic: [status.anthropic.com](https://status.anthropic.com)
   - Google: [status.cloud.google.com](https://status.cloud.google.com)
   - Groq: [groqstatus.com](https://groqstatus.com)
2. **Circuit breaker state**: `GET /api/health/deep` → `circuits` section shows each provider
3. **If all primary providers down**: emergency failover via env flag
   ```bash
   vercel env add EMERGENCY_LOCAL_ONLY production
   # set to "1" → Smart Router prefers Ollama/Cerebras
   ```
4. **Notify customers**: status page incident + email announcement for Growth+ plans
5. **When providers recover**: circuit breakers auto-close after 60s, no manual action needed

### "Customer can't log in"

**Symptoms**: One user (or many) reports login loop / "auth failed" / stuck on Clerk screen.

1. **Clerk Dashboard** → Users → search email → check status (active, banned, locked)
2. **If locked**: unlock via Clerk UI
3. **If session token issue**: have user clear cookies for `sovereignmatrix.agency`
4. **If our bug**: check `src/proxy.ts` middleware — did a recent deploy change auth logic?
5. **Emergency**: manually create user session via Clerk API if customer is high-value + blocked

### "Someone thinks they got double-charged"

1. **Stripe Dashboard** → Customers → search email → Payments tab
2. **Two `payment_intent` IDs with same amount?**
   - Check idempotency key in `stripe_events.stripe_id` — should be unique
   - If duplicate: `POST /api/_payments/stripe/refund` for the extra charge
3. **Document in `docs/incidents/`** with root cause

### "POPIA / GDPR / CCPA data request arrives"

User emails asking for data export or deletion.

1. **Verify identity** — require reply from registered email + at least one verification question
2. **Export**:
   ```bash
   # Currently manual — queries in Neon console
   SELECT * FROM usage WHERE user_id = '<clerk_id>';
   SELECT * FROM playbook_runs WHERE user_id = '<clerk_id>';
   SELECT * FROM memories WHERE user_id = '<clerk_id>';
   # Package as JSON, send via encrypted email
   ```
3. **Delete** (POPIA Art. 14 / GDPR Art. 17):
   ```sql
   BEGIN;
   DELETE FROM memories WHERE user_id = '<clerk_id>';
   DELETE FROM usage WHERE user_id = '<clerk_id>';
   DELETE FROM playbook_runs WHERE user_id = '<clerk_id>';
   UPDATE subscriptions SET status = 'deleted', user_id = 'DELETED-<hash>' WHERE user_id = '<clerk_id>';
   COMMIT;
   ```
   Then: delete Clerk user, cancel Stripe subscription.
4. **Log in `execution_audit`** table — we're legally required to prove the deletion happened.
5. **Response deadline**: 30 days (POPIA + GDPR).

### "Rate limiting broken"

**Symptoms**: Free-tier users running unlimited (we're losing money), OR paid users getting limited (we're losing customers).

1. **Check Upstash dashboard** — are sliding-window limiters counting?
2. **If Upstash is down**: middleware auto-falls-back to in-memory. Acceptable for <1h.
3. **If counting but not blocking**: check `src/lib/free-tier.ts` thresholds + `src/lib/agent-factory.ts` usage check
4. **Force-reset a user's counter**:
   ```bash
   # Upstash CLI or REST API
   curl -X POST "https://<upstash-url>/del/usage:<user_id>" \
     -H "Authorization: Bearer $UPSTASH_TOKEN"
   ```

## 🔄 Routine operations

### Deploying

```bash
# Standard: push to main → Vercel auto-deploys
git push origin main

# Preview: open a PR → Vercel deploys to preview URL
gh pr create
# then check preview URL before merging
```

**Never use `vercel --prebuilt` — filePathMap bundling is broken.** Always GitHub-native.

### Running migrations

```bash
# Local: apply to staging Neon branch
npm run db:push

# Production: via GitHub Actions (ships 0010 onward)
# Manual fallback: apply SQL from drizzle/NNNN_*.sql in Neon SQL editor
```

### Rotating secrets

Run quarterly. Critical secrets:
- `CRON_SECRET` — paired-header internal auth (needs ≥16 chars, 32 recommended)
- `STRIPE_WEBHOOK_SECRET` — from Stripe Dashboard → Webhooks → our endpoint → signing secret
- `ANTHROPIC_API_KEY` — Anthropic Console → API keys → Roll
- `CLERK_SECRET_KEY` — Clerk Dashboard → API keys → Rotate
- `UPSTASH_REDIS_REST_TOKEN` — Upstash → our DB → REST → Rotate

After rotating: update Vercel env → redeploy.

### Backup verification (monthly)

```bash
# 1. Create new Neon branch from PITR at current timestamp
# 2. Restore to throwaway database
# 3. Run: SELECT count(*) FROM users;  (+ other tables)
# 4. Verify counts match primary within 1% tolerance
# 5. Delete throwaway branch
```

Schedule in Linear as recurring: "Monthly DR drill".

### Scheduled crons sanity check

Current crons (from `vercel.json`):
- `weekly-report` — Mondays 08:00 UTC
- `scheduler` — every 1 min
- `playbook-scheduler` — every 1 min

Verify they're running: Vercel → Crons tab → Recent invocations.

## 📖 Post-mortem template

For every incident >15 min of impact, write `docs/incidents/YYYY-MM-DD-<summary>.md`:

```markdown
# Incident: <title>

## Summary
One paragraph on what happened, when, who was affected.

## Timeline (UTC)
- 14:03 — first error in Sentry
- 14:05 — status page updated
- 14:18 — root cause identified
- 14:31 — fix deployed
- 14:45 — resolved

## Root cause
Technical explanation. Include code snippet or query.

## Impact
- Users affected: N
- Revenue impact: $N
- Duration: N minutes

## What went well
- …

## What went poorly
- …

## Action items
- [ ] Ticket #N — prevent recurrence
- [ ] Update RUNBOOK with new playbook
- [ ] Add alert so we catch this in under 5 min next time
```

Share with the Founder Network cohort — transparency builds trust.

## 🧰 Useful commands

```bash
# Health check (deep)
curl https://sovereignmatrix.agency/api/health/deep

# Current agent count
curl https://sovereignmatrix.agency/api/agents | jq '.count'

# Trigger cron manually (needs CRON_SECRET)
curl https://sovereignmatrix.agency/api/cron/weekly-report \
  -H "Authorization: Bearer $CRON_SECRET"

# List recent errors (needs Sentry CLI)
sentry-cli events list --project sovereign-matrix --limit 20

# Check DB connection count
# Neon SQL: SELECT count(*) FROM pg_stat_activity;
```

## 🔑 When to escalate vs when to DIY

- **Site down <5 min**: investigate locally, don't page support
- **Site down 5–30 min**: open support ticket + attempt fix in parallel
- **Site down >30 min**: escalate to Vercel Enterprise Support + Neon paid support
- **Security incident confirmed**: notify customers within 72 hrs (POPIA / GDPR requirement)
- **Data breach confirmed**: notify Information Regulator (SA) within 72 hrs

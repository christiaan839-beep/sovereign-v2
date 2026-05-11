<!--
  Sovereign Matrix — PR template

  Why this exists: every multi-hour debugging session in this repo has been
  caused by one of the same five mistakes. This checklist surfaces them so
  reviewers can catch them in 30 seconds instead of waiting for CI.

  If a box doesn't apply to your change, leave it ticked — the goal is for
  every reviewer to read every box, not to enforce work.
-->

## Summary

<!-- 1-3 bullets describing what changed and why. -->

## Risk surface

<!-- Tick every box that's true; leave empty boxes for boxes that don't apply.
     Reviewer should challenge any unticked box that looks like it should be ticked. -->

- [ ] **No new client hooks without Suspense.** Did you add a `useSearchParams()`, `useParams()`, `useSelectedLayoutSegment()` call to any client component? If yes, confirm it's wrapped in `<Suspense>` or the page is already opted into dynamic rendering. **(Last bug bit us here.)**
- [ ] **No new server-only env reads at module top-level.** `process.env.X` evaluated at module load works in Node, fails on Edge runtime. Wrap in functions or move to handler scope.
- [ ] **No `dynamic = "force-dynamic"` removed.** Pages reading from `agent_runs` / cookies / headers must stay dynamic.
- [ ] **No `.env.example` removed without grep first.** Some env vars are read by SDKs (Clerk, Sentry, Plausible) without `process.env.X` references in our code.
- [ ] **No new agent route without `useVerifier !== false`.** Default-on safety is the platform's selling point; opting out should be deliberate and commented.
- [ ] **Webhook signature changes are tested.** Stripe / Clerk / HubSpot / Cal.com / Yoco / Twilio — each has a vitest case asserting signature failure rejects the request.
- [ ] **Schema changes have a paired SQL migration.** `src/db/schema.ts` and `drizzle/*.sql` move together. If you regenerated, the SQL is in the same commit.
- [ ] **Receipts still sign cleanly.** If you touched `src/lib/agent-runs.ts` or anything in the canonical projection, run `npx vitest src/__tests__/lib/agent-runs.test.ts` and confirm the 10 cases still pass.

## Test plan

<!-- What did you actually run / click / curl? Concrete commands or steps,
     not "I tested it." -->

- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm test` — all green
- [ ] `npm run build` — green (CI also runs this; cheap to verify locally)
- [ ] Manual: <!-- e.g. clicked through /verified, opened /r/<id>, ran SDK example -->

## Manual ops required after merge

<!-- Tick if a manual step is needed, list it explicitly:
     - [ ] Run drizzle/0021_agent_runs.sql in Neon
     - [ ] Set AGENT_RUN_SIGNING_SECRET in Vercel
     - [ ] Configure Stripe webhook endpoint
     If no manual ops are needed, write "None." here. -->

None.

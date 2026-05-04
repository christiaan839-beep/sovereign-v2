# Runbook: Smoke tests are failing

## Symptoms

- CI `smoke` job is red on a PR (or main)
- Playwright report shows specific spec(s) failing — not flakes
- The deployed preview URL renders something unexpected (wrong title,
  empty marketplace, 500 page)

## Diagnose

1. Open the failed CI run → download the `playwright-report` artifact.
   Each failure has a screenshot + trace in `test-results/`.

2. Identify which spec failed and read the assertion:
   - `home page loads, headline renders` → app crashed or routing broke
   - `marketplace renders multiple agents` → registry or `AGENT_SLUGS`
     is broken (often a bad import path)
   - `hand-curated agent detail loads` → `KNOWN_AGENTS` map regression
   - `registry-derived agent detail loads` → `buildGenericDetail` or
     `AGENT_SLUG_SET` regression
   - `liveness/readiness probe` → server can't start at all
   - `auth gate smoke` → middleware misconfigured (anonymous gets 200
     where it should get 401)

3. Hit the preview URL manually:
   ```bash
   curl -I "$E2E_BASE_URL"
   curl -s "$E2E_BASE_URL/api/health/ready" | jq
   ```

## Fix

**The build deployed but the route shape changed**:

- Don't update the smoke spec to match the new shape — the spec is the
  contract. Either revert the route change, or the route change is
  intentional and the spec needs an explicit update with reasoning in
  the commit message.

**Preview URL is stale** (smoke ran against old deploy):

- Confirm the GitHub secret `E2E_PREVIEW_URL` points at the _latest_
  Vercel preview alias, not a stable URL that lags
- Easier: use Vercel's deployment URL directly (`https://<project>-git-<branch>-<team>.vercel.app`)

**Marketplace test fails because an agent was removed**:

- The smoke pins `Lead Blitz` and `War Room` as examples. If you remove
  one of those from the registry, the smoke spec must be updated in the
  same commit.

**`E2E_REQUIRE_READY=true` failure** (readiness probe returned 503):

- Open `/api/health/ready` on the preview URL — see which dependency is
  red, then jump to the matching runbook (db, clerk, etc.)

**Real flake** (passes on rerun without code change):

- Re-run the job once
- If it flakes a second time: the test has a timing or selector issue —
  fix the test, don't disable it. Common fixes:
  - Use `page.waitForLoadState("networkidle")` before `page.locator(...)`
  - Use `getByRole` / `getByText` instead of CSS selectors

## Verify

```bash
# Re-run smoke locally against the preview URL:
E2E_BASE_URL=https://<your-preview>.vercel.app npm run smoke
```

All 11 specs should pass.

## Postmortem

- Was the failure preventable? Add a unit test that catches the same
  regression at lib level (faster feedback than a full Playwright run).
- If the test had to change, document in the commit message **why** the
  contract changed.
- If a flake recurs more than once: stop the line, fix the test, then
  un-pause merges.

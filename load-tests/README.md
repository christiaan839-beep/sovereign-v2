# Sovereign Matrix — Load Tests (k6)

Load-test the public API surface to know our breaking point. Closes
WHATS-NOT-ELITE.md §2.7.

## What we test

| Scenario | Endpoint | Goal |
|---|---|---|
| `health-baseline` | `/api/health/ping` | Is the platform up + how fast does the cheap path respond? |
| `slo-aggregation` | `/api/_health/slo` | Cross-instance Postgres rollup throughput |
| `transparency-manifest` | `/api/_meta/transparency.json` | 1h-cached endpoint — verify edge cache holds under load |
| `agents-manifest` | `/api/_meta/agents.json` | 4471-line JSON — verify Vercel doesn't choke on the size |

Auth-walled endpoints (`/api/v1/agents/*`, `/api/credits/*`) are
load-tested separately because they need real API keys; that suite
runs against a staging environment, not production.

## Run

```bash
# Local k6 install: brew install k6
k6 run load-tests/health-baseline.k6.js
k6 run load-tests/slo-aggregation.k6.js
k6 run load-tests/transparency-manifest.k6.js
k6 run load-tests/agents-manifest.k6.js
```

Default base URL: `https://sovereignmatrix.agency` (override via
`BASE_URL=https://staging.sovereignmatrix.agency`).

## Thresholds

Each scenario has thresholds in the `options.thresholds` block:
- p95 < 1500ms (slow path)
- p95 < 500ms (cached path)
- error rate < 1%
- 100% checks pass

A run that crosses any threshold exits non-zero, so this can wire
into CI as `npm run loadtest:smoke` (1-min smoke) and a longer
nightly soak via GitHub Actions schedule.

## Methodology disclosure

The threshold numbers above are the targets we publish on
`/status/slo`. Running these scenarios in production traffic SHAPES
those numbers — the test suite IS our SLO definition, in code.

If a real customer's flow gets slower than these numbers, our own
monitoring should fire before the customer notices. If THAT doesn't
happen, see the post-incident playbook in `docs/MERGE-STRATEGY.md`.

# Sovereign Reviewer — GitHub Action

> AI-powered security + quality review for every PR. Finds real
> vulnerabilities; flags the things you'd miss on your third coffee.
> Zero config for most repos.

Built on the same Claude-backed audit agent that found 8 real
vulnerabilities in our own v8 code in 98 seconds ([published case
study](https://sovereignmatrix.agency/trust/defenders)).

## Quick start

Add this to `.github/workflows/sovereign-review.yml`:

```yaml
name: Sovereign Reviewer

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # required — we need history to compute the diff

      - uses: sovereign-matrix/sovereign-reviewer@v1
        with:
          sovereign-api-key: ${{ secrets.SOVEREIGN_API_KEY }}
          # Everything else has sensible defaults.
```

Get a free `SOVEREIGN_API_KEY` at
[sovereignmatrix.agency/dashboard/settings/tokens](https://sovereignmatrix.agency/dashboard/settings/tokens).
First 50 reviews/month are free, no credit card.

## Inputs

| Input | Default | Description |
|---|---|---|
| `sovereign-api-key` | — (required) | API token from your dashboard |
| `diff-base` | auto | Git ref to diff against (auto-detects PR base branch) |
| `severity-fail` | `critical` | Minimum severity that fails the action: `critical` / `high` / `medium` / `low` / `never` |
| `paths` | `""` | Glob patterns to review (defaults to all changed code files) |
| `post-comment` | `true` | Post findings as PR comment (requires `pull-requests: write`) |
| `sovereign-base-url` | `https://sovereignmatrix.agency` | Override for EU data residency |
| `github-token` | `github.token` | For posting PR comments |

## Outputs

| Output | Description |
|---|---|
| `findings-count` | Total findings across all severities |
| `critical-count` | Critical findings |
| `high-count` | High-severity findings |
| `report-path` | Path to the markdown report in the workspace |

## What it finds

The reviewer specifically looks for categories that static analyzers
and human reviewers miss:

- **OWASP Top 10** with attack-scenario narratives
- **Race conditions** (TOCTOU, idempotency gaps)
- **Injection** beyond SQL — CSV formula injection, command injection
  in shell pipes, XSS via unescaped template paths
- **Authentication bypasses** (missing middleware, fail-open paths)
- **Privilege escalation** (admin self-modify, role-check gaps)
- **Data-leak paths** (PII in logs, cross-tenant joins missing RLS)
- **Financial bugs** (double-charge, missing idempotency on refunds)
- **Regex ReDoS** (catastrophic backtracking patterns)

Each finding comes with:
- File path + line reference
- Attack scenario (not "code smell" — concrete exploit)
- Impact assessment
- Suggested fix (usually with the actual code change)

## Examples

### Fail only on critical findings (default)

```yaml
- uses: sovereign-matrix/sovereign-reviewer@v1
  with:
    sovereign-api-key: ${{ secrets.SOVEREIGN_API_KEY }}
    severity-fail: critical
```

### Fail on high-severity too

```yaml
- uses: sovereign-matrix/sovereign-reviewer@v1
  with:
    sovereign-api-key: ${{ secrets.SOVEREIGN_API_KEY }}
    severity-fail: high
```

### Advisory mode — post comment, never fail

```yaml
- uses: sovereign-matrix/sovereign-reviewer@v1
  with:
    sovereign-api-key: ${{ secrets.SOVEREIGN_API_KEY }}
    severity-fail: never
```

### Use outputs to gate deploy on a separate job

```yaml
jobs:
  review:
    outputs:
      critical: ${{ steps.review.outputs.critical-count }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - id: review
        uses: sovereign-matrix/sovereign-reviewer@v1
        with:
          sovereign-api-key: ${{ secrets.SOVEREIGN_API_KEY }}

  deploy:
    needs: review
    if: needs.review.outputs.critical == '0'
    runs-on: ubuntu-latest
    steps:
      # …
```

## What it doesn't do

- **Run tests or builds** — scope is review, not CI. Use alongside
  your existing `npm test` / `go test` step.
- **Access the repo contents beyond the diff + recent file contexts.**
  We don't clone or scan your entire codebase — only the changes.
- **Store your code server-side beyond the review cycle.** Diffs
  are processed in-memory; no long-term retention. See
  [our DPA](https://sovereignmatrix.agency/docs/legal/DPA_TEMPLATE.md).

## Privacy + data handling

Code submitted to the reviewer:
- Processed in-memory only, no long-term storage
- Never trained on (contractual no-training clause)
- Subject to our [Data Processing Agreement](https://sovereignmatrix.agency/docs/legal/DPA_TEMPLATE.md)

If your repo contains regulated data (healthcare, financial PII in
test fixtures), you can:
1. Set `sovereign-base-url` to an EU region (contact support)
2. Add a `.sovereign-review-ignore` file with glob patterns to skip
3. Run the reviewer on a sanitized branch only

## Pricing

- **Free tier**: 50 reviews/month — covers most solo + small team repos
- **Starter**: $19/mo for 500 reviews
- **Growth**: $49/mo for 2,500 reviews
- **Enterprise**: unlimited + SAML SSO + EU hosting

Full pricing: [sovereignmatrix.agency/pricing](https://sovereignmatrix.agency/pricing)

## Why use this instead of GitHub Advanced Security?

They're complementary:
- GHAS is excellent at known CVE scanning + secret detection
- Sovereign Reviewer catches BUSINESS-LOGIC bugs and
  ARCHITECTURE-LEVEL issues that require reading the diff in context
  (not just grep-matching against a database)

We ship the OWASP Top 10 detection plus the kind of thing a senior
human reviewer would flag on their first read. See our
[v8 case study](https://sovereignmatrix.agency/trust/defenders) for
the exact classes of bugs we find.

## Limits

- Diff size cap: 500KB (larger PRs split into smaller ones)
- Review timeout: 120s (typical review completes in 30-60s)
- Languages: TypeScript, JavaScript, Python, Go, Rust, Ruby, Java,
  PHP, C, C++, SQL, YAML

## Support

- Issues: [github.com/christiaan839-beep/sovereign-v2/issues](https://github.com/christiaan839-beep/sovereign-v2/issues)
- Security: [security@sovereignmatrix.agency](mailto:security@sovereignmatrix.agency)
- Questions: [support@sovereignmatrix.agency](mailto:support@sovereignmatrix.agency)

## License

MIT

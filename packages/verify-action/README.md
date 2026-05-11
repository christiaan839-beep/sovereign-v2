# Verify AI Receipts — GitHub Action

Verify [Sovereign Matrix](https://sovereignmatrix.agency) agent-run
receipts referenced in a PR description, commit body, or explicit
input list. Fails the build if any signature is invalid.

> Receipts are HMAC-SHA256-signed projections of an AI agent run.
> One byte changes → signature breaks. This action is the CI net that
> stops tampered, expired, or spoofed receipts from getting merged.

## Quick start

```yaml
# .github/workflows/verify-receipts.yml
name: Verify AI receipts
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: christiaan839-beep/sovereign-v2/packages/verify-action@v1
        with:
          text: ${{ github.event.pull_request.body }}
```

That's the entire setup. Every `https://sovereignmatrix.agency/r/<id>`
or bare receipt id mentioned in the PR description gets fetched,
signature-verified, and reported. If any one is invalid or
unreachable, the build fails.

## Inputs

| Input             | Default                          | Description                                                                                                                  |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `text`            | `""`                             | Free-form text to scan. Pass `${{ github.event.pull_request.body }}` to verify every receipt referenced in a PR description. |
| `receipt-ids`     | `""`                             | Comma-separated receipt ids (32-40 hex chars, dashes ok).                                                                    |
| `receipt-urls`    | `""`                             | Comma-separated full receipt URLs. The action extracts the id.                                                               |
| `verifier-host`   | `https://sovereignmatrix.agency` | Override for white-label customers running their own Sovereign deployment. **Must be HTTPS** (or `localhost` for testing).   |
| `fail-on-invalid` | `true`                           | If `true`, fail the step on any invalid or unreachable receipt. Set `false` for warning-only mode.                           |
| `fail-on-zero`    | `false`                          | If `true`, fail when no receipt ids were found. Default treats empty input as a clean pass.                                  |

## Outputs

| Output              | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `total`             | Total receipt ids attempted                           |
| `verified`          | Count whose signature passed                          |
| `invalid`           | Count whose signature failed (tampered / wrong key)   |
| `unreachable`       | Count that 404'd, errored, or returned malformed JSON |
| `receipt-ids-found` | CSV of unique ids the action attempted                |

## Common patterns

### Verify a receipt CSV in a release tag

```yaml
- uses: christiaan839-beep/sovereign-v2/packages/verify-action@v1
  with:
    receipt-ids: ${{ vars.RELEASE_RECEIPTS }}
    fail-on-zero: true
```

### Verify against a white-label deployment

```yaml
- uses: christiaan839-beep/sovereign-v2/packages/verify-action@v1
  with:
    verifier-host: https://verify.acme-legal.com
    text: ${{ github.event.pull_request.body }}
```

### Warning-only mode (don't block the merge)

```yaml
- uses: christiaan839-beep/sovereign-v2/packages/verify-action@v1
  with:
    text: ${{ github.event.pull_request.body }}
    fail-on-invalid: false
```

## Security model

- **SSRF defense**: only URLs whose origin matches `verifier-host` are
  enumerated. URLs from any other origin (`https://attacker.example/r/...`)
  are dropped before extraction. Bare ids in text are matched only
  after stripping all URL substrings, so an attacker can't smuggle an
  id via a hostile URL fragment.
- **Receipt-id format**: every id (from any input) is sanitized to
  `/^[0-9a-f-]{32,40}$/i` before the HTTP fetch. Anything that
  doesn't match is silently dropped — no shell-injection or
  weird-path-traversal surface.
- **HTTPS-only**: `verifier-host` must use `https://` (with `localhost`
  allowed as a test escape). Plain HTTP is rejected to prevent
  downgrade attacks.
- **Zero dependencies**: the action source is one ~250-line file with
  no transitive deps. Reviewable by hand.

## Building from source

```bash
cd packages/verify-action
npm install
npm test
npm run build      # → dist/index.js (single bundled file)
```

The `dist/index.js` file is committed alongside the source so
GitHub Actions can run the action directly without a build step at
consume time.

## Why this exists

Sovereign Matrix produces cryptographically signed receipts for every
AI agent run. Customers reference those receipts in PR descriptions
("This PR is backed by /r/abc...") and release notes. Without CI
verification, a malicious or careless contributor could reference a
fake id, an expired receipt, or a tampered canonical projection — and
nobody would know until a compliance audit.

This action closes that gap. **Set it once, every PR is checked.**

## License

MIT.

## Related

- [VAOS 1.0 spec](https://sovereignmatrix.agency/spec) — the open
  standard the receipts implement
- [`/api-docs`](https://sovereignmatrix.agency/api-docs) — OpenAPI 3.1
  contract
- [`/mcp`](https://sovereignmatrix.agency/mcp) — same primitives
  exposed as an MCP server (Claude Desktop / Cursor / Continue.dev)

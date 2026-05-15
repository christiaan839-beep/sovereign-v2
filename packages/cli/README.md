# @sovereignmatrix/cli

Verify [Sovereign Matrix](https://sovereignmatrix.agency) agent-run
receipts from your terminal. Single-file Node 20+ ESM, zero dependencies.

## Install + usage

```bash
# One-off (no install)
npx @sovereignmatrix/cli verify <receipt-id-or-url>

# Or install globally
npm i -g @sovereignmatrix/cli
sovereign-verify verify <receipt-id-or-url>
```

## Commands

```
sovereign-verify verify <id-or-url>     Verify a receipt's HMAC signature
sovereign-verify latest                 Show the freshest public receipt
sovereign-verify recent [--limit=N]     Show recent public receipts (default 10)
sovereign-verify --help
```

## Flags

| Flag         | Default                          | What it does                                                                                                                         |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `--host=URL` | `https://sovereignmatrix.agency` | Override the verifier host. Must be `https://` (or `localhost` for testing). White-label deployments point this at their own domain. |
| `--limit=N`  | `10`                             | (recent only) 1–50                                                                                                                   |

## Examples

```bash
# Verify by id
npx @sovereignmatrix/cli verify 00000000-0000-0000-0000-00000000abcd

# Verify by URL (any /r/<id> or /api/agent-runs/<id> URL)
npx @sovereignmatrix/cli verify https://sovereignmatrix.agency/r/abc...

# Browse the freshest public receipt
npx @sovereignmatrix/cli latest

# Pull a feed of recent public receipts
npx @sovereignmatrix/cli recent --limit=20

# Verify against your own white-label deployment
npx @sovereignmatrix/cli verify abc... --host=https://verify.acme-legal.com
```

## Exit codes

- `0` — signature valid (or non-verify commands succeeded)
- `1` — signature invalid, network error, or bad input

Makes it trivial to wire into shell scripts and CI.

## Security

- `--host` is parsed as a URL and required to be `https://` (with `localhost` allowed for tests).
- Receipt IDs are validated against `/^[0-9a-f-]{32,40}$/i` before being used in URL paths — no shell-injection or path-traversal surface.
- Zero runtime dependencies — the entire CLI is one ~200-line file you can audit by hand.

## Related

- [VAOS 1.0 spec](https://sovereignmatrix.agency/spec) — the open standard the receipts implement
- [`/api-docs`](https://sovereignmatrix.agency/api-docs) — OpenAPI 3.1 contract
- [`/mcp`](https://sovereignmatrix.agency/mcp) — same primitives as an MCP server (Claude Desktop / Cursor)
- [`verify-ai-receipts` GitHub Action](https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verify-action) — CI gate

## License

MIT.

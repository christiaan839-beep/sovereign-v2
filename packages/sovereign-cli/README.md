# @sovereignmatrix/cli

> Command-line tool for authoring and submitting **Sovereign Agent Manifest (SAM) v1.0** agents.

```bash
npm install -g @sovereignmatrix/cli
```

## Quick start

```bash
# 1. Write your agent manifest
cat > invoice-extractor.sam.json <<'EOF'
{
  "sam": "1.0",
  "slug": "invoice-extractor",
  "displayName": "Invoice Extractor",
  "purpose": "Extract structured data from invoice text",
  "category": "Finance",
  "version": "1.0.0",
  "inputs": [{ "name": "text", "type": "string", "required": true }],
  "output": { "type": "object" },
  "guarantees": ["Never fabricates missing fields — absent values return null"],
  "pricing": { "cents": 5, "tier": "basic" }
}
EOF

# 2. Validate locally
sovereign validate invoice-extractor.sam.json

# 3. Submit to the marketplace
sovereign submit invoice-extractor.sam.json --email you@example.com
```

## Commands

### `sovereign validate <path>`

Read a SAM v1.0 manifest and validate it against the official spec. Returns a list of errors (with JSON-Pointer paths) or a summary on success.

**Exit codes**

- `0` — valid
- `1` — validation errors
- `3` — file not found / invalid JSON / missing argument

### `sovereign submit <path> [--email <addr>] [--api <url>]`

Validate locally, then POST to `/api/creators/submit`. The response tells you whether the agent was **auto-published** (returns a `liveUrl`) or **queued for operator review** (returns a reference ID).

**Options**

- `--email` — contact email for review correspondence. Optional but strongly recommended; without it you can't receive approval/rejection notifications.
- `--api` — override the API URL (default: `https://sovereignmatrix.agency`). Useful for local dev or staging.

**Exit codes**

- `0` — submission accepted (check output for `status: "live"` vs `"queued"`)
- `1` — manifest rejected (local or server validation)
- `2` — network or server error
- `3` — usage error

### `sovereign info`

Print the CLI version, resolved API URL, and the SAM version this CLI targets. Useful for bug reports.

## Environment

| Variable | Effect |
|---|---|
| `SOVEREIGN_API_URL` | Override the default API URL. Same effect as `--api`. |
| `NO_COLOR` | Disable colored output. |
| `FORCE_COLOR` | Force colored output even when piped. |

## Programmatic API

Most users will invoke the CLI directly; a subset (build pipelines, bespoke integrations) want the commands as importable functions.

```ts
import { runValidate, runSubmit } from "@sovereignmatrix/cli";
import { readFile } from "node:fs/promises";

const result = await runValidate({
  path: "./my-agent.sam.json",
  fs: { readTextFile: (p) => readFile(p, "utf8") },
});

if (result.kind === "failure") {
  console.error(result.message);
  process.exit(result.exitCode);
}
```

Every command takes explicit `FileSystem` and `HttpClient` adapters so your tests can inject fakes instead of touching disk or network.

## Approval policies

Submissions land in one of three policy paths depending on the marketplace's operational posture:

| Policy | Response | Meaning |
|---|---|---|
| `open` | `201 live` | Auto-published. `liveUrl` points to `/marketplace/{slug}`. |
| `curated` | `202 queued` | Held for operator review. Default. |
| `trust-tiered` | `201` or `202` | `202` on first submission per creator, `201` thereafter. |

The CLI surfaces these in its output:

```
✓ Submission accepted — queued for review
  httpStatus      202
  referenceId     SAM-abc12345-c0de
  status          queued
  policy          curated
  reason          curated policy: every submission receives operator review
```

## Docs

- **Tutorial**: https://sovereignmatrix.agency/developers/build-an-agent
- **Spec**: https://sovereignmatrix.agency/spec/agent-manifest
- **Validator**: [@sovereignmatrix/agent-validator](../agent-validator)

## License

MIT

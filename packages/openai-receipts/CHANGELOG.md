# Changelog

All notable changes to `@sovereign-matrix/openai-receipts` are documented
here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
SemVer per <https://semver.org/spec/v2.0.0.html>.

## [0.1.0] — 2026-05-19

Initial release. Drop-in OpenAI SDK wrapper that mints post-quantum-signed
VAOS receipts around chat completions.

### Added

- `mintCompletionReceipt(completion, opts)` — main API. Takes the return value
  of `client.chat.completions.create()` (non-streaming) and produces a signed
  Guardian attestation envelope.
- `withReceipt(completionPromise, opts)` — one-liner convenience that awaits +
  mints in one step.
- Multi-block content support: extracts only the text from
  `message.content` for the canonical projection; ignores tool_use blocks
  (those require the VAOS-RSA streaming primitive for proper commitment).
- Idempotency: `opts.tokenId` defaults to `completion.id` so repeat calls
  with the same completion produce the same receipt.
- Optional Guardian rule packs via `opts.rules` for inference-time policy
  attestation.

### Peer dependencies

- `openai >= 4.0.0`
- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with 3-line install + worked examples for healthcare and finance.
- 15 vitest cases verifying canonical projection, rule-pack integration,
  edge cases (empty completion, multi-block content, custom signer).

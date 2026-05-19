# Changelog

All notable changes to `@sovereign-matrix/anthropic-receipts` are documented
here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
SemVer per <https://semver.org/spec/v2.0.0.html>.

## [0.1.0] — 2026-05-19

Initial release. Drop-in Anthropic SDK wrapper that mints post-quantum-signed
VAOS receipts around Claude messages.

### Added

- `mintMessageReceipt(message, opts)` — main API. Takes the return value of
  `client.messages.create()` (non-streaming) and produces a signed Guardian
  attestation envelope.
- `withReceipt(messagePromise, opts)` — one-liner convenience.
- Multi-block content handling: concatenates text blocks for the canonical
  projection; tool_use blocks are not separately receipt-tracked (that's the
  VAOS-RSA streaming primitive's job).
- Idempotency: `opts.tokenId` defaults to `message.id`.
- Optional Guardian rule packs via `opts.rules`.

### Peer dependencies

- `@anthropic-ai/sdk >= 0.30.0`
- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with 3-line install + clinical-decision-support + EU-AI-Act-Article-9
  worked examples.
- 15 vitest cases.

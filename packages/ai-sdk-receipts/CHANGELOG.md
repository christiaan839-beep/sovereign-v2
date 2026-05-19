# Changelog

All notable changes to `@sovereign-matrix/ai-sdk-receipts` are documented
here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. Universal Vercel AI SDK wrapper — mints post-quantum-signed
VAOS receipts around any provider plugged into the AI SDK (OpenAI, Anthropic,
Google, Mistral, Cohere, etc.).

### Added

- `mintTextReceipt(result, opts)` — for `generateText` / `streamText` results.
- `mintObjectReceipt(result, opts)` — for `generateObject` / `streamObject`
  results; uses recursive `sortObjectKeys` for deterministic JSON
  canonicalization.
- Dual-shape support: accepts both v3/v4 (`promptTokens`/`completionTokens`)
  and v5 (`inputTokens`/`outputTokens`) usage objects.
- Optional Guardian rule packs.

### Peer dependencies

- `ai >= 5.0.0`
- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with worked examples across 4 providers.
- 19 vitest cases verifying object canonicalization edge cases.

# Changelog

All notable changes to `@sovereign-matrix/google-receipts` are documented
here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-05-19

Initial release. Drop-in Google Gemini SDK wrapper that mints post-quantum-
signed VAOS receipts around `generateContent` calls.

### Added

- `mintGenerationReceipt(result, opts)` — main API.
- Multi-candidate text extraction: handles `result.response.candidates[]` per
  the Gemini SDK shape; uses the first candidate's text as the canonical.
- Deterministic tokenId fallback: derives from `(model + promptHash +
candidateIndex)` when `opts.tokenId` is omitted (Gemini results don't
  carry a stable id field by default).
- Optional Guardian rule packs via `opts.rules`.

### Peer dependencies

- `@google/generative-ai >= 0.20.0`
- `@sovereign-matrix/verifiable-receipts >= 0.3.0`

### Documentation

- README with 3-line install.
- 15 vitest cases.

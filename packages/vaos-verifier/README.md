# @sovereign-matrix/vaos-verifier

Reference implementation of the [**Verifiable Agent Output Specification (VAOS) 1.0**](https://sovereignmatrix.agency/spec).

Verify that an AI agent run produced a specific output, with specific
safety checks, signed by its issuer — without trusting the platform.

- **Zero dependencies.** Pure TypeScript + Web Crypto API.
- **Universal.** Node 18+, modern browsers, edge runtimes, Deno.
- **MIT licensed.** Use it in any project, commercial or open.

## Why

Every enterprise blocking AI agent deployment in 2026 cites the same
reason: _"I can't prove what the model did, so I can't put it
anywhere that matters."_ VAOS receipts solve this. This library
verifies them.

If you're building agent infrastructure that emits receipts, ship
them in VAOS format and any consumer of this library can verify
them. If you're a consumer of agent outputs (auditor, compliance
team, customer), you can verify any VAOS receipt without trusting
the platform that produced it.

## Install

```bash
npm install @sovereign-matrix/vaos-verifier
# or pnpm / yarn / bun
```

## Verify a receipt against the issuer's endpoint

The standard third-party verification path. Works without holding
the issuer's signing key.

```ts
import { verifyRemote } from "@sovereign-matrix/vaos-verifier";

const receipt = await fetch("https://example.agency/api/agent-runs/<id>").then(
  (r) => r.json(),
);

const result = await verifyRemote(receipt, {
  baseUrl: "https://example.agency",
});

if (result.valid) {
  console.log(`✓ verified ${result.agentName} @ ${result.createdAt}`);
} else {
  console.error("× receipt is tampered or unsigned");
}
```

`verifyRemote()` re-derives the canonical projection locally from
the receipt's data fields, asserts byte-equality against any
`canonical` echoed by the issuer (defends against a malicious echo),
then POSTs to the issuer's `/api/verify` endpoint.

## Verify locally (issuer side)

If you hold the signing key — i.e. you ARE the issuer — verify
without a network call:

```ts
import { canonicalize, verifyLocal } from "@sovereign-matrix/vaos-verifier";

const canonical = canonicalize(receipt);
const ok = await verifyLocal(
  canonical,
  receipt.signature,
  process.env.AGENT_RUN_SIGNING_SECRET!,
);
```

## Sign a receipt (issuer side)

```ts
import { canonicalize, sign } from "@sovereign-matrix/vaos-verifier";

const canonical = canonicalize({
  id: "00000000-0000-0000-0000-000000000001",
  agentName: "blog-gen",
  modelUsed: "claude-sonnet-4-6",
  input: { topic: "How HMAC works" },
  output: { html: "<p>An overview…</p>" },
  safetyResult: { jailbreak: "pass", pii: "pass" },
  durationMs: 1234,
  createdAt: new Date().toISOString(),
});

const signature = await sign(canonical, process.env.AGENT_RUN_SIGNING_SECRET!);
// → "v1=<64-char-hex>"
```

## Conformance

This library is the normative reference for VAOS 1.0. Every test
vector in [§12 of the spec](https://sovereignmatrix.agency/spec) is
covered by the test suite.

`canonicalize()` produces byte-identical output for the same logical
receipt regardless of:

- JS object key insertion order
- Array element wrapping
- Unicode normalization (TextEncoder uses canonical UTF-8)

`sign()` and `verifyLocal()` use Web Crypto's HMAC-SHA256
implementation, so timing-safe comparison is delegated to the
runtime's primitive (which is constant-time on every modern engine).
The hex-equality fallback in this library uses an XOR accumulator
and is constant-time.

## Spec authority

VAOS is a public-domain (CC0) specification. The reference
implementation (this library) is MIT licensed. Both are intended to
be the basis for an industry standard for verifiable AI agent
outputs — submitted to W3C / IETF / NIST as a candidate format.

If you're building an audit tool, compliance dashboard, or AI agent
runtime, please consider emitting and recognizing VAOS receipts.
The format becomes more valuable to everyone as more parties adopt
it.

Spec: https://sovereignmatrix.agency/spec
Issues: https://github.com/christiaan839-beep/sovereign-v2/issues
Endorsement / partnership: spec@sovereignmatrix.agency

## License

MIT — see [LICENSE](./LICENSE).

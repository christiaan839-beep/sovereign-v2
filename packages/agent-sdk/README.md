# @sovereign-matrix/agent-sdk

[![npm version](https://img.shields.io/npm/v/@sovereign-matrix/agent-sdk.svg)](https://www.npmjs.com/package/@sovereign-matrix/agent-sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Talk to a Sovereign Matrix instance from your own application. Run any of the 140 production agents, verify any receipt, and stream live run events.

Every successful agent call returns a cryptographic receipt — HMAC-SHA256 or Ed25519, with optional ML-DSA-65 (Dilithium3) co-signing for forward-secure long-retention workloads. This SDK validates the receipt locally so tampering is caught before your code sees the response.

---

## Install

```bash
npm install @sovereign-matrix/agent-sdk
# or
pnpm add @sovereign-matrix/agent-sdk
```

## Quick start

```ts
import { SovereignClient } from "@sovereign-matrix/agent-sdk";

const sov = new SovereignClient({
  apiKey: process.env.SOVEREIGN_API_KEY!,
});

const result = await sov.runAgent("lead-blitz", {
  icp: "Cape Town SaaS founders, 5-50 employees",
});

if (result.receipt.verified) {
  console.log(result.output);
}
```

## Verify a receipt

Hand a receipt id to anyone — an auditor, a regulator, a compliance officer — and they can verify it without an API key:

```ts
import { verifyReceipt } from "@sovereign-matrix/agent-sdk";

const r = await verifyReceipt("rcpt_01HYZ...");
console.log(r.verified, r.scheme); // true, "ed25519"
```

## Stream live events

For long-running agents, stream incremental updates and get the receipt at the end:

```ts
for await (const ev of sov.streamAgent("deep-research", { topic })) {
  if (ev.type === "delta") process.stdout.write(String(ev.data));
  if (ev.type === "complete") {
    console.log("\nreceipt:", ev.receipt?.receiptId);
    console.log("verified:", ev.receipt?.verified);
  }
}
```

## Configuration

```ts
const sov = new SovereignClient({
  apiKey: "sk_...",
  // Optional: point at a different host (self-hosted / staging).
  baseUrl: "https://sov.your-domain.com",
  // Optional: override the per-request timeout (default 60s).
  timeoutMs: 120_000,
  // Optional: pass a custom fetch (undici, node-fetch, ...).
  fetchImpl: customFetch,
});
```

## Error handling

Every method throws `SovereignError` on failure, with a `kind` field for clean dispatch:

```ts
import { SovereignError } from "@sovereign-matrix/agent-sdk";

try {
  await sov.runAgent("not-a-real-agent", {});
} catch (err) {
  if (err instanceof SovereignError) {
    switch (err.kind) {
      case "config":
        /* missing/bad apiKey */ break;
      case "network":
        /* timeout, HTTP error */ break;
      case "protocol":
        /* unexpected response shape */ break;
    }
  }
}
```

## Receipt verification — what does it actually mean?

A Sovereign receipt is signed under one of three schemes. The `scheme` field on `VerifyResult` tells you which one was used:

| Scheme              | Wire prefix | Primitive                               | Forward-secure        |
| ------------------- | ----------- | --------------------------------------- | --------------------- |
| `hmac-sha256`       | `v1=…`      | HMAC-SHA256 (shared secret)             | No                    |
| `ed25519`           | `v2=…`      | Ed25519 (asymmetric, public-verifiable) | No                    |
| `ed25519+ml-dsa-65` | `v3=…`      | Ed25519 + Dilithium3 dual-sign          | **Yes** (FIPS 204 PQ) |

For regulated retention horizons of 7+ years (clinical trials, tax audits, defense), prefer Sovereign instances that have ML-DSA-65 co-signing enabled.

## License

Apache 2.0 © Sovereign Matrix

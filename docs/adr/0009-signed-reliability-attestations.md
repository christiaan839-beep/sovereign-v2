# ADR-0009: Cryptographically-Signed Reliability Attestations

**Status:** Accepted (R44)
**Date:** 2026-04-29
**Deciders:** @christiaandewet, Claude (Sovereign Matrix)
**Affects:** `src/lib/reliability-attestation.ts`,
`drizzle/0051_reliability_attestations.sql`,
`src/app/api/cron/sign-reliability-attestation/route.ts`,
`src/app/api/health/reliability/attestation/route.ts`,
`packages/inspector/src/reliability.mjs` (port),
`packages/inspector/src/cli.mjs` (`reliability` + `reliability-verify`)

## Context

The trust stack (R34-R42) makes *agents* verifiable. R27's
`/reliability` page makes the *platform* observable. But platform
reliability claims still rely on the customer trusting our
endpoint. A bad-faith Sovereign could publish "99.9% uptime" while
secretly experiencing outages.

That's the gap R44 closes. **Same trustless pattern as R34/R37/R38/R41/R42**,
applied to the platform's own reliability claims:

> Sign every reliability commitment with the platform master key,
> chain it to the previous attestation, and let customers verify
> the math offline with the inspector. The platform CANNOT lie about
> its own reliability while the inspector watches.

This is the move that converts "we say we're reliable" into
"we *commit* to being reliable, cryptographically, and you can
verify it without trusting our servers."

## Decision

Daily-signed reliability attestations covering:

1. **24h health-snapshot rollup** — pass/fail counts from the R27
   self-heal cron's `platform_health_snapshots` table
2. **Audit chain integrity** — boolean from the R26 audit-chain
   verifier (initially `null`/unknown; future round wires the
   verify-audit-chain cron's most recent result)
3. **Computed uptime %** — `passing / total` over the window
4. **Commitment threshold** — published reliability SLA (default
   99.9%; future round may make this per-tenant for enterprise SLAs)
5. **`metCommitment` boolean** — uptime ≥ threshold AND audit chain
   not explicitly broken

Each attestation is:

- **Ed25519-signed** with the platform master key
- **Hash-chained** to the previous attestation (R26 pattern)
- **Public** at `/api/health/reliability/attestation`
- **Verifiable offline** via `@sovereign/inspector reliability-verify`

## The signed canonical message

```
v1
reliability-attestation
window:{windowStart}|{windowEnd}
snapshots:{passing}/{total} (failing:{failing})
uptimePct:{uptimePct}
threshold:{commitmentThresholdPct}
metCommitment:{true|false}
auditChainIntact:{true|false|unknown}
auditChainTotalRows:{n|unknown}
auditChainFirstBrokenId:{id|none|unknown}
```

Same key-order-deterministic format as R34 CADC + R38 KYA. Verifiers
reconstruct the message from the signed fields and check signature.

## What goes in the row

```sql
reliability_attestations (
  id, window_start, window_end,
  total_health_snapshots, passing_health_snapshots, failing_health_snapshots,
  audit_chain_intact, audit_chain_total_rows, audit_chain_first_broken_id,
  uptime_pct, met_commitment, commitment_threshold_pct,
  attestation_message, attestation_signature, platform_public_key,
  previous_chain_hash, chain_hash, created_at
)
```

## Master signing key — operator setup

Production operators MUST set:

```bash
SOVEREIGN_PLATFORM_PRIVATE_KEY=<base64url Ed25519 private>
SOVEREIGN_PLATFORM_PUBLIC_KEY=<base64url Ed25519 public>
```

Generate once with the inspector library:

```js
import { generateKeyPair } from "@sovereign/inspector/verify";
const kp = generateKeyPair();
console.log(kp.publicKey, kp.privateKey);
```

If unset in dev, the lib generates an ephemeral pair on boot.
**Production attestations signed without these env vars cannot be
verified across deploys** — every deploy regenerates a fresh key.

The public key is published in:

- Every attestation row (`platform_public_key`)
- `/.well-known/sovereign-trust` (R36 federation discovery — to be
  extended in R45)

## Trustless verification flow

```bash
$ sovereign-inspect reliability-verify https://sovereignmatrix.agency

[1/3] Fetching latest attestation…  ok
[2/3] Verifying canonical message reconstruction…  ok
[3/3] Verifying Ed25519 signature…  ok

Reliability attestation:
  Window:                 2026-04-28 00:00 → 2026-04-29 00:00 UTC
  Health snapshots:       24/24 passing
  Uptime:                 100.00%
  Commitment threshold:   99.90%
  Met commitment:         ✓
  Audit chain intact:     unknown (verifier not yet wired)
  Signature:              ✓ valid against published platform key
  Chain hash:             ✓ matches recompute

The platform's reliability claim is mathematically correct.
```

## Alternative considered: continuous real-time signing

Rejected. Real-time signing creates whipsaw during outages (the
attestation flips back and forth between green/red as snapshots
arrive). Daily cadence creates a stable, graphable signal that
matches the SLA window we'd actually contractually commit to.

## Alternative considered: third-party witness

Rejected for v1. A future round (R45+) may post the attestation
chain hash to a public chain (Bitcoin OP_RETURN, IPFS, Ethereum)
for ultra-strong tamper-evidence. v1 is just the platform key —
already strong, already trustlessly verifiable.

## Alternative considered: multi-key threshold signing

Rejected for v1. Single platform key is simpler. Future round can
upgrade to k-of-n threshold (e.g. 2-of-3 across HSMs) without
breaking the verifier — the public key field is opaque to consumers.

## Consequences

### Positive

- **First production agent platform with cryptographically-signed
  reliability claims.**
- Procurement-ready: customers can run `npx @sovereign/inspector
  reliability-verify <url>` as a fixed-format compliance gate.
- Composes with R26 audit chain (chain integrity feeds the
  attestation), R27 self-heal cron (snapshots feed the rollup).
- Standards position: the canonical message format becomes a
  candidate primitive for "Sovereign Trust 1.0" RFC.
- Customer SLA disputes are settled by the immutable chain — no
  "trust our dashboard" required.

### Negative

- **Master key compromise is catastrophic** — if the platform
  private key leaks, an attacker can forge attestations.
  Mitigation: HSM-backed key in production (R45+).
- **Audit chain integrity is initially `null`** — the verifier-cron
  wiring is a future round. The honest "unknown" sentinel is shipped
  in v1.
- **Daily cadence means the latest attestation may be up to 24h old**
  — fine for SLA-period commitments, possibly insufficient for
  "right now is the platform up?" use cases. Use `/api/health/ping`
  for liveness; this for cumulative SLA.

### Mitigations

- Master key: store in env var, rotate annually, future R45+ moves
  to HSM. Public key rotation is forward-safe (each attestation
  embeds the public key in effect at signing time).
- Audit chain wiring: documented as "TODO when verify-audit-chain
  cron persists results". Ships honestly as `null` until then.
- Real-time gap: the `/api/health/ping` endpoint is the live signal;
  attestations are the cumulative commitment.

## Implementation

- `drizzle/0051_reliability_attestations.sql` — table
- `src/lib/reliability-attestation.ts` — pure-function signer + verifier
- `src/app/api/cron/sign-reliability-attestation/route.ts` — daily cron
- `src/app/api/health/reliability/attestation/route.ts` — public GET
- `vercel.json` — register the cron
- `packages/inspector/src/reliability.mjs` — port for offline verification
- `packages/inspector/src/cli.mjs` — `reliability-verify` command
- `scripts/weekly-health.mjs` — anti-drift invariants

## Strategic frame

After R44, Sovereign's positioning becomes:

> *Sovereign Matrix is the only agentic platform that signs its own
> reliability commitments cryptographically. We don't claim 99.9%
> uptime — we sign 99.9% uptime, daily, hash-chained, with a public
> verifier any customer can run offline. Trust is math, not marketing.*

This is the substrate for:

- **R45:** Audit-chain integrity wiring (verify-audit-chain feeds the
  attestation).
- **R46:** Federation v2 — every Sovereign deployment publishes its
  attestation chain; cross-deployment SLA mirroring.
- **R47:** Threshold signing / HSM key management.
- **R48:** Public-chain anchoring (attestation chain hash → Bitcoin
  / IPFS for tamper-evident timestamping).
- **IETF RFC:** "reliability commitment" as a recommended primitive
  in Sovereign Trust 1.1.

R44 is the round that converts *observable reliability* into
*verifiable, signed commitment*.

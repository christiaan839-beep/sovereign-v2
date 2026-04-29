# @sovereign/inspector

> **Trustless verifier for Sovereign Matrix.** Verify any deployment's
> audit chain, delegation chain, HITL routing policy, and platform
> health WITHOUT trusting the platform itself. All verification math
> runs locally on your machine.

[![npm](https://img.shields.io/npm/v/@sovereign/inspector.svg)](https://www.npmjs.com/package/@sovereign/inspector)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What is this?

Most "compliance" claims by software platforms boil down to *"trust
us, we hash it."* Sovereign Matrix takes the opposite stance:
**don't trust us — verify us.**

This package gives third parties (auditors, customers, competitors,
regulators) the cryptographic primitives to verify Sovereign trust
artifacts independently. If our claims are true, your verification
passes locally. If we ever lied, your verification fails immediately.

The math is the truth — Sovereign servers cannot be a trust anchor
because the cryptography is reproducible.

## Install

```bash
npm install -g @sovereign/inspector
```

Requires Node 20+.

## CLI usage

```bash
# Run all checks against a Sovereign deployment
sovereign-inspect full https://sovereignmatrix.agency

# Show the SHIPPED HITL routing policy (procurement-readable)
sovereign-inspect policy https://sovereignmatrix.agency

# Self-service deploy diagnostic
sovereign-inspect diagnose https://sovereignmatrix.agency

# Verify a delegation locally — math runs on YOUR machine, not their server
echo '{"userPublicKey":"...", "delegation":{...}}' | \
  sovereign-inspect delegation https://sovereignmatrix.agency

# Verify an audit log array (paste from /api/admin/audit/...)
sovereign-inspect audit-chain < audit.json
```

Exit codes:
- `0` — all verifications pass
- `1` — one or more verifications failed
- `2` — usage / argument error

## Library usage

```js
import {
  verifyDelegation,
  verifyAgentAction,
  verifyAuditChain,
} from "@sovereign/inspector/verify";

const result = verifyDelegation({
  delegation: {
    userId: "user_alice",
    agentName: "travel-agent",
    agentPublicKey: "...",
    scope: { max_cents: 5000 },
    issuedAt: "2026-04-28T00:00:00Z",
    expiresAt: "2027-04-28T00:00:00Z",
    delegationMessage: "v1\nuser:user_alice\n...",
    userSignature: "...",
  },
  userPublicKey: "...",
});

if (result.valid) {
  console.log("Delegation cryptographically valid");
} else {
  console.error(`Invalid: ${result.reason}`);
}
```

## What gets verified

### Delegation chain

- Ed25519 signature over canonical delegation message
- Expiry not yet reached
- Revocation signature (if any) is also signed by the same user key
  — defends against forged kill-switch attempts

### Per-action signatures

- Agent's signature over the action digest
- Chain hash matches: `sha256(prev_hash || action_digest || agent_signature)`
- Tampering with any past row breaks every subsequent chain hash

### Audit log chain (R26 pattern)

- Each row's `row_hash = sha256(prev_hash || userId || action || resource || details_canonical || createdAt_iso)`
- Walks the entire chain forward; reports the FIRST broken row

## Why this matters

Most agent platforms ship audit/compliance features as **claims**.
The verifier matters when:

1. **Customer disputes:** "the agent did X without my approval" can
   be settled by a third-party verification of the signature chain.
2. **Procurement audits:** auditors run this CLI on your deployment
   without needing your source access or staff time.
3. **Acquisition risk:** if Sovereign ever vanishes, customers can
   still verify their historical audit trails forever — the math
   survives our company.
4. **Competitive trust:** any vendor claiming "we're audited" can be
   asked: "publish a verifier I can run myself." Most can't.

## Implementation notes

- Pure Node 20+ — no external dependencies beyond `node:crypto`
- Ed25519 (RFC 8410) for signatures
- Canonical JSON for hash determinism
- All functions are pure given their inputs (no I/O, no clock unless explicit)
- Identical implementation to the server-side `src/lib/agent-delegation.ts`
  in [github.com/christiaan839-beep/sovereign-v2](https://github.com/christiaan839-beep/sovereign-v2)

## License

MIT

## Links

- [Sovereign Matrix](https://sovereignmatrix.agency)
- [Agentic Commerce documentation](https://sovereignmatrix.agency/agentic-commerce)
- [Public reliability page](https://sovereignmatrix.agency/reliability)
- [HITL policy endpoint](https://sovereignmatrix.agency/api/health/hitl-policy)

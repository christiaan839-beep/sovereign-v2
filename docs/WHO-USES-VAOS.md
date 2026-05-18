# Who Uses VAOS

A living record of organizations issuing AI agent receipts under the
Verifiable Agent Output Specification.

This file is the human-readable companion to the machine-readable
registry at `src/lib/vaos-issuers.ts` (served as JSON at
`/.well-known/sovereign-receipts/issuers.json`). New entries land
via PR — see `docs/WHY-VAOS.md` §"What we ask in return" for the
governance rules.

Last updated: 2026-05-18.

---

## How to read this page

Each entry is a brief case study answering five questions:

1. **What workflow is signed?** — Which AI agent's output gets
   wrapped in a VAOS receipt.
2. **Which scheme?** — v1 (HMAC) / v2 (Ed25519) / v3 (Ed25519 +
   ML-DSA-65 dual-sign).
3. **Which Guardian packs?** — Pre-built rule sets composed into
   the agent's verdict envelope.
4. **What changed for them?** — The before-and-after of adoption.
5. **Public verification URL** — A click-and-verify pointer a
   procurement reviewer can use to confirm the case study isn't
   marketing fiction.

---

## Issuer #001 — Sovereign Matrix (founding issuer)

| Field                     | Value                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------- |
| **Domain**                | `sovereignmatrix.agency`                                                              |
| **Country**               | South Africa (ZA)                                                                     |
| **Active since**          | 2026-05-01                                                                            |
| **Schemes**               | v1, v2, v3                                                                            |
| **Guardian packs in use** | HIPAA, SR 11-7, NAIC, DSCSA, CSRD, CFPB, MAS, FCA, PCI DSS, EU AI Act, NYDFS Part 500 |
| **Public pubkey**         | https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem             |
| **Transparency log**      | https://sovereignmatrix.agency/api/transparency                                       |
| **Public sample bundle**  | https://sovereignmatrix.agency/sample-bundle.json                                     |
| **Security contact**      | security@sovereignmatrix.agency                                                       |

### What workflow is signed

Every output from the platform's 140 production agents — lead
research, content generation, voice calls, contract analysis, claims
triage, ICSR triage, etc. The reference implementation of VAOS 1.0/
2.0/3.0 and the AI Receipt Transparency Log.

### Which scheme

v2 (Ed25519) by default; v3 (dual-signed) when
`AGENT_RUN_MLDSA65_PRIVATE_KEY` is configured. Falls back to v1
(HMAC) when no Ed25519 key is provisioned.

### What changed

This is the founding implementation — the case study is "we wrote
the spec; here's how we use it ourselves." Every receipt the
platform issues auto-appends to the public transparency log; every
buyer can verify any receipt without an account.

### Public verification

```bash
# Download the sample bundle + public key
curl -O https://sovereignmatrix.agency/sample-bundle.json
curl -O https://sovereignmatrix.agency/sample-bundle.ed25519.pem

# Verify with the OSS CLI
npx @sovereign-matrix/verifiable-receipts verify \
  --manifest ./sample-bundle.json \
  --pubkey ./sample-bundle.ed25519.pem
# → exit 0; MANIFEST VERIFIED
```

---

## Issuer #002 — _(your name here)_

This template is what a new adopter fills in. Copy the §"Issuer
#001" block above, replace every value, and open a PR. Approval is
within 48 hours; the only gate is that the published Ed25519 pubkey
URL actually serves a valid PEM with `Access-Control-Allow-Origin: *`
and the security contact replies to a test email.

```
| Field | Value |
| --- | --- |
| **Domain** | example.com |
| **Country** | (ISO 3166-1 alpha-2) |
| **Active since** | YYYY-MM-DD |
| **Schemes** | (subset of v1, v2, v3) |
| **Guardian packs in use** | (subset of the 11 available, or "custom") |
| **Public pubkey** | https://example.com/.well-known/sovereign-receipts/ed25519.pem |
| **Transparency log** | (optional — your /api/transparency base URL) |
| **Public sample bundle** | (optional — a known-good signed bundle others can verify) |
| **Security contact** | security@example.com |
```

---

## Why this list matters

A coordination Schelling point. As more issuers appear, the registry
becomes the canonical answer to "who supports VAOS?" — and the answer
itself drives further adoption. Procurement teams reading this page
to confirm their vendor isn't bluffing about VAOS support land on the
same single source of truth.

The list is also append-only and PR-driven. Every addition is git-
verifiable; every claim a vendor makes about VAOS compliance can be
checked against this file's history. No "we used to support VAOS but
silently dropped it" — that requires a public delete commit, which is
itself a signal.

---

## Cross-witness arrangement (recommended)

When a second issuer joins, both should run the OSS witness CLI
against each other's transparency logs:

```bash
# At Sovereign Matrix, we run:
npx @sovereign-matrix/verifiable-receipts-witness \
  --url https://issuer-two.example \
  --key /etc/sovereign/witness-key.pem \
  --witness-id "Sovereign Matrix (cross-witness)" \
  --public-key-url https://sovereignmatrix.agency/.well-known/sovereign-receipts/ed25519.pem \
  --interval 3600

# At Issuer #002, they run:
npx @sovereign-matrix/verifiable-receipts-witness \
  --url https://sovereignmatrix.agency \
  --key /etc/issuer-two/witness-key.pem \
  --witness-id "Issuer Two (cross-witness)" \
  --public-key-url https://issuer-two.example/.well-known/sovereign-receipts/ed25519.pem \
  --interval 3600
```

Now every STH on either side carries the other party's cosignature.
Neither can fork their log without the other detecting it. The trust
network scales by N² witness pairs as the registry grows.

---

## License

This document is **CC0 1.0 (public domain)**. Republish, fork, embed
in your procurement materials without restriction.

For questions / corrections: `spec@sovereignmatrix.agency`.

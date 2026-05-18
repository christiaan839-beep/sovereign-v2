# Why VAOS — for any AI vendor evaluating adoption

**Audience:** the engineering lead at an AI vendor (commercial or in-house) whose buyers are asking compliance questions and whose lawyers are asking integrity questions.

**Reading time:** 4 minutes. **Decision required:** whether to spend ~2 days adopting the wire format.

---

## The single sentence

You will need cryptographically signed, third-party-verifiable AI receipts in 2026. **The question is whether you write your own (4–8 weeks plus an external audit) or adopt a public-domain spec maintained by people whose only product is the spec** (~2 days plus a PR).

## What VAOS gives you that internal logs don't

| Capability                                                                 | Internal logs | VAOS                               |
| -------------------------------------------------------------------------- | ------------- | ---------------------------------- |
| Customer or regulator can verify a decision without your cooperation       | ✗             | ✓                                  |
| Detect tampering without trusting the database that holds the logs         | ✗             | ✓                                  |
| Compatible across the post-quantum cryptography transition                 | ✗             | ✓ (v3 dual-sign)                   |
| Verifiable in 2040 even if you no longer exist                             | ✗             | ✓ (npm tarball is immutable)       |
| Already mapped to HIPAA / SR 11-7 / NAIC / DSCSA / CSRD / CFPB / MAS / FCA | partial       | ✓ (8 packs Apache-2.0)             |
| Independent witnesses prove publication ordering                           | ✗             | ✓ (transparency log + witness API) |
| No vendor lock-in                                                          | depends       | ✓ (CC0 spec, Apache-2.0 ref impl)  |

## The two costs people worry about — neither is real

**"Won't this leak data?"** No. The receipt body is whatever you put in it. PII should be redacted before signing (the spec is explicit about this — `docs/specs/vaos-2.0.md §8`). What gets published is whatever you choose to publish; the signature is over your canonical bytes.

**"Won't this lock me into your platform?"** No. The spec is CC0 public domain. The reference implementation is Apache-2.0 on npm. The receipt format works whether you ever talk to us. The only thing that requires us is the `/vaos` adoption registry — and the registry is a JSON file in a public repo; anyone can fork it.

## What adoption actually looks like

```bash
# 1. Generate a keypair (single command, offline)
openssl genpkey -algorithm Ed25519 -out ed25519-private.pem
openssl pkey -in ed25519-private.pem -pubout -out ed25519-public.pem

# 2. Sign your first receipt
npm install @sovereign-matrix/verifiable-receipts
npx @sovereign-matrix/verifiable-receipts-sign \
  --input ./your-agent-output.json \
  --key ./ed25519-private.pem \
  --out ./signed.json

# 3. Verify it
npx @sovereign-matrix/verifiable-receipts verify \
  --manifest ./signed.json \
  --pubkey ./ed25519-public.pem
# → exit 0, MANIFEST VERIFIED

# 4. Publish your public key
# Serve ./ed25519-public.pem at:
#   https://YOUR-DOMAIN/.well-known/sovereign-receipts/ed25519.pem
# with Access-Control-Allow-Origin: *

# 5. Open a PR adding yourself to the registry
# Edit src/lib/vaos-issuers.ts in the sovereign-v2 repo.
```

The whole thing is a half-day for a competent engineer. Add **another half-day** to wire `verifiable-receipts-sign` into your agent runtime so every output gets signed automatically.

## The three things that survive your company

1. **The math.** SHA-256, Ed25519, and ML-DSA-65 are NIST-standardized primitives that will work in 2050.
2. **The npm tarball.** Once published, a version is immutable. A receipt signed today verifies in 2040 if the verifier can install the same version.
3. **The Bitcoin anchor.** Tree heads anchor to Bitcoin via OpenTimestamps. The chain pins the timestamp without trusting any operator — including us, including you.

Even if Sovereign Matrix (the company) disappears, every VAOS-signed receipt you've ever issued remains independently verifiable by any third party. **That's the durability promise**, and you can't get it from a SaaS vendor's audit log.

## What we ask in return

Nothing financial. The wire format is CC0; the reference implementation is Apache-2.0. We ask:

1. **Use the format faithfully.** If you say "VAOS 2.0 compliant", verifiers should be able to verify your receipts using only the published spec and your published public key. Don't fork the canonical projection.
2. **Open a registry PR** if you want your name on `/vaos`. The cost is the time it takes to write `{ id, name, country, ed25519PublicKeyUrl, schemes, activeSince, securityContact }` in `src/lib/vaos-issuers.ts`.
3. **Disclose vulnerabilities** to `security@sovereignmatrix.agency` before public posting if you find a flaw in the spec or reference implementation. 48-hour response, 5-business-day resolution window, no legal action against good-faith researchers.

## Comparison to what you could build instead

| Option                      | Engineering time   | Audit cost                                  | Spec maintenance | Network effect   |
| --------------------------- | ------------------ | ------------------------------------------- | ---------------- | ---------------- |
| Roll your own               | 4–8 weeks          | $30–50K (Trail of Bits / NCC Group)         | ongoing, yours   | none             |
| Use a SaaS audit-log vendor | 1 week integration | minimal                                     | none, theirs     | none (locked in) |
| Adopt VAOS                  | 2 days             | already done (ongoing — community-reviewed) | none, ours       | ✓                |

## When VAOS is the wrong choice

Honest disclosure:

- **You don't care about regulated buyers.** If your product never touches HIPAA / SR 11-7 / NAIC / EU AI Act / equivalents, the wire format is overhead with no payoff.
- **Your receipts contain PII you can't redact.** VAOS doesn't help if the _legal requirement_ is that the receipt body itself never leaves your secure boundary. Signing is fine; publishing the leaf to a transparency log is not.
- **You're shipping in 2027 with a model that doesn't exist yet.** If your retention horizon is < 18 months, the post-quantum hedge in VAOS 3.0 is unnecessary; you can stay on v2 forever. That's fine and explicit in the spec.

For everyone else — **VAOS is a 2-day cost for a 10-year benefit.** That math is hard to beat.

## Where to start

1. Read [`docs/specs/vaos-2.0.md`](./specs/vaos-2.0.md) (the wire format spec, ~5 pages).
2. Try the [reference impl](https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts) on a single agent output you already have.
3. Open a PR adding yourself to [`src/lib/vaos-issuers.ts`](../src/lib/vaos-issuers.ts).
4. (Optional but recommended) Run a witness on our transparency log: `npx @sovereign-matrix/verifiable-receipts-witness --url https://sovereignmatrix.agency --key ./your-witness-key.pem --witness-id "Your Name" --interval 3600`. Once you have your own transparency log, ask us to witness yours.

If something is unclear, blocks your adoption, or you disagree with a design choice — `spec@sovereignmatrix.agency`. We will read it. The wire format gets better the more issuers push on it.

---

**License:** CC0 1.0 (public domain). Reuse, fork, cite, republish without restriction. Attribution appreciated but not required.

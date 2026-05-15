# Security Policy — Sovereign Matrix

**Contact:** [security@sovereignmatrix.agency](mailto:security@sovereignmatrix.agency)
**Coordinated disclosure URL:** https://sovereignmatrix.agency/.well-known/security.txt
**Last reviewed:** 2026-05-15

---

## Reporting a vulnerability

Email **security@sovereignmatrix.agency** with:

1. A short description of the issue.
2. Affected endpoint(s), tenant scope, or library function.
3. Reproduction steps (if applicable). Avoid sharing real customer data — synthetic test data is fine.
4. Your preferred contact channel for follow-up.

**Response SLOs:**

- Acknowledgement within **24 hours**.
- Initial triage within **72 hours**.
- Fix or mitigation in production within **14 days** for critical issues, **30 days** for high, **90 days** for medium.

**Safe-harbor:** We will not pursue legal action against good-faith researchers who follow this policy. No disruption of service, no data exfiltration beyond the minimum needed to demonstrate the issue, no attempts at lateral movement across tenants.

---

## Out of scope

- Reports from automated scanners with no demonstration of exploit.
- Issues in third-party services we don't operate (Stripe, Clerk, Neon, Vercel). Report those upstream.
- Best-practice findings without security impact (header misconfigurations that don't change attacker capability, missing rate-limit on read-only public surfaces, etc.).
- Social engineering of Sovereign employees / contractors.
- DoS via volumetric attack.

---

## Cryptographic primitives in scope

Issues in any of these are particularly interesting:

| Module                                   | What it does                                          |
| ---------------------------------------- | ----------------------------------------------------- |
| `src/lib/anon-credential.ts`             | Anonymous capability tokens (BBS+-shape, HMAC-SHA256) |
| `src/lib/model-fingerprint.ts`           | Provider/model identity commitment in receipts        |
| `src/lib/receipt-chain.ts`               | Merkle-chain receipt structure                        |
| `src/lib/receipt-ratchet.ts`             | Tamper-evident receipt chain                          |
| `src/lib/receipt-envelope-disclosure.ts` | Selective-disclosure envelopes                        |
| `src/lib/watermark.ts`                   | Content watermarking                                  |
| `src/lib/zk-pass-rate.ts`                | Cross-tenant pass-rate proofs                         |
| `src/lib/envelope-encryption.ts`         | AES-256-GCM with KEK/DEK split                        |
| `src/lib/timestamp-authority.ts`         | RFC 3161-style timestamping                           |

Receipts are signed under HMAC-SHA256 + Ed25519. We are interested in:

- Canonical-projection ambiguity (two distinct receipts producing the same hash).
- Cross-protocol attacks (a primitive's MAC reusable in a different module's protocol).
- Constant-time-compare violations.
- Replay vectors that survive idempotency tracking.

---

## Authentication / authorization

The auth surface uses Clerk + Sovereign-internal RBAC (`src/lib/rbac.ts`).

Issues we want to know about:

- Tenant boundary crossings (any path where a user of tenant A can read/write data scoped to tenant B).
- Auth bypass on agent endpoints (the catch-all at `src/app/api/agents/[...slug]/route.ts` is the canonical gateway).
- Webhook signature bypass for any of: Stripe, Clerk, Cal.com, HubSpot, Twilio, Telegram, Yoco, Paystack, PayFast, Coinbase Commerce.
- Privilege escalation in the admin surfaces (`/admin/*`).

---

## Payment-handling

Stripe processes all card data — we never see PAN. The hot paths are:

- `src/app/api/_payments/stripe/checkout/route.ts` (tier plans)
- `src/app/api/_payments/stripe/addon-checkout/route.ts` (Cook 143 add-ons)
- `src/app/api/_payments/stripe/webhook/route.ts` (lifecycle + provisioning)
- `src/lib/add-on-provisioner.ts` (post-payment seat issuance)
- `src/lib/idempotency.ts` (event dedup)

Webhook events older than 5 minutes are rejected. Each event is deduped via the `stripe:event` idempotency namespace. Provisioning is idempotent on the event id.

---

## AI-specific safety

The output pipeline runs 5 verifier layers in parallel:

1. LlamaGuard (content classification)
2. PII detection
3. Content-policy regex / classifier
4. Quality scoring
5. Trust gate (`src/lib/output-guard.ts`)

Jailbreak attempts go through `src/lib/jailbreak-detect.ts`. Reports of bypasses are in scope.

---

## Acknowledgments

If your report results in a fix, with your permission we will list you here:

_(none yet — be the first)_

---

## Bug bounty (planned)

A formal bounty program is on the roadmap once we reach the seed milestone. In the interim, eligible reports may receive a one-time honorarium at our discretion — describe what you'd like in your report.

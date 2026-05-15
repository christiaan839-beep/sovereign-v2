# Sovereign payments — centralized, hybrid, and self-custody

Sovereign accepts money through three independently-wired stacks. They
coexist: every paid plan can be bought with any of them. Buyers pick
the one whose trust model they're comfortable with.

| Mode                        | Provider                            | Asset on wire                              | Settlement                       | Who you trust             |
| --------------------------- | ----------------------------------- | ------------------------------------------ | -------------------------------- | ------------------------- |
| **Centralized — card**      | Stripe (global) + Yoco/PayFast (SA) | Fiat                                       | Fiat                             | Card networks + processor |
| **Hybrid — hosted crypto**  | Coinbase Commerce                   | BTC / ETH / USDC / DAI / LTC / DOGE / SHIB | Fiat or crypto (merchant-choice) | Coinbase (escrow)         |
| **Self-custody — on-chain** | Direct wallet → merchant address    | USDC on Base                               | USDC on Base                     | Only the L2 chain         |

All three flip the same `subscriptions` row to `status = "active"`,
which is what plan-enforcement reads. The audit log records which
provider activated the row, so support can answer "how did this
customer pay?" without database archaeology.

---

## 1. Centralized — Stripe & Yoco

Already wired. Stripe is the global primary; Yoco is the South African
EFT/SnapScan fallback. PayFast and Paystack remain as additional SA
processors via `src/lib/payments.ts`.

Files:

- `src/app/api/_payments/stripe/checkout/route.ts`
- `src/app/api/_payments/stripe/webhook/route.ts`
- `src/app/api/payments/yoco/checkout/route.ts`

Env:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`

---

## 2. Hybrid — Coinbase Commerce

Accept BTC / ETH / USDC / DAI / LTC / DOGE / SHIB via Coinbase's hosted
checkout. The buyer pays in a decentralized asset; we still trust a
single party (Coinbase) for the webhook. Lower-friction than running a
wallet, higher-trust than self-custody.

**Wired files:**

- `src/lib/coinbase-commerce.ts` — charge creation + signature verify
- `src/app/api/_payments/crypto/checkout/route.ts` — POST → hosted URL
- `src/app/api/_payments/crypto/webhook/route.ts` — `charge:confirmed` → activate sub

**Setup (10 minutes):**

1. Create a Coinbase Commerce account: <https://beta.commerce.coinbase.com>.
2. Settings → API keys → copy into `COINBASE_COMMERCE_API_KEY`.
3. Settings → Notifications → Add endpoint:
   - URL: `https://<your-host>/api/payments/crypto/webhook`
   - Events: `charge:confirmed` (required), `charge:failed` (optional)
   - Copy "Shared secret" → `COINBASE_COMMERCE_WEBHOOK_SECRET`.
4. Settings → Account → choose settlement preference: USD (less crypto
   exposure) or per-asset hold.

**Charge lifecycle:**

```
created → pending (buyer paid, awaiting confirms) →
  confirmed (sub activated)         ← we act here
  | failed / expired (no action)    ← acknowledged 200, no DB write
```

Crypto charges are one-time. We stamp `currentPeriodEnd = now + 30
days`; plan-enforcement downgrades back to free at expiry. Continuous
access = pay again before expiry (this is the on-chain norm; there's
no native recurring-billing primitive on L1/L2 without a smart
contract).

---

## 3. Self-custody — direct USDC on Base

**Status: documented, not wired by default.** Enable when a customer
asks; the lift is ~1 day.

The trust model: buyer sends USDC directly to a merchant address you
control on Base (Ethereum L2, ~$0.01 fees, ~2s confirmation). No
middleman. We verify on-chain by polling for a confirmed transaction
to our address with the buyer's userId encoded in the calldata or in
a deterministic payment id (memo via separate JSON entry).

**Why Base, not Ethereum mainnet:**

- L1 gas costs would dwarf a $49/month invoice.
- Base is the canonical L2 for USDC: native, ~$0.01 per tx, instant
  finality from the buyer's POV.

**Outline of implementation:**

1. Generate per-charge merchant address (HD wallet, BIP-32 derivation
   path indexed by chargeId) — buyer pays to that specific address,
   not your hot wallet. Mixes are easy to trace.
2. Display QR + address + exact-cent amount on a checkout page.
3. Background job (cron, 30s) polls Base RPC for confirmed transfers
   to that address ≥ the invoice amount. On confirmation, activate the
   sub (same upsert as the Coinbase webhook).
4. After 24h with no payment, mark the charge expired and rotate the
   address.

**Why we don't ship this by default:**

- Most buyers aren't on Base yet; bridging from L1 or other chains
  raises friction back to Coinbase-Commerce-level anyway.
- The audit lift for KYC/AML reasons is heavier — without Coinbase as
  a chokepoint, SAR-style reporting is on us.
- The first 90% of customers pay with cards. We'd rather ship more
  product than chase the last 5% who insist on self-custody.

When a customer asks, point them at this doc, and we can wire it in a
day. The Drizzle schema already has the columns; the work is the
polling job + the address-generation helper.

---

## Audit trail

Every successful charge writes an entry to `audit_logs`:

```
{
  actorType: "system",
  action: "subscription.activated",
  provider: "stripe" | "yoco" | "coinbase" | "base-onchain",
  amountUsd: number,
  chargeId: string,
}
```

Support can answer "how did this customer pay?" in one SQL query. The
audit log row is HMAC-signed (see `src/lib/agent-runs.ts`) so it is
tamper-evident.

---

## Why three modes

Different buyer profiles:

- **Enterprise / SMB** — wants a card receipt, an invoice, and a known
  refund path. Stripe wins.
- **Crypto-native operator** — has BTC/ETH already, doesn't want to
  cash out for SaaS. Coinbase Commerce wins.
- **Privacy maximalist / corporate treasury on-chain** — only pays
  from a known wallet, has its own KYC stack. Self-custody wins.

Refusing any of the three drops customers. Wiring all three is one
afternoon and a docs page.

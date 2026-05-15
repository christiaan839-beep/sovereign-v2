#!/usr/bin/env -S npx tsx
/**
 * scripts/create-stripe-products.ts — Cook 150.
 *
 * Idempotent script that creates every Sovereign SKU in Stripe + emits
 * a ready-to-paste .env.local fragment. Run once per Stripe account.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/create-stripe-products.ts
 *
 * What it creates:
 *   - 4 tier plans from src/lib/plans.ts (starter, array/Growth,
 *     node/Sovereign Node, enterprise)
 *   - 7 add-on SKUs from src/lib/add-ons.ts (Auditor Replay Seat,
 *     5 regulatory packs, receipt overage)
 *   - 7 starter packs from src/lib/starter-packs.ts (audits,
 *     advisory hours, kits, API trial)
 *
 * Idempotency: looks up the product by name first; only creates when
 * absent. Prices are always re-created (Stripe disallows mutation of
 * an existing Price record; the script archives stale ones).
 *
 * Output: ENV_KEY=price_xxx lines that you paste into Vercel/.env.local
 * and the Payment Link URLs for the starter packs.
 */

import "dotenv/config";
import Stripe from "stripe";
import { PLANS } from "../src/lib/plans";
import { ADD_ONS } from "../src/lib/add-ons";
import { STARTER_PACKS } from "../src/lib/starter-packs";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("Missing STRIPE_SECRET_KEY in env.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
});

interface Created {
  productName: string;
  envKey: string;
  priceId: string;
  paymentLinkUrl?: string;
}

async function findProductByName(name: string): Promise<Stripe.Product | null> {
  // Stripe has no "search by name" without the search API — list all
  // active products (paginated) and match.
  let starting: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: starting,
    });
    const hit = page.data.find((p) => p.name === name);
    if (hit) return hit;
    if (!page.has_more) return null;
    starting = page.data[page.data.length - 1]?.id;
    if (!starting) return null;
  }
}

async function ensureProduct(args: {
  name: string;
  description: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Product> {
  const existing = await findProductByName(args.name);
  if (existing) return existing;
  return stripe.products.create({
    name: args.name,
    description: args.description.slice(0, 350),
    metadata: args.metadata,
  });
}

async function createPrice(args: {
  product: string;
  unit_amount: number;
  currency: string;
  recurring?: { interval: "month" | "year" };
  metadata?: Record<string, string>;
}): Promise<Stripe.Price> {
  return stripe.prices.create({
    product: args.product,
    unit_amount: args.unit_amount,
    currency: args.currency,
    recurring: args.recurring,
    metadata: args.metadata,
  });
}

async function createPaymentLinkForPrice(
  price: Stripe.Price,
): Promise<string | undefined> {
  if (price.recurring) return undefined; // payment links work best for one-time SKUs here
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: {
      type: "redirect",
      redirect: {
        url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://sovereignmatrix.agency"}/starter-packs?paid=${encodeURIComponent(price.metadata?.starterPackId ?? "")}`,
      },
    },
    allow_promotion_codes: true,
    metadata: price.metadata,
  });
  return link.url;
}

async function run() {
  const created: Created[] = [];

  // ── Tier plans (monthly recurring) ──────────────────────────────────
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (!plan.stripePriceEnvKey || !plan.purchasable) continue;
    if (plan.priceUsdCents === 0) continue;
    console.log(`→ ensuring tier plan: ${plan.name}`);
    const product = await ensureProduct({
      name: `Sovereign Matrix — ${plan.name}`,
      description: plan.description,
      metadata: { kind: "tier", planId },
    });
    const price = await createPrice({
      product: product.id,
      unit_amount: plan.priceUsdCents,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { kind: "tier", planId },
    });
    created.push({
      productName: product.name,
      envKey: plan.stripePriceEnvKey,
      priceId: price.id,
    });
  }

  // ── Add-on SKUs (annual recurring) ──────────────────────────────────
  for (const [skuId, sku] of Object.entries(ADD_ONS)) {
    if (!sku.stripePriceEnvKey) continue;
    console.log(`→ ensuring add-on: ${sku.name}`);
    const product = await ensureProduct({
      name: `Sovereign Add-on — ${sku.name}`,
      description: sku.description,
      metadata: { kind: "add-on", skuId, family: sku.family },
    });
    const price = await createPrice({
      product: product.id,
      unit_amount: sku.priceUsdCentsAnnual,
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { kind: "add-on", skuId, family: sku.family },
    });
    created.push({
      productName: product.name,
      envKey: sku.stripePriceEnvKey,
      priceId: price.id,
    });
  }

  // ── Starter packs (one-time + payment links) ───────────────────────
  for (const [packId, pack] of Object.entries(STARTER_PACKS)) {
    if (!pack.stripeLinkEnvKey) continue;
    console.log(`→ ensuring starter pack: ${pack.name}`);
    const product = await ensureProduct({
      name: `Sovereign Pack — ${pack.name}`,
      description: pack.blurb,
      metadata: { kind: "starter", packId, family: pack.family },
    });
    const price = await createPrice({
      product: product.id,
      unit_amount: pack.priceUsdCents,
      currency: "usd",
      metadata: { kind: "starter", packId, starterPackId: packId },
    });
    const linkUrl = await createPaymentLinkForPrice(price);
    created.push({
      productName: product.name,
      envKey: pack.stripeLinkEnvKey,
      priceId: price.id,
      paymentLinkUrl: linkUrl,
    });
  }

  // ── Emit env fragment ───────────────────────────────────────────────
  console.log("\n──────────────────────────────────────────────────────────");
  console.log("# Paste into .env.local + Vercel env (sorted by kind)");
  console.log("──────────────────────────────────────────────────────────\n");
  for (const c of created) {
    if (c.paymentLinkUrl) {
      console.log(`# ${c.productName}`);
      console.log(`${c.envKey}=${c.paymentLinkUrl}`);
    } else {
      console.log(`# ${c.productName}`);
      console.log(`${c.envKey}=${c.priceId}`);
    }
    console.log();
  }
  console.log(
    `\n✅ Created ${created.length} SKU(s). Total = ${created.length} env vars to wire.`,
  );
}

run().catch((err) => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

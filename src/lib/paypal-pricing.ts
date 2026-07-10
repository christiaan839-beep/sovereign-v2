/**
 * Server-side price resolution for PayPal checkout orders.
 *
 * The checkout names only the item (plan / add-on / starter-pack); the amount
 * and label are resolved here from the canonical catalogs, so a tampered
 * request body cannot buy a plan cheaply. The webhook independently
 * re-validates the captured amount against the plan price, so this is the
 * first of two amount checks.
 */

import { PLANS, normalizePlanId } from "@/lib/plans";
import {
  ADD_ONS,
  isKnownAddOn,
  annualPriceUsd as addonPriceUsd,
} from "@/lib/add-ons";
import {
  STARTER_PACKS,
  isKnownStarterPack,
  annualPriceUsd as packPriceUsd,
} from "@/lib/starter-packs";

export type PayPalIntent = "plan" | "addon" | "starter-pack";

export interface OrderPricing {
  amountUsd: number;
  description: string;
}

/**
 * Authoritative price + label for a checkout order, or null when the item is
 * not a real, self-service, priced SKU.
 */
export function resolveOrderPricing(
  intent: PayPalIntent,
  itemId: string,
): OrderPricing | null {
  if (intent === "plan") {
    const plan = normalizePlanId(itemId);
    const def = PLANS[plan];
    if (!def || !def.purchasable || def.priceUsdCents <= 0) return null;
    return {
      amountUsd: def.priceUsdCents / 100,
      description: `${def.name} plan — monthly`,
    };
  }
  if (intent === "addon") {
    if (!isKnownAddOn(itemId)) return null;
    const sku = ADD_ONS[itemId];
    const price = addonPriceUsd(itemId);
    if (!sku || !sku.selfServe || !price || price <= 0) return null;
    return { amountUsd: price, description: sku.name.slice(0, 127) };
  }
  // starter-pack
  if (!isKnownStarterPack(itemId)) return null;
  const pack = STARTER_PACKS[itemId];
  const price = packPriceUsd(itemId);
  if (!pack || !price || price <= 0) return null;
  return { amountUsd: price, description: pack.name.slice(0, 127) };
}

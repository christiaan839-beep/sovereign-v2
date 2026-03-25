/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * SOVEREIGN MATRIX -- Stripe Billing Client
 *
 * Initializes Stripe using the STRIPE_SECRET_KEY env var.
 * All public helpers return null when Stripe is not configured,
 * so the platform degrades gracefully in dev / self-hosted setups.
 *
 * NOTE: The `stripe` npm package must be installed for billing to work.
 * Run `npm install stripe` to enable. Builds succeed without it.
 */

let stripeInstance: any = null;

export function getStripe(): any {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  if (!stripeInstance) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const StripeConstructor = require("stripe").default ?? require("stripe");
      stripeInstance = new StripeConstructor(key);
    } catch {
      console.warn("[SOVEREIGN] stripe package not installed. Run: npm install stripe");
      return null;
    }
  }

  return stripeInstance;
}

// ────────────────────────────────────────────
// Checkout Sessions
// ────────────────────────────────────────────

export async function createCheckoutSession(options: {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: options.customerEmail,
    line_items: [{ price: options.priceId, quantity: 1 }],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: { source: "sovereign-matrix" },
  });

  return session.url;
}

// ────────────────────────────────────────────
// Customer Portal
// ────────────────────────────────────────────

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ────────────────────────────────────────────
// Subscription Status
// ────────────────────────────────────────────

export async function getSubscriptionStatus(
  customerId: string
): Promise<{
  active: boolean;
  plan: string;
  currentPeriodEnd: Date | null;
} | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  const sub = subscriptions.data[0];
  if (!sub) {
    return { active: false, plan: "free", currentPeriodEnd: null };
  }

  return {
    active: true,
    plan: (sub.metadata?.plan as string) || "pro",
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
}

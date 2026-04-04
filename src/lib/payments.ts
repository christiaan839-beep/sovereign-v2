/**
 * Unified Payment Provider Abstraction
 * 
 * Supports PayFast (SA EFT/SnapScan/Cards) and Paystack (Cards/Bank Transfer).
 * Falls back gracefully if credentials not configured.
 */

import crypto from "crypto";

// ─── Pricing Plans ──────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: "Starter",
    priceZAR: 89700,
    priceDisplay: "R897",
    monthlyAmount: 897,
    features: ["10 core agents", "500 tasks/month", "Smart Router", "BYOK support", "Email sequences (3)", "Priority email support"],
  },
  node: {
    name: "Sovereign Node",
    priceZAR: 999700,
    priceDisplay: "R9,997",
    monthlyAmount: 9997,
    features: ["All 130+ agents", "Unlimited tasks", "Local execution", "Ghost Fleet", "NVIDIA NIM", "BYOK support"],
  },
  array: {
    name: "Sovereign Array",
    priceZAR: 2499700,
    priceDisplay: "R24,997",
    monthlyAmount: 24997,
    features: ["Everything in Node", "Unlimited AI generations", "Cosmos VLM Video", "Priority processing", "War Room Red-Teaming", "Direct Comm-Link (24h)"],
  },
  enterprise: {
    name: "Enterprise License",
    priceZAR: 4999700,
    priceDisplay: "R49,997",
    monthlyAmount: 49997,
    features: ["Everything in Array", "White-label dashboard", "Client portal", "Root Admin Command Center", "API access", "5 Sub-Licenses", "SLA guarantee"],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ─── PayFast ────────────────────────────────────────────────────

interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
}

function getPayFastConfig(): PayFastConfig | null {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (!merchantId || !merchantKey) return null;

  return {
    merchantId,
    merchantKey,
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    sandbox: process.env.PAYFAST_MODE === "sandbox",
  };
}

export function generatePayFastForm(plan: PlanId, email: string, returnUrl: string): string | null {
  const config = getPayFastConfig();
  if (!config) return null;

  const planData = PLANS[plan];
  const baseUrl = config.sandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  const data: Record<string, string> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${returnUrl}/payment/success`,
    cancel_url: `${returnUrl}/payment/cancel`,
    notify_url: `${returnUrl}/api/payments/payfast/itn`,
    email_address: email,
    amount: planData.monthlyAmount.toFixed(2),
    item_name: `${planData.name} - Monthly`,
    subscription_type: "1",
    recurring_amount: planData.monthlyAmount.toFixed(2),
    frequency: "3",
    cycles: "0",
  };

  // Generate signature
  const signatureString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`)
    .join("&");

  const signatureWithPassphrase = config.passphrase
    ? `${signatureString}&passphrase=${encodeURIComponent(config.passphrase)}`
    : signatureString;

  data.signature = crypto.createHash("md5").update(signatureWithPassphrase).digest("hex");

  const fields = Object.entries(data)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
    .join("\n");

  return `<form action="${baseUrl}" method="POST" id="payfast-form">\n${fields}\n</form>`;
}

export function verifyPayFastSignature(data: Record<string, string>, passphrase: string): boolean {
  const receivedSig = data.signature;
  const params = { ...data };
  delete params.signature;

  const signatureString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent((v || "").trim())}`)
    .join("&");

  const withPassphrase = passphrase
    ? `${signatureString}&passphrase=${encodeURIComponent(passphrase)}`
    : signatureString;

  const expectedSig = crypto.createHash("md5").update(withPassphrase).digest("hex");
  return expectedSig === receivedSig;
}

// ─── Paystack ───────────────────────────────────────────────────

function getPaystackKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

export async function initializePaystack(plan: PlanId, email: string, callbackUrl: string) {
  const key = getPaystackKey();
  if (!key) return null;

  const planData = PLANS[plan];

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: planData.priceZAR,
      currency: "ZAR",
      callback_url: `${callbackUrl}/api/payments/paystack/callback`,
      metadata: { plan, planName: planData.name },
    }),
  });

  const data = await res.json();
  if (data.status && data.data?.authorization_url) {
    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    };
  }

  return null;
}

export async function verifyPaystackTransaction(reference: string) {
  const key = getPaystackKey();
  if (!key) return null;

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  const data = await res.json();
  return data.status ? data.data : null;
}

export function verifyPaystackWebhook(body: string, signature: string): boolean {
  const key = getPaystackKey();
  if (!key) return false;

  const hash = crypto.createHmac("sha512", key).update(body).digest("hex");
  return hash === signature;
}

// ─── Yoco ─────────────────────────────────────────────────────────

function getYocoKey(): string | null {
  return process.env.YOCO_SECRET_KEY || null;
}

/**
 * Yoco Checkout — SA's biggest card payment processor.
 * Creates a checkout session and returns the redirect URL.
 * Supports cards, SnapScan, and EFT.
 */
export async function initializeYoco(plan: PlanId, email: string, callbackUrl: string) {
  const key = getYocoKey();
  if (!key) return null;

  const planData = PLANS[plan];

  const res = await fetch("https://payments.yoco.com/api/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: planData.priceZAR, // Amount in cents
      currency: "ZAR",
      successUrl: `${callbackUrl}/payment/success?provider=yoco&plan=${plan}`,
      cancelUrl: `${callbackUrl}/payment/cancel`,
      failureUrl: `${callbackUrl}/payment/cancel`,
      metadata: { plan, planName: planData.name, email },
    }),
  });

  const data = await res.json();
  if (data.redirectUrl) {
    return {
      redirectUrl: data.redirectUrl,
      checkoutId: data.id,
    };
  }

  return null;
}

/**
 * Yoco Webhook Verification — Standard Webhooks format.
 *
 * Yoco uses the Standard Webhooks spec: https://www.standardwebhooks.com/
 * Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`
 * Signed content: `{webhook-id}.{webhook-timestamp}.{body}`
 * Signature format: `v1,{base64(HMAC-SHA256(secret, signed_content))}` (space-separated if multiple)
 *
 * The webhook secret is distinct from the API key — it's issued when
 * the webhook subscription is created (POST /v1/webhooks/subscriptions/)
 * and has a `whsec_` prefix whose base64-encoded portion is the actual key.
 */
export function verifyYocoWebhook(
  body: string,
  headers: {
    id: string;
    timestamp: string;
    signature: string;
  }
): boolean {
  const rawSecret = process.env.YOCO_WEBHOOK_SECRET;
  if (!rawSecret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  // Reject messages older than 5 minutes to prevent replay attacks.
  const timestampMs = Number(headers.timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  const ageMs = Date.now() - timestampMs;
  if (ageMs > 5 * 60 * 1000 || ageMs < -5 * 60 * 1000) return false;

  // Strip `whsec_` prefix if present, then base64-decode to get raw key bytes.
  const secretKey = rawSecret.startsWith("whsec_") ? rawSecret.slice(6) : rawSecret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretKey, "base64");
  } catch {
    return false;
  }

  const signedContent = `${headers.id}.${headers.timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  // The header may contain multiple space-separated signatures: "v1,sig1 v1,sig2"
  const receivedSignatures = headers.signature.split(" ");
  for (const sig of receivedSignatures) {
    const [version, candidate] = sig.split(",");
    if (version !== "v1" || !candidate) continue;
    // Timing-safe comparison to prevent signature-stealing via timing attacks.
    const expectedBuf = Buffer.from(expectedSignature);
    const candidateBuf = Buffer.from(candidate);
    if (
      expectedBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(expectedBuf, candidateBuf)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch a payment from Yoco by ID — used to resolve metadata after
 * webhook delivery (PaymentCreated payloads only include IDs).
 */
export async function getYocoPayment(paymentId: string) {
  const key = getYocoKey();
  if (!key) return null;

  const res = await fetch(`https://payments.yoco.com/api/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, string>;
  }>;
}

/**
 * Fetch a checkout from Yoco by ID — used when the webhook's `order_id`
 * maps to a checkout session (rather than a standalone payment).
 */
export async function getYocoCheckout(checkoutId: string) {
  const key = getYocoKey();
  if (!key) return null;

  const res = await fetch(`https://payments.yoco.com/api/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    metadata?: Record<string, string>;
  }>;
}

// ─── Provider Detection ─────────────────────────────────────────

export function getAvailableProviders(): string[] {
  const providers: string[] = [];
  if (getPayFastConfig()) providers.push("payfast");
  if (getPaystackKey()) providers.push("paystack");
  if (getYocoKey()) providers.push("yoco");
  return providers;
}

/**
 * PayPal REST client (Subscriptions API)
 *
 * Thin wrapper around PayPal's REST endpoints. No SDK dependency — uses fetch.
 * Sandbox vs live is selected via PAYPAL_MODE.
 *
 * Required env:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_MODE          ("sandbox" | "live", defaults to sandbox)
 *   PAYPAL_WEBHOOK_ID    (for verifyWebhook)
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("paypal");

export function getPaypalBaseUrl(): string {
  return process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// ── OAuth token cache ──

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error("PayPal token fetch failed", { status: res.status, body: text });
    throw new Error("PayPal authentication failed");
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    value: data.access_token,
    // Refresh 60s before expiry to avoid races on the boundary.
    expiresAt: now + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

// ── Subscriptions ──

interface PaypalLink {
  href: string;
  rel: string;
  method: string;
}

interface PaypalSubscription {
  id: string;
  status: string;
  plan_id: string;
  custom_id?: string;
  links: PaypalLink[];
  billing_info?: {
    next_billing_time?: string;
  };
}

export interface CreatedSubscription {
  id: string;
  approveUrl: string;
}

/**
 * Create a recurring subscription against a pre-configured PayPal Billing Plan.
 * Returns the subscription ID and the user-facing approval URL.
 */
export async function createSubscription(args: {
  planId: string;
  customId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreatedSubscription> {
  const token = await getAccessToken();
  const res = await fetch(`${getPaypalBaseUrl()}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      plan_id: args.planId,
      custom_id: args.customId,
      application_context: {
        brand_name: "Sovereign Matrix",
        user_action: "SUBSCRIBE_NOW",
        return_url: args.returnUrl,
        cancel_url: args.cancelUrl,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error("PayPal subscription create failed", {
      status: res.status,
      body: text,
    });
    throw new Error("PayPal subscription creation failed");
  }

  const sub = (await res.json()) as PaypalSubscription;
  const approve = sub.links.find((l) => l.rel === "approve");
  if (!approve) {
    throw new Error("PayPal response missing approve link");
  }
  return { id: sub.id, approveUrl: approve.href };
}

export async function getSubscription(id: string): Promise<PaypalSubscription> {
  const token = await getAccessToken();
  const res = await fetch(
    `${getPaypalBaseUrl()}/v1/billing/subscriptions/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    throw new Error(`PayPal subscription fetch failed (${res.status})`);
  }
  return (await res.json()) as PaypalSubscription;
}

// ── Webhook verification ──

export interface PaypalWebhookHeaders {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

/**
 * Verify the authenticity of a webhook by calling PayPal's verify-signature
 * endpoint. The raw body is required (never re-serialize JSON before passing).
 */
export async function verifyWebhook(args: {
  headers: PaypalWebhookHeaders;
  rawBody: string;
  webhookId: string;
}): Promise<boolean> {
  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(args.rawBody);
  } catch {
    return false;
  }

  const token = await getAccessToken();
  const res = await fetch(
    `${getPaypalBaseUrl()}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: args.headers.authAlgo,
        cert_url: args.headers.certUrl,
        transmission_id: args.headers.transmissionId,
        transmission_sig: args.headers.transmissionSig,
        transmission_time: args.headers.transmissionTime,
        webhook_id: args.webhookId,
        webhook_event: parsedEvent,
      }),
    },
  );

  if (!res.ok) {
    log.error("PayPal verify-signature call failed", { status: res.status });
    return false;
  }

  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

// ── Webhook event types ──

export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource_type?: string;
  resource: {
    id?: string;
    plan_id?: string;
    custom_id?: string;
    status?: string;
    billing_info?: {
      next_billing_time?: string;
    };
    [k: string]: unknown;
  };
}

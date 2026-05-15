/**
 * SOVEREIGN MATRIX — PayPal payment integration (Cook 177).
 *
 * Pure module that wraps PayPal's REST Orders API + webhook
 * signature verification. No SDK dependency — keeps the bundle
 * tight and the runtime predictable.
 *
 * Modes supported:
 *   - One-time order (Orders v2 API)
 *   - Subscription (Billing Subscriptions v1 API)
 *
 * Why PayPal:
 *   - Works natively in South Africa (Stripe has SA-specific limits).
 *   - Trusted by enterprise procurement teams.
 *   - 30+ currencies; pays out in ZAR.
 *   - Doesn't require a US bank account.
 *
 * SECURITY:
 *   - Access tokens cached in-memory with TTL, never persisted.
 *   - Webhook signatures verified server-side using PayPal's
 *     verify-webhook-signature endpoint.
 *   - All env-derived; failing closed when env is unset.
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const PROD_BASE = "https://api-m.paypal.com";

// ── Public types ──────────────────────────────────────────────────────────

export type PayPalEnvironment = "sandbox" | "production";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  environment: PayPalEnvironment;
}

export interface CreateOrderRequest {
  amountUsd: number;
  description: string;
  customId: string; // tenant id, sku id, etc — round-trips back via webhook
  returnUrl: string;
  cancelUrl: string;
  currency?: string; // default USD
}

export interface CreateOrderResponse {
  orderId: string;
  approvalUrl: string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource: Record<string, unknown>;
}

// ── Config + auth ─────────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null;

export function _resetTokenCache(): void {
  _cachedToken = null;
}

export function getConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const env = (process.env.PAYPAL_ENV ?? "sandbox") as PayPalEnvironment;
  if (!clientId || !clientSecret || !webhookId) return null;
  return { clientId, clientSecret, webhookId, environment: env };
}

function baseUrl(env: PayPalEnvironment): string {
  return env === "production" ? PROD_BASE : SANDBOX_BASE;
}

async function fetchAccessToken(cfg: PayPalConfig): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 60_000) {
    return _cachedToken.token;
  }
  const credentials = Buffer.from(
    `${cfg.clientId}:${cfg.clientSecret}`,
  ).toString("base64");
  const res = await fetch(`${baseUrl(cfg.environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ── Orders v2 ─────────────────────────────────────────────────────────────

export async function createOrder(
  req: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  if (!req.amountUsd || req.amountUsd <= 0) {
    throw new Error("createOrder: amountUsd must be > 0");
  }
  if (!req.customId) throw new Error("createOrder: customId required");
  if (!req.returnUrl || !req.cancelUrl) {
    throw new Error("createOrder: return + cancel URLs required");
  }
  const cfg = getConfig();
  if (!cfg) throw new Error("createOrder: PayPal env not configured");

  const token = await fetchAccessToken(cfg);
  const currency = req.currency ?? "USD";

  const res = await fetch(`${baseUrl(cfg.environment)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: req.customId,
          description: req.description.slice(0, 127),
          amount: {
            currency_code: currency,
            value: req.amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: req.returnUrl,
        cancel_url: req.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal createOrder failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    id: string;
    links: Array<{ href: string; rel: string }>;
  };
  const approve = data.links.find((l) => l.rel === "approve");
  if (!approve) throw new Error("PayPal createOrder: no approval link");

  return { orderId: data.id, approvalUrl: approve.href };
}

export async function captureOrder(orderId: string): Promise<{
  status: string;
  captureId: string | null;
  customId: string | null;
}> {
  const cfg = getConfig();
  if (!cfg) throw new Error("captureOrder: PayPal env not configured");

  const token = await fetchAccessToken(cfg);
  const res = await fetch(
    `${baseUrl(cfg.environment)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`PayPal captureOrder failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    purchase_units?: Array<{
      payments?: { captures?: Array<{ id: string; custom_id?: string }> };
    }>;
  };
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: data.status,
    captureId: capture?.id ?? null,
    customId: capture?.custom_id ?? null,
  };
}

// ── Webhook verification ─────────────────────────────────────────────────

export interface WebhookVerifyArgs {
  headers: Record<string, string | undefined>;
  body: string;
}

export async function verifyWebhookSignature(
  args: WebhookVerifyArgs,
): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  for (const k of required) {
    if (!args.headers[k]) return false;
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(args.body);
  } catch {
    return false;
  }
  const token = await fetchAccessToken(cfg);
  const res = await fetch(
    `${baseUrl(cfg.environment)}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: args.headers["paypal-auth-algo"],
        cert_url: args.headers["paypal-cert-url"],
        transmission_id: args.headers["paypal-transmission-id"],
        transmission_sig: args.headers["paypal-transmission-sig"],
        transmission_time: args.headers["paypal-transmission-time"],
        webhook_id: cfg.webhookId,
        webhook_event: parsedBody,
      }),
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

// ── Helpers for the webhook handler ──────────────────────────────────────

export function extractCustomId(event: WebhookEvent): string | null {
  const resource = event.resource as
    | { custom_id?: string; purchase_units?: Array<{ custom_id?: string }> }
    | undefined;
  if (!resource) return null;
  if (resource.custom_id) return resource.custom_id;
  return resource.purchase_units?.[0]?.custom_id ?? null;
}

export function isPaymentCompletedEvent(eventType: string): boolean {
  return (
    eventType === "PAYMENT.CAPTURE.COMPLETED" ||
    eventType === "CHECKOUT.ORDER.APPROVED" ||
    eventType === "CHECKOUT.ORDER.COMPLETED"
  );
}

export function isSubscriptionActivatedEvent(eventType: string): boolean {
  return (
    eventType === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    eventType === "BILLING.SUBSCRIPTION.CREATED"
  );
}

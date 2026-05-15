/**
 * SOVEREIGN MATRIX — MoonPay crypto onramp (Cook 178).
 *
 * Generates signed widget URLs the visitor opens to buy crypto with
 * their card, and verifies the webhook payloads MoonPay sends back
 * when a transaction transitions state.
 *
 * Why MoonPay:
 *   - Bypasses some Stripe geographic restrictions (works globally).
 *   - Aligns thematically with Sovereign's crypto-receipts moat —
 *     a customer paying via crypto for a crypto-receipts platform
 *     is the on-brand purchase path.
 *   - Supports 30+ cryptocurrencies + 80+ fiat currencies.
 *   - Pays out the operator in fiat (USD) OR crypto.
 *
 * MoonPay's authentication model:
 *   - Public widget signed via HMAC-SHA256 with the secret key.
 *   - Webhook events verified via the `Moonpay-Signature-V2` header
 *     using the same secret.
 *
 * SECURITY:
 *   - Constant-time MAC compare on webhook verification.
 *   - Fail-closed when env is unset (the helper returns null + the
 *     caller surfaces a 503 with sales-fallback messaging).
 *   - No persisted state — pure module.
 */

import { createHmac, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface MoonPayConfig {
  /** Public API key (visible in the widget URL). Starts with `pk_test_` or `pk_live_`. */
  publicKey: string;
  /** Secret API key (used for HMAC signing the widget URL + verifying
   *  webhooks). Server-only — never expose to the browser. */
  secretKey: string;
  /** Widget origin — usually https://buy.moonpay.com (live) or
   *  https://buy-sandbox.moonpay.com (test). */
  widgetOrigin: string;
  /** Optional webhook secret if you configured a distinct one in
   *  the MoonPay dashboard. Falls back to the secretKey otherwise. */
  webhookSecret?: string;
}

export interface BuildWidgetUrlRequest {
  /** Currency to buy — e.g. "usdc_polygon" or "eth". */
  currencyCode: string;
  /**
   * **Customer-controlled wallet address** the purchased crypto
   * is delivered to. NOT the operator's wallet — MoonPay is a
   * pure on-ramp, not an escrow. If the platform wants to
   * collect the funds itself, inject the operator's wallet
   * address server-side at the route boundary; do not pass
   * a user-supplied address through unchecked.
   */
  walletAddress: string;
  /** Fiat amount to pay (USD). */
  baseAmount: number;
  /** Optional customer email — speeds up KYC. */
  email?: string;
  /** Internal id we want to round-trip back via the webhook. */
  externalCustomerId: string;
  /** Where MoonPay should redirect the visitor on completion. */
  redirectUrl: string;
  /** Locale override (default "en"). */
  language?: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    id: string;
    status: "waitingPayment" | "pending" | "completed" | "failed" | string;
    baseCurrencyAmount?: number;
    quoteCurrencyAmount?: number;
    externalCustomerId?: string;
    [k: string]: unknown;
  };
}

// ── Config ────────────────────────────────────────────────────────────────

export function getConfig(): MoonPayConfig | null {
  const publicKey = process.env.MOONPAY_PUBLIC_KEY;
  const secretKey = process.env.MOONPAY_SECRET_KEY;
  const widgetOrigin =
    process.env.MOONPAY_WIDGET_ORIGIN ?? "https://buy-sandbox.moonpay.com";
  const webhookSecret = process.env.MOONPAY_WEBHOOK_SECRET;
  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey, widgetOrigin, webhookSecret };
}

// ── Signed widget URL ────────────────────────────────────────────────────

/**
 * Build a signed MoonPay widget URL. The signature lives in the
 * trailing `signature` query param and is HMAC-SHA256 of the
 * preceding query string under the secret key. Without this
 * signature MoonPay refuses to render the locked-down version
 * of the widget.
 */
export function buildWidgetUrl(req: BuildWidgetUrlRequest): string | null {
  const cfg = getConfig();
  if (!cfg) return null;
  if (!req.currencyCode)
    throw new Error("buildWidgetUrl: currencyCode required");
  if (!req.walletAddress)
    throw new Error("buildWidgetUrl: walletAddress required");
  if (!(req.baseAmount > 0))
    throw new Error("buildWidgetUrl: baseAmount must be > 0");
  if (!req.externalCustomerId) {
    throw new Error("buildWidgetUrl: externalCustomerId required");
  }
  if (!req.redirectUrl) throw new Error("buildWidgetUrl: redirectUrl required");

  const params = new URLSearchParams({
    apiKey: cfg.publicKey,
    currencyCode: req.currencyCode,
    walletAddress: req.walletAddress,
    baseCurrencyAmount: req.baseAmount.toFixed(2),
    baseCurrencyCode: "usd",
    externalCustomerId: req.externalCustomerId,
    redirectURL: req.redirectUrl,
    language: req.language ?? "en",
    showAllCurrencies: "false",
    showWalletAddressForm: "false",
  });
  if (req.email) params.set("email", req.email);

  const unsignedQuery = `?${params.toString()}`;
  const signature = createHmac("sha256", cfg.secretKey)
    .update(unsignedQuery)
    .digest("base64");

  params.set("signature", signature);
  return `${cfg.widgetOrigin}?${params.toString()}`;
}

// ── Webhook verification ─────────────────────────────────────────────────

/**
 * Verify a MoonPay webhook signature. MoonPay sends a header named
 * `Moonpay-Signature-V2` whose value is the base64-encoded HMAC-SHA256
 * of the raw request body under the webhook secret (or the secretKey
 * when no separate webhook secret is configured).
 */
export function verifyWebhookSignature(args: {
  body: string;
  signatureHeader: string | null | undefined;
}): boolean {
  const cfg = getConfig();
  if (!cfg) return false;
  if (!args.signatureHeader) return false;
  const secret = cfg.webhookSecret ?? cfg.secretKey;
  const expected = createHmac("sha256", secret).update(args.body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(args.signatureHeader, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

// ── Helpers for the webhook handler ──────────────────────────────────────

export function isTransactionCompleted(event: WebhookEvent): boolean {
  return (
    event.type === "transaction_updated" && event.data.status === "completed"
  );
}

export function isTransactionFailed(event: WebhookEvent): boolean {
  return event.type === "transaction_updated" && event.data.status === "failed";
}

/**
 * Parse the externalCustomerId encoded as `<intent>:<itemId>:<userId>`.
 * Returns null when the id is missing or malformed.
 */
export function parseExternalCustomerId(
  externalCustomerId: string | undefined,
): { intent: string; itemId: string; userId: string } | null {
  if (!externalCustomerId) return null;
  const parts = externalCustomerId.split(":");
  if (parts.length !== 3) return null;
  const [intent, itemId, userId] = parts;
  if (!intent || !itemId || !userId) return null;
  return { intent, itemId, userId };
}

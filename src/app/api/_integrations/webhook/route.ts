/**
 * POST /api/_integrations/webhook
 *
 * Fires a webhook to any URL with optional HMAC-SHA256 signature.
 * Uses WEBHOOK_SIGNING_SECRET env var for payload signing (optional but recommended).
 *
 * Body: {
 *   url: string,
 *   method?: "GET" | "POST" (default: "POST"),
 *   headers?: Record<string, string>,
 *   body?: unknown
 * }
 *
 * The signature is sent as X-Sovereign-Signature header (hex-encoded HMAC-SHA256).
 */

import { NextResponse } from "next/server";
import {
  guardRoute,
  errorResponse,
  sanitizeString,
  validateRequired,
} from "@/lib/api-guard";
import { outboundFetch, EgressBlockedError } from "@/lib/outbound-fetch";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:webhook");

const ALLOWED_METHODS = new Set(["GET", "POST"]);
const MAX_BODY_SIZE = 100_000; // 100KB payload limit

/** Compute HMAC-SHA256 of a payload using the Web Crypto API. */
async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const missing = validateRequired(body, ["url"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const url = sanitizeString(body.url, 2000);
    const method = sanitizeString(body.method ?? "POST", 10).toUpperCase();

    // Validate URL shape. SSRF is enforced by outboundFetch below — the
    // previous hand-rolled hostname blocklist here MISSED 169.254.169.254
    // (cloud-metadata IMDS), did NO DNS resolution (so any domain whose
    // A record pointed at a private/metadata IP slipped through — the
    // classic DNS-rebinding shape), and missed IPv6 loopback. outboundFetch
    // runs the shared isSafeUrl + DNS-resolved private/loopback/link-local
    // guard, which closes all three.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return errorResponse("Invalid URL", 400, "VALIDATION_ERROR");
    }

    if (!ALLOWED_METHODS.has(method)) {
      return errorResponse(
        "method must be GET or POST",
        400,
        "VALIDATION_ERROR",
      );
    }

    // Build outgoing headers
    const outHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Sovereign-Webhook/1.0",
      ...(body.headers &&
      typeof body.headers === "object" &&
      !Array.isArray(body.headers)
        ? (body.headers as Record<string, string>)
        : {}),
    };

    // Serialize the body payload
    const payloadBody =
      body.body !== undefined ? JSON.stringify(body.body) : undefined;

    if (payloadBody && payloadBody.length > MAX_BODY_SIZE) {
      return errorResponse(
        `Payload too large (max ${MAX_BODY_SIZE} bytes)`,
        400,
        "PAYLOAD_TOO_LARGE",
      );
    }

    // Sign the payload if a signing secret is configured
    const secret = process.env.WEBHOOK_SIGNING_SECRET;
    if (secret && payloadBody) {
      const signature = await signPayload(payloadBody, secret);
      outHeaders["X-Sovereign-Signature"] = `sha256=${signature}`;
      outHeaders["X-Sovereign-Timestamp"] = String(
        Math.floor(Date.now() / 1000),
      );
    }

    log.info("Firing webhook", {
      url: parsedUrl.origin + parsedUrl.pathname,
      method,
      signed: !!secret,
      userId: auth.userId,
    });

    const fetchOpts: RequestInit = {
      method,
      headers: outHeaders,
    };
    if (method === "POST" && payloadBody) {
      fetchOpts.body = payloadBody;
    }

    // Fire through outboundFetch: this is a user-directed webhook to an
    // arbitrary destination of THEIR choosing (their CRM, Zapier, etc.),
    // so we intentionally allow any *public* host via modeOverride "open"
    // — but the SSRF guard (string check + DNS-resolved private/loopback/
    // link-local/metadata rejection) ALWAYS runs even in open mode, and
    // every block leaves a signed defense receipt. Also inherits redirect:
    // "manual" (no redirect-to-private), a request timeout, and a hard
    // response byte cap.
    let result;
    try {
      result = await outboundFetch(url, fetchOpts, {
        ruleId: "integration.user-webhook",
        userId: auth.userId,
        modeOverride: "open",
        maxResponseBytes: MAX_BODY_SIZE,
        timeoutMs: 15_000,
      });
    } catch (err) {
      if (err instanceof EgressBlockedError) {
        log.warn("Webhook blocked by SSRF guard", {
          userId: auth.userId,
          reason: err.violation.reason,
        });
        return errorResponse(
          "Cannot send webhooks to private, loopback, or cloud-metadata addresses",
          400,
          "SSRF_BLOCKED",
        );
      }
      throw err;
    }

    // Response body is already byte-capped by outboundFetch; cap the
    // displayed portion the same way the previous handler did.
    let responseBody: unknown = null;
    const contentType = result.contentType ?? "";
    if (contentType.includes("json")) {
      try {
        responseBody = JSON.parse(result.body);
      } catch {
        responseBody = result.body.slice(0, 2000);
      }
    } else {
      responseBody = result.body.slice(0, 2000);
    }

    log.info("Webhook fired", { status: result.status, ok: result.ok });

    return NextResponse.json({
      success: result.ok,
      status: result.status,
      response: responseBody,
    });
  } catch (err) {
    log.error("Webhook integration error", { error: String(err) });
    return errorResponse("Failed to fire webhook", 500, "WEBHOOK_ERROR");
  }
}

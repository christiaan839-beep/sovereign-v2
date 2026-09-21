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
import { guardRoute, errorResponse, sanitizeString, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";
import { outboundFetch, EgressBlockedError } from "@/lib/outbound-fetch";

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
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
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
    const method = (sanitizeString(body.method ?? "POST", 10)).toUpperCase();

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return errorResponse("Invalid URL", 400, "VALIDATION_ERROR");
    }

    if (!ALLOWED_METHODS.has(method)) {
      return errorResponse("method must be GET or POST", 400, "VALIDATION_ERROR");
    }

    // Build outgoing headers
    const outHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Sovereign-Webhook/1.0",
      ...((body.headers && typeof body.headers === "object" && !Array.isArray(body.headers))
        ? body.headers as Record<string, string>
        : {}),
    };

    // Serialize the body payload
    const payloadBody = body.body !== undefined ? JSON.stringify(body.body) : undefined;

    if (payloadBody && payloadBody.length > MAX_BODY_SIZE) {
      return errorResponse(`Payload too large (max ${MAX_BODY_SIZE} bytes)`, 400, "PAYLOAD_TOO_LARGE");
    }

    // Sign the payload if a signing secret is configured
    const secret = process.env.WEBHOOK_SIGNING_SECRET;
    if (secret && payloadBody) {
      const signature = await signPayload(payloadBody, secret);
      outHeaders["X-Sovereign-Signature"] = `sha256=${signature}`;
      outHeaders["X-Sovereign-Timestamp"] = String(Math.floor(Date.now() / 1000));
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

    let res;
    try {
      res = await outboundFetch(url, fetchOpts, { ruleId: "webhook-integration", userId: auth.userId });
    } catch (err: unknown) {
      if (err instanceof EgressBlockedError) {
        return errorResponse("Cannot send webhooks to blocked/private addresses", 400, "SSRF_BLOCKED");
      }
      throw err;
    }

    // Try to capture the response body (but don't fail if we can't)
    let responseBody: unknown = null;
    try {
      const contentType = res.contentType ?? "";
      if (contentType.includes("json")) {
        responseBody = JSON.parse(res.body);
      } else {
        responseBody = res.body.slice(0, 2000); // Cap response size
      }
    } catch {
      responseBody = null;
    }

    log.info("Webhook fired", { status: res.status, ok: res.ok });

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      response: responseBody,
    });
  } catch (err) {
    log.error("Webhook integration error", { error: String(err) });
    return errorResponse("Failed to fire webhook", 500, "WEBHOOK_ERROR");
  }
}

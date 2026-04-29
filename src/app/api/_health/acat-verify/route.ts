/**
 * POST /api/health/acat-verify
 *
 * PUBLIC, no-auth endpoint that verifies an ACAT (R91) cryptographically
 * AGAINST a cart context. Powers the /trust/agentic-commerce live
 * verifier UI and is reachable from any third-party tool.
 *
 * Procurement-grade design:
 *   - The verifier is the SAME pure function shipped in
 *     @sovereign/inspector and src/lib/agentic-commerce/acat.ts.
 *     Two paths to verification, identical answers.
 *   - We do NOT store the submitted ACAT. The endpoint runs the
 *     math + returns the verdict + 12-reason granularity. Stateless.
 *   - Rate-limited by IP to discourage abuse, not gated. Trust is a
 *     public good — anyone can run this verifier locally too.
 *
 * Input shape (JSON body):
 *   {
 *     acat: SignedACAT | string  // object form OR base64url-encoded
 *     expectedUserPublicKey: string
 *     cart: {
 *       amountCents: number
 *       currency: string  // ISO 4217
 *       merchantId: string
 *       category: CommerceCategory
 *     }
 *     now?: string  // ISO 8601 — for testing only
 *   }
 *
 * Returns:
 *   200 { valid: true, remainingMaxCents, summary, reputation? }
 *   200 { valid: false, reason, summary, oneOfTwelveReasons }
 *   400 { error: "bad_request", details }
 *   429 { error: "rate_limited" }
 */

import { NextResponse } from "next/server";
import {
  verifyACAT,
  decodeACATFromHeader,
  summarizeACATForReceipt,
  type SignedACAT,
  type CommerceCategory,
} from "@/lib/agentic-commerce/acat";
import { headers } from "next/headers";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AcatVerifyBody {
  acat?: unknown;
  expectedUserPublicKey?: unknown;
  cart?: {
    amountCents?: unknown;
    currency?: unknown;
    merchantId?: unknown;
    category?: unknown;
  };
  now?: unknown;
}

// Defensive parse — refuses anything that's not a SignedACAT-shaped object.
function parseAcatField(field: unknown): SignedACAT | null {
  if (typeof field === "string") {
    return decodeACATFromHeader(field);
  }
  if (
    field !== null &&
    typeof field === "object" &&
    "version" in field &&
    (field as { version?: unknown }).version === "acat-v1"
  ) {
    return field as SignedACAT;
  }
  return null;
}

const VALID_CATEGORIES: CommerceCategory[] = [
  "groceries",
  "restaurants",
  "fuel",
  "travel",
  "entertainment",
  "subscription_services",
  "professional_services",
  "marketplace_b2c",
  "marketplace_b2b",
  "saas_software",
  "cloud_infrastructure",
  "ai_apis",
  "education",
  "healthcare",
  "charity",
  "other",
];

export async function POST(request: Request) {
  // Rate limit by IP — the verifier is stateless but Next.js function
  // invocation isn't free. Uses the path-matched rule registry; if no
  // explicit rule matches, defaults to allow (and we can add a tighter
  // rule later in src/lib/rate-limits.ts without touching this file).
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rateDecision = await applyRateLimit("/api/_health/acat-verify", {
    ip,
  });
  if (!rateDecision.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rateDecision.resetInSeconds },
      { status: 429, headers: rateLimitHeaders(rateDecision) },
    );
  }

  let body: AcatVerifyBody;
  try {
    body = (await request.json()) as AcatVerifyBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", details: "Body must be JSON" },
      { status: 400 },
    );
  }

  const token = parseAcatField(body.acat);
  if (token === null) {
    return NextResponse.json(
      {
        error: "bad_request",
        details:
          "`acat` must be a SignedACAT object OR a base64url-encoded canonical-JSON string",
      },
      { status: 400 },
    );
  }
  if (typeof body.expectedUserPublicKey !== "string") {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`expectedUserPublicKey` (base64url) is required",
      },
      { status: 400 },
    );
  }
  if (
    !body.cart ||
    typeof body.cart.amountCents !== "number" ||
    typeof body.cart.currency !== "string" ||
    typeof body.cart.merchantId !== "string" ||
    typeof body.cart.category !== "string"
  ) {
    return NextResponse.json(
      {
        error: "bad_request",
        details:
          "`cart` requires { amountCents:number, currency:string, merchantId:string, category:string }",
      },
      { status: 400 },
    );
  }
  if (!VALID_CATEGORIES.includes(body.cart.category as CommerceCategory)) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: `\`cart.category\` must be one of: ${VALID_CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (body.cart.amountCents < 0 || body.cart.amountCents > 1_000_000_000) {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`cart.amountCents` must be in [0, 1_000_000_000]",
      },
      { status: 400 },
    );
  }

  const now = typeof body.now === "string" ? new Date(body.now) : undefined;
  const result = verifyACAT({
    token,
    expectedUserPublicKey: body.expectedUserPublicKey,
    cart: {
      amountCents: body.cart.amountCents,
      currency: body.cart.currency,
      merchantId: body.cart.merchantId,
      category: body.cart.category as CommerceCategory,
    },
    now,
  });

  const summary = summarizeACATForReceipt(token);

  if (result.valid) {
    return NextResponse.json(
      {
        valid: true,
        remainingMaxCents: result.remainingMaxCents,
        reputation: result.reputation ?? null,
        summary,
        verifierNote:
          "Same pure function as @sovereign/inspector and " +
          "src/lib/agentic-commerce/acat.ts. Run locally to confirm.",
      },
      { status: 200 },
    );
  }
  return NextResponse.json(
    {
      valid: false,
      reason: result.reason,
      summary,
      oneOfTwelveReasons: [
        "message_mismatch",
        "signature_invalid",
        "user_pubkey_mismatch",
        "expired",
        "not_yet_valid",
        "scope_violation",
        "merchant_not_allowed",
        "category_excluded",
        "category_not_allowed",
        "single_use_consumed",
        "chain_hash_mismatch",
        "amount_exceeds_scope",
      ],
      verifierNote:
        "Same pure function as @sovereign/inspector and " +
        "src/lib/agentic-commerce/acat.ts. Run locally to confirm.",
    },
    { status: 200 },
  );
}

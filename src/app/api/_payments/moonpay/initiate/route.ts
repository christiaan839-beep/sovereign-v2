import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { buildWidgetUrl, getConfig } from "@/lib/moonpay";
import { getPublicUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * /api/_payments/moonpay/initiate — Cook 178.
 *
 * Builds a signed MoonPay widget URL for the visitor to open.
 * Mirrors /paypal/checkout in shape — auth-gated, rate-limited,
 * round-trips intent + itemId via externalCustomerId for webhook
 * provisioning.
 */

const log = createLogger("moonpay-initiate");
const limiter = rateLimit({ interval: 60, limit: 6 });

const BODY = z.object({
  intent: z.enum(["plan", "addon", "starter-pack"]),
  itemId: z.string().min(1).max(64),
  amountUsd: z.number().positive().max(1_000_000),
  /** Currency the customer wants to receive (operator payout side). */
  currencyCode: z.string().min(2).max(32).default("usdc_polygon"),
  /** Wallet address operator receives the crypto payout to. */
  walletAddress: z.string().min(20).max(120),
  email: z.string().email().optional(),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getConfig()) {
    return NextResponse.json(
      {
        error:
          "MoonPay not configured. Set MOONPAY_PUBLIC_KEY + MOONPAY_SECRET_KEY in env.",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const appUrl = getPublicUrl();
  const externalCustomerId = `${body.intent}:${body.itemId}:${userId}`;

  try {
    const url = buildWidgetUrl({
      currencyCode: body.currencyCode,
      walletAddress: body.walletAddress,
      baseAmount: body.amountUsd,
      email: body.email,
      externalCustomerId,
      redirectUrl: `${appUrl}/dashboard?moonpay=success&intent=${body.intent}`,
    });
    if (!url) {
      return NextResponse.json(
        { error: "MoonPay configuration missing." },
        { status: 503 },
      );
    }
    log.info("MoonPay widget URL issued", {
      userId,
      intent: body.intent,
      itemId: body.itemId,
    });
    return NextResponse.json({ url, externalCustomerId });
  } catch (err) {
    log.error("MoonPay initiate failed", {
      err: err instanceof Error ? err.message : String(err),
      userId,
    });
    return NextResponse.json(
      { error: "Could not start MoonPay checkout." },
      { status: 500 },
    );
  }
}

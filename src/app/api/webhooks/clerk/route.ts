import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/db";
import { tenants, affiliates, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";

const log = createLogger("clerk-webhook");

// ── Types ──

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    first_name: string | null;
    last_name: string | null;
    primary_email_address_id: string;
    unsafe_metadata?: Record<string, unknown>;
    public_metadata?: Record<string, unknown>;
  };
}

// ── Helpers ──

function isTableMissing(err: unknown): boolean {
  const pgCode = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return pgCode === "42P01" || msg.includes("does not exist");
}

function generateNodeId(): string {
  const seg = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  return `UMB-${seg()}-${seg()}`;
}

function getPrimaryEmail(data: ClerkUserCreatedEvent["data"]): string | null {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return (
    primary?.email_address ?? data.email_addresses[0]?.email_address ?? null
  );
}

// ── Welcome Email ──

async function sendWelcomeEmail(email: string, firstName: string | null) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    log.warn("RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  const name = firstName || "there";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.RESEND_FROM_EMAIL ||
          "Sovereign Matrix <hello@sovereignmatrix.agency>",
        to: email,
        subject: "Welcome to Sovereign Matrix — your agents are ready",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #e5e5e5; background: #010101;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);">
                <span style="color: #10b981; font-size: 14px; font-weight: 700;">Sovereign Matrix</span>
              </div>
            </div>
            <h1 style="color: white; font-size: 24px; font-weight: 800; margin: 0 0 16px 0;">Welcome, ${name}.</h1>
            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
              Your account is live. You now have access to 130+ AI agents across 39+ models —
              all verified through a 5-layer safety pipeline before any output reaches you.
            </p>
            <h2 style="color: white; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">Get started in 30 seconds</h2>
            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 8px 0;">
              <strong style="color: #e5e5e5;">1.</strong> Open your dashboard and pick a playbook<br/>
              <strong style="color: #e5e5e5;">2.</strong> Paste a competitor URL or describe your goal<br/>
              <strong style="color: #e5e5e5;">3.</strong> Watch the agents execute in real time
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://sovereignmatrix.agency/dashboard"
                style="display: inline-block; padding: 14px 32px; background: #10b981; color: black; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 9999px;">
                Open Dashboard
              </a>
            </div>
            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
              You have <strong style="color: #10b981;">50 free agent runs</strong> to start with.
              Invite a friend with your referral link and you both get 50 more.
            </p>
            <p style="color: #525252; font-size: 12px; line-height: 1.6; margin: 32px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px;">
              Sovereign Matrix — Agent Operating System<br/>
              130 agents. 39+ models. Flat pricing.<br/>
              <a href="https://sovereignmatrix.agency" style="color: #10b981; text-decoration: none;">sovereignmatrix.agency</a>
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      log.error("Resend API error", { status: res.status, body });
    } else {
      log.info("Welcome email sent", { email });
    }
  } catch (err) {
    log.error("Failed to send welcome email", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Tenant Creation ──

async function ensureTenant(clerkUserId: string) {
  try {
    const existing = await db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, clerkUserId))
      .limit(1);

    if (existing.length > 0) {
      log.info("Tenant already exists", {
        clerkUserId,
        tenantId: existing[0].id,
      });
      return existing[0];
    }

    const inserted = await db
      .insert(tenants)
      .values({
        clerkUserId,
        nodeId: generateNodeId(),
        plan: "free",
      })
      .returning();

    log.info("Created tenant", { clerkUserId, tenantId: inserted[0].id });
    return inserted[0];
  } catch (err) {
    if (isTableMissing(err)) {
      log.warn("tenants table does not exist — skipping tenant creation", {
        clerkUserId,
      });
      return null;
    }
    throw err;
  }
}

// ── Referral Tracking ──

async function processReferral(
  clerkUserId: string,
  email: string,
  referralCode: string,
) {
  try {
    // Find the affiliate by referral code
    const rows = await db
      .select()
      .from(affiliates)
      .where(eq(affiliates.referralCode, referralCode))
      .limit(1);

    const affiliate = rows[0];
    if (!affiliate) {
      log.warn("Referral code not found", { referralCode, clerkUserId });
      return;
    }

    // Don't let users refer themselves
    if (affiliate.userId === clerkUserId) {
      log.warn("Self-referral attempt blocked", { clerkUserId, referralCode });
      return;
    }

    // Create referral record
    await db.insert(referrals).values({
      affiliateId: affiliate.id,
      referredUserId: clerkUserId,
      referredEmail: email,
      plan: "free",
      revenue: 0,
      status: "signed_up",
    });

    // Increment the affiliate's referral count
    await db
      .update(affiliates)
      .set({ totalReferrals: affiliate.totalReferrals + 1 })
      .where(eq(affiliates.id, affiliate.id));

    log.info("Referral recorded", {
      affiliateId: affiliate.id,
      referredUserId: clerkUserId,
      referralCode,
    });
  } catch (err) {
    if (isTableMissing(err)) {
      log.warn(
        "affiliates/referrals tables do not exist — skipping referral tracking",
      );
      return;
    }
    log.error("Failed to process referral", {
      error: err instanceof Error ? err.message : String(err),
      referralCode,
      clerkUserId,
    });
  }
}

// ── POST /api/webhooks/clerk ──
// Handles Clerk webhook events (verified via svix).
// Currently supports: user.created

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error("CLERK_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // ── Verify signature ──
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    log.warn("Missing svix headers");
    return NextResponse.json(
      { error: "Missing webhook verification headers" },
      { status: 400 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    log.error("Webhook verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // ── Idempotency ──
  // Clerk delivers via svix with at-least-once semantics, so a 5xx
  // from us OR a network blip on Clerk's side can resurface the same
  // event minutes later. Without this guard, a duplicate user.created
  // would attempt a second tenant insert (caught by the unique
  // constraint on clerk_user_id, but still a wasted welcome email
  // and a misleading log line).
  //
  // svix-id is the canonical unique event identifier and is the
  // documented input for at-least-once dedupe — see
  // https://docs.svix.com/receiving/idempotency.
  //
  // Failure mode: if Redis + DB are both down, the lib falls through
  // to in-memory dedupe (per-Lambda, lossy). That's acceptable here:
  // the worst case is one duplicate welcome email after a cold start,
  // which the tenant unique-constraint still prevents from creating
  // duplicate tenants.
  if (await alreadyProcessed("clerk", svixId)) {
    log.info("Skipping duplicate Clerk webhook", {
      svixId,
      type: event.type,
    });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── Handle event ──
  if (event.type !== "user.created") {
    // Acknowledge unhandled event types gracefully
    log.info("Ignoring unhandled event type", { type: event.type });
    return NextResponse.json({ received: true });
  }

  const { data } = event;
  const clerkUserId = data.id;
  const email = getPrimaryEmail(data);
  const firstName = data.first_name;

  log.info("Processing user.created", { clerkUserId, email });

  // Run all side effects in parallel (non-blocking to each other)
  const results = await Promise.allSettled([
    // 1. Send welcome email
    email ? sendWelcomeEmail(email, firstName) : Promise.resolve(),

    // 2. Create tenant record
    ensureTenant(clerkUserId),

    // 3. Process referral if code present in metadata
    (() => {
      const refCode =
        (data.unsafe_metadata?.referralCode as string) ??
        (data.public_metadata?.referralCode as string) ??
        null;
      if (refCode && email) {
        return processReferral(clerkUserId, email, refCode);
      }
      return Promise.resolve();
    })(),
  ]);

  // Log any failures (but always return 200 so Clerk doesn't retry endlessly)
  for (const result of results) {
    if (result.status === "rejected") {
      log.error("Webhook side-effect failed", {
        reason:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  return NextResponse.json({ received: true });
}

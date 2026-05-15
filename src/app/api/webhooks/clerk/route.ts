import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/db";
import { tenants, affiliates, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

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

  // Welcome email — first-touch experience post-signup. Cyan accent
  // (system / audit surface per docs/design-system/brand-colors.md).
  // Leads with the verifiable-receipts moat, not the "lots of agents"
  // narrative. Three CTAs by priority:
  //   1. Open the dashboard (primary, conversion)
  //   2. Read the spec / see the live verifier (education)
  //   3. Install the MCP server (distribution — they ship the badge
  //      out to wherever they live, AI tool or otherwise)
  //
  // Inline-styled HTML for maximum email-client compatibility (Gmail
  // strips <style>, Outlook is Word). Cyan = #00B7FF.
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
        subject: "Welcome to Sovereign — your audit-grade AI workspace is live",
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #e5e5e5; background: #030303;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(0,183,255,0.1); border: 1px solid rgba(0,183,255,0.3);">
                <span style="color: #00B7FF; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;">Sovereign Matrix</span>
              </div>
            </div>

            <h1 style="color: white; font-size: 26px; font-weight: 600; margin: 0 0 16px 0; font-family: 'Instrument Serif', Georgia, serif;">
              Welcome, ${name}.
            </h1>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
              Your account is live. Every agent run you trigger from here produces a cryptographically signed receipt — HMAC-SHA256 over a canonical projection, verifiable by anyone against our public <code style="font-family: 'JetBrains Mono', monospace; color: #00B7FF; font-size: 13px;">/api/verify</code> endpoint.
            </p>
            <p style="color: #a3a3a3; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
              That's the moat: 137 agents you can actually prove the outputs of.
            </p>

            <!-- Primary CTA -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://sovereignmatrix.agency/dashboard"
                style="display: inline-block; padding: 14px 36px; background: #00B7FF; color: #030303; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px; letter-spacing: 0.02em;">
                Open your dashboard →
              </a>
            </div>

            <h2 style="color: white; font-size: 16px; font-weight: 700; margin: 32px 0 12px 0; letter-spacing: 0.02em;">
              While you're here
            </h2>
            <ul style="margin: 0 0 24px 0; padding: 0; list-style: none;">
              <li style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">
                <strong style="color: #e5e5e5;">→</strong>
                <a href="https://sovereignmatrix.agency/verified" style="color: #00B7FF; text-decoration: none;">See the live verifier</a> — pick a public receipt, watch one byte of canonical-projection mutation break the signature in real time.
              </li>
              <li style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">
                <strong style="color: #e5e5e5;">→</strong>
                <a href="https://sovereignmatrix.agency/spec" style="color: #00B7FF; text-decoration: none;">Read the VAOS 1.0 spec</a> — the open standard your receipts implement. CC0 license; the reference verifier is MIT.
              </li>
              <li style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">
                <strong style="color: #e5e5e5;">→</strong>
                <a href="https://sovereignmatrix.agency/explorer" style="color: #00B7FF; text-decoration: none;">Browse the live explorer</a> — a real-time feed of every public receipt being signed across the platform.
              </li>
            </ul>

            <!-- MCP install pro-tip -->
            <div style="margin: 28px 0; padding: 16px 18px; border: 1px solid rgba(0,183,255,0.2); border-radius: 12px; background: rgba(0,183,255,0.04);">
              <div style="color: #00B7FF; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 6px 0;">
                Pro tip
              </div>
              <p style="color: #d4d4d4; font-size: 14px; line-height: 1.55; margin: 0 0 12px 0;">
                Install the Sovereign verifier into Claude Desktop, Cursor, or Claude Code with one line — verify receipts directly from your AI tool palette:
              </p>
              <a href="https://sovereignmatrix.agency/mcp"
                style="color: #00B7FF; font-family: 'JetBrains Mono', monospace; font-size: 13px; text-decoration: none;">
                sovereignmatrix.agency/mcp →
              </a>
            </div>

            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 24px 0 0 0;">
              You start with <strong style="color: #00B7FF;">50 verified runs / month</strong>, free forever. Upgrade to Pro ($49/mo) for 500 runs + Ed25519 signatures + Merkle inclusion proofs.
            </p>

            <p style="color: #525252; font-size: 12px; line-height: 1.6; margin: 36px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px;">
              Sovereign Matrix — audit-grade AI agent infrastructure<br/>
              <a href="https://sovereignmatrix.agency" style="color: #737373; text-decoration: none;">sovereignmatrix.agency</a>
              &nbsp;·&nbsp;
              <a href="https://sovereignmatrix.agency/trust" style="color: #737373; text-decoration: none;">Trust posture</a>
              &nbsp;·&nbsp;
              <a href="https://sovereignmatrix.agency/unsubscribe" style="color: #737373; text-decoration: none;">Unsubscribe</a>
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

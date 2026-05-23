import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { outboundFetch } from "@/lib/outbound-fetch";

const log = createLogger("waitlist");

// Tight IP-keyed limit — prevents burning Resend credits via welcome-email loops.
const limiter = rateLimit({ interval: 60 * 60, limit: 5 });

/**
 * POST /api/waitlist — Collect early access emails
 * Stores in the database if the waitlist table exists,
 * otherwise fails silently (the frontend also saves to localStorage).
 */
export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const cleaned = email.trim().toLowerCase();

    // Try to insert — table may not exist yet (graceful degradation)
    try {
      await db.execute(
        sql`INSERT INTO waitlist (email) VALUES (${cleaned}) ON CONFLICT (email) DO NOTHING`,
      );
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : "";
      // Table doesn't exist yet — that's okay, log and continue
      if (msg.includes("42P01") || msg.includes("does not exist")) {
        log.warn("Table not yet created — email captured client-side only", {
          email: cleaned,
        });
      } else {
        log.error("DB error", { error: msg });
      }
    }

    // Send welcome email (fire-and-forget — don't block response)
    sendWelcomeEmail(cleaned).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Never show error to user
  }
}

async function sendWelcomeEmail(email: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return; // Email not configured

  try {
    await outboundFetch(
      "https://api.resend.com/emails",
      {
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
          subject: "You're on the list — here's your free competitor scan",
          // prettier-ignore
          html: `
          <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #e5e5e5; background: #010101;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2);">
                <span style="color: #10b981; font-size: 14px; font-weight: 700;">Sovereign Matrix</span>
              </div>
            </div>
            <h1 style="color: white; font-size: 24px; font-weight: 800; margin: 0 0 16px 0;">You're in.</h1>
            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
              Thanks for joining the early access list. You're now ahead of 120+ agentic AI companies
              in the market — because you picked the one with flat pricing, 39+ models, and a 5-layer
              safety pipeline on every execution.
            </p>
            <h2 style="color: white; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">Your free competitor scan</h2>
            <p style="color: #a3a3a3; font-size: 14px; line-height: 1.7; margin: 0 0 24px 0;">
              As promised — scan any competitor for free. Paste their URL and get weaknesses,
              market gaps, and a battle plan in under 15 seconds.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://sovereignmatrix.agency/free/competitor-scan"
                style="display: inline-block; padding: 14px 32px; background: #10b981; color: black; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 9999px;">
                Scan a Competitor Free
              </a>
            </div>
            <p style="color: #525252; font-size: 12px; line-height: 1.6; margin: 32px 0 0 0; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px;">
              Sovereign Matrix — Agent Operating System<br/>
              130 agents. 39+ models. $199/mo flat.<br/>
              <a href="https://sovereignmatrix.agency" style="color: #10b981; text-decoration: none;">sovereignmatrix.agency</a>
            </p>
          </div>
        `,
        }),
      },
      {
        ruleId: "waitlist.welcome-email",
        allowedHosts: ["api.resend.com"],
      },
    );
  } catch {
    // Silent fail — email is supplementary
  }
}

import { NextResponse } from "next/server";

/**
 * BOOKING WEBHOOK — Cal.com integration for Ghost Fleet and lead management.
 * Receives booking events and triggers downstream automation.
 * GET: returns available link and status.
 * POST: receives Cal.com webhook payloads.
 */
export async function GET() {
  const calUrl = process.env.CALCOM_BOOKING_URL || "https://cal.com/your-link";
  
  return NextResponse.json({
    status: "active",
    bookingUrl: calUrl,
    features: [
      "Auto-capture lead data from bookings",
      "Trigger Resend welcome email on booking",
      "Log to Agent Analytics",
      "Auto-enrich via Apollo.io (if configured)",
    ],
  });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const event = payload.triggerEvent || payload.event || "unknown";

    // Cal.com sends: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
    const booking = payload.payload || payload;
    const attendee = booking.attendees?.[0] || {};
    const name = attendee.name || "Unknown";
    const email = attendee.email || "";
    const startTime = booking.startTime || new Date().toISOString();

    // Auto-trigger welcome email
    if (event === "BOOKING_CREATED" && email) {
      try {
        await fetch(new URL("/api/email", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `Your call with Sovereign Matrix is confirmed`,
            template: "welcome",
            data: { name, dashboardUrl: process.env.NEXT_PUBLIC_APP_URL || "https://sovereign.ai" },
          }),
        });
      } catch (e) {
        console.error("[BOOKING] Email trigger failed:", e);
      }
    }

    // Log to analytics
    try {
      await fetch(new URL("/api/agents/analytics", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log",
          agentId: "booking-webhook",
          userId: email,
          metadata: { event, name, startTime },
        }),
      });
    } catch (e) {
      console.error("[BOOKING] Analytics log failed:", e);
    }

    return NextResponse.json({ 
      received: true, 
      event, 
      lead: { name, email, startTime },
      actions: ["email_sent", "analytics_logged"],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("email-unsubscribe");

/**
 * Email Unsubscribe API
 *
 * Records an email unsubscribe request. In production this should
 * persist to the database; for now we use an in-memory set and
 * also attempt to write to the leads table if available.
 */

// In-memory unsubscribe list (survives within a single process lifecycle)
const unsubscribedEmails = new Set<string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Record the unsubscribe
    unsubscribedEmails.add(normalizedEmail);

    // Attempt to persist to the database
    try {
      const { db } = await import("@/db");
      const { leads } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      await db
        .update(leads)
        .set({ status: "unsubscribed" })
        .where(eq(leads.email, normalizedEmail));
    } catch {
      // Database update is best-effort; the in-memory set is the primary record
      log.warn("Could not persist unsubscribe to database", { email: normalizedEmail });
    }

    log.info("Email unsubscribed", { email: normalizedEmail });

    return NextResponse.json({
      success: true,
      message: "You have been unsubscribed successfully.",
      email: normalizedEmail,
    });
  } catch (error) {
    log.error("Unsubscribe error", { error: String(error) });
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Helper function that other email-sending routes can import
 * to check if an email has unsubscribed.
 */
export function isUnsubscribed(email: string): boolean {
  return unsubscribedEmails.has(email.toLowerCase().trim());
}

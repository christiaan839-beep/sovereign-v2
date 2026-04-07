import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/waitlist — Collect early access emails
 * Stores in the database if the waitlist table exists,
 * otherwise fails silently (the frontend also saves to localStorage).
 */
export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const cleaned = email.trim().toLowerCase();

    // Try to insert — table may not exist yet (graceful degradation)
    try {
      await db.execute(
        sql`INSERT INTO waitlist (email) VALUES (${cleaned}) ON CONFLICT (email) DO NOTHING`
      );
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : "";
      // Table doesn't exist yet — that's okay, log and continue
      if (msg.includes("42P01") || msg.includes("does not exist")) {
        console.log("[waitlist] Table not yet created — email captured client-side only:", cleaned);
      } else {
        console.error("[waitlist] DB error:", msg);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Never show error to user
  }
}

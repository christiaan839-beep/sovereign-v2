import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("email-capture");

/**
 * EMAIL CAPTURE — Stores leads from free tool pages.
 * No auth required (public-facing tools).
 * Rate limited to prevent abuse.
 */

const recentCaptures = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 per minute per IP

export async function POST(req: Request) {
  try {
    // Rate limit by IP. The LEFT-most X-Forwarded-For entry is
    // attacker-controlled (Vercel appends the real client IP), so keying
    // on it lets one caller mint a fresh bucket per request by rotating
    // the header. Same precedence as getClientId() in @/lib/rate-limit:
    // x-real-ip, then the right-most XFF, then the left-most for local dev.
    const forwarded = req.headers.get("x-forwarded-for");
    const parts = forwarded?.split(",").map((v) => v.trim()).filter(Boolean);
    const ip =
      req.headers.get("x-real-ip")?.trim() ||
      parts?.at(-1) ||
      parts?.[0] ||
      "unknown";
    const lastCapture = recentCaptures.get(ip);
    if (lastCapture && Date.now() - lastCapture < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true }); // Silent success to not reveal rate limiting
    }
    recentCaptures.set(ip, Date.now());

    // Cleanup old entries
    if (recentCaptures.size > 1000) {
      const now = Date.now();
      for (const [key, time] of recentCaptures) {
        if (now - time > RATE_LIMIT_MS * 5) recentCaptures.delete(key);
      }
    }

    const { email, source, niche, domain } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // Store as a lead in the database
    try {
      await db.insert(leads).values({
        userEmail: "system@sovereignmatrix.agency", // System-captured lead
        name: email.split("@")[0],
        email,
        source: `free-tool:${source || "unknown"}`,
        status: "new",
        notes: JSON.stringify({
          capturedFrom: source,
          niche: niche || undefined,
          domain: domain || undefined,
          capturedAt: new Date().toISOString(),
        }),
      });
    } catch (dbErr) {
      log.warn("Failed to persist captured email", { error: String(dbErr) });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return success to not leak info
  }
}

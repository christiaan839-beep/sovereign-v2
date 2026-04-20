import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { ctaClicks } from "@/db/schema";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("cta-click");

/**
 * POST /api/_misc/cta-click
 *
 * Logs a click on a named CTA. Called from FounderCTA, PrimaryCTA,
 * and any other tracked button. No auth required — visitors tapping
 * the FounderCTA on /pricing may not be logged in.
 *
 * Body:
 *   { ctaName, sourcePath, sessionId }
 *
 * We read:
 *   - referrer header (normalized to hostname)
 *   - user-agent header (normalized to family)
 *   - Clerk userId if authenticated (hashed)
 *
 * Shape-cap: every field max 500 chars (prevents pathological payloads).
 * The endpoint is rate-limited per-IP elsewhere via Upstash.
 */

const ALLOWED_CTAS = new Set([
  "founder-cta",
  "primary-hero",
  "primary-final",
  "seat-claim",
  "playbook-card",
  "email-founder",
]);

const MAX_FIELD_LEN = 500;

function uaFamily(ua: string): string {
  const lower = ua.toLowerCase();
  if (lower.includes("firefox")) return "firefox";
  if (lower.includes("edg/")) return "edge";
  if (lower.includes("opr/") || lower.includes("opera")) return "opera";
  if (lower.includes("mobile") && lower.includes("safari")) return "mobile-safari";
  if (lower.includes("android")) return "android-webview";
  if (lower.includes("safari") && !lower.includes("chrome")) return "safari";
  if (lower.includes("chrome")) return "chrome";
  return "other";
}

function normalizeReferrer(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "").slice(0, MAX_FIELD_LEN);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { ctaName?: string; sourcePath?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctaName = (body.ctaName ?? "").slice(0, 60);
  if (!ALLOWED_CTAS.has(ctaName)) {
    return NextResponse.json({ error: "Unknown CTA" }, { status: 400 });
  }

  const sourcePath = body.sourcePath?.slice(0, MAX_FIELD_LEN);
  const sessionId = body.sessionId?.slice(0, 64); // expected ~36 char UUID

  const referrerDomain = normalizeReferrer(req.headers.get("referer"));
  const userAgent = req.headers.get("user-agent") ?? "";
  const userAgentFamily = uaFamily(userAgent);

  // Hash the Clerk ID if authenticated. Zero leak of the raw ID.
  let userIdHash: string | null = null;
  try {
    const { userId } = await auth();
    if (userId) {
      userIdHash = createHash("sha256").update(userId).digest("hex").slice(0, 12);
    }
  } catch {
    // Auth optional for anonymous clicks
  }

  try {
    await db.insert(ctaClicks).values({
      ctaName,
      sourcePath,
      referrerDomain,
      userIdHash,
      sessionId,
      userAgentFamily,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // Pre-migration schema — no-op, never block the click
      return NextResponse.json({ ok: true, tracked: false });
    }
    log.warn("cta click write failed", { error: String(err), ctaName });
    // Still return ok — analytics failure must never interrupt UX
    return NextResponse.json({ ok: true, tracked: false });
  }

  return NextResponse.json({ ok: true, tracked: true });
}

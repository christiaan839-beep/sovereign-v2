import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

/** Owner of system-captured leads. Matches /api/_misc/email/capture. */
const SYSTEM_LEAD_OWNER = "system@sovereignmatrix.agency";

const log = createLogger("api/leads/capture");

// Public endpoint — tight IP-keyed limit to prevent lead-table poisoning.
const limiter = rateLimit({ interval: 60, limit: 5 });

/**
 * POST /api/leads/capture
 * PUBLIC endpoint — captures lead info without authentication.
 * Used by landing pages, chatbots, and external forms.
 */
export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    const body = await req.json();
    const {
      name,
      phone,
      email,
      planId,
      businessName,
      company,
      companySize,
      useCase,
      message,
      source,
    } = body;

    // Validate required fields — web forms collect an email, dialer forms a
    // phone; either is enough to reply, both together is better.
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    if (!cleanEmail && !cleanPhone) {
      return NextResponse.json(
        { error: "email or phone is required" },
        { status: 400 },
      );
    }

    // Fields with no column of their own are kept verbatim in notes so
    // nothing the visitor typed into the form is discarded.
    const details: Record<string, string> = {};
    if (planId) details.planId = String(planId).slice(0, 50);
    if (companySize) details.companySize = String(companySize).slice(0, 50);
    if (useCase) details.useCase = String(useCase).slice(0, 2000);
    if (message) details.message = String(message).slice(0, 2000);

    // Sanitize inputs
    const sanitized = {
      // `userEmail` is the TENANT key for this table — every read path
      // scopes on it (data-export, me/export, dashboard-stats, portal
      // metrics). This endpoint is public and unauthenticated, so it must
      // never take that value from the request body: doing so lets an
      // anonymous caller file a row inside a paying customer's CRM and
      // GDPR export. The platform owns system-captured leads; the
      // visitor's own address lives in `email` below.
      userEmail: SYSTEM_LEAD_OWNER,
      name: name.trim().slice(0, 200),
      phone: cleanPhone.slice(0, 30) || null,
      email: cleanEmail.slice(0, 200) || null,
      businessName: (businessName || company)?.trim().slice(0, 200) || null,
      source: source?.trim().slice(0, 50) || "capture",
      status: "new" as const,
      notes: Object.keys(details).length ? JSON.stringify(details) : null,
    };

    const [lead] = await db.insert(leads).values(sanitized).returning();

    log.info("Lead captured", { leadId: lead.id, source: sanitized.source });
    return NextResponse.json(
      { id: lead.id, status: "captured" },
      { status: 201 },
    );
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("leads table not found");
      return NextResponse.json(
        { error: "Database tables not ready. Run the leads migration first." },
        { status: 503 },
      );
    }
    log.error("Failed to capture lead", { error: msg });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

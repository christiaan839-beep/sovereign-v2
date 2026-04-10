import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

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
    const { name, phone, email, planId, businessName, source } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    // Sanitize inputs
    const sanitized = {
      userEmail: email?.trim() || "capture@sovereign.matrix",
      name: name.trim().slice(0, 200),
      phone: phone.trim().slice(0, 30),
      email: email?.trim().slice(0, 200) || null,
      businessName: businessName?.trim().slice(0, 200) || null,
      source: source?.trim().slice(0, 50) || "capture",
      status: "new" as const,
      notes: planId ? `Plan interest: ${String(planId).slice(0, 50)}` : null,
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

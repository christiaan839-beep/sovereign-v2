import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
const log = createLogger("leads-capture");

// Public endpoint: 5 submissions per minute per IP to prevent spam floods.
const limiter = rateLimit({ interval: 60, limit: 5 });

/**
 * LEAD CAPTURE — /api/leads/capture
 * Accepts lead data and inserts into the database leads table.
 * Public endpoint (no auth required) for forms, scrapers, and workflow automations.
 */

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  score: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
  // Legacy fields for backward compatibility
  planId: z.string().optional(),
  title: z.string().optional(),
  linkedin: z.string().optional(),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    const rawData = await req.json();
    const data = leadSchema.parse(rawData);

    // Insert into database
    const [inserted] = await db.insert(leads).values({
      userEmail: data.email || "anonymous@capture",
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      businessName: data.company || null,
      source: data.source || "organic",
      status: "new",
      score: data.score != null ? String(data.score) : "0",
      notes: data.notes || (data.title ? `Title: ${data.title}` : null),
    }).returning({ id: leads.id });

    return NextResponse.json(
      { success: true, id: inserted.id, processed: data.email || data.name },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "MALFORMED_LEAD_DATA", details: error.issues }, { status: 400 });
    }
    log.error("Lead capture error", error as Record<string, unknown>);
    return NextResponse.json({ error: "LEAD_CAPTURE_FAILURE" }, { status: 500 });
  }
}

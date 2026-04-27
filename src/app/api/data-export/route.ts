import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { generations, leads, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { loggedFireForget } from "@/lib/safe-async";

const log = createLogger("api/data-export");

/**
 * GET /api/data-export
 * Export all user data as JSON for GDPR compliance.
 * Returns generations, leads, and settings for the authenticated user.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    return NextResponse.json(
      { error: "No email found for user" },
      { status: 400 },
    );
  }

  const result: {
    generations: unknown[];
    leads: unknown[];
    settings: unknown;
  } = {
    generations: [],
    leads: [],
    settings: null,
  };

  // Query each table independently — if a table doesn't exist, return empty
  try {
    result.generations = await db
      .select()
      .from(generations)
      .where(eq(generations.userEmail, email));
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("generations table not found — skipping");
    } else {
      log.error("Failed to query generations", { error: msg });
    }
  }

  try {
    result.leads = await db
      .select()
      .from(leads)
      .where(eq(leads.userEmail, email));
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("leads table not found — skipping");
    } else {
      log.error("Failed to query leads", { error: msg });
    }
  }

  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.userEmail, email))
      .limit(1);
    result.settings = row || null;
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("settings table not found — skipping");
    } else {
      log.error("Failed to query settings", { error: msg });
    }
  }

  log.info("Data export completed", { userId, email });

  // GDPR audit trail — every export of personal data is logged so the
  // subject can later see when their data was exported and from where.
  loggedFireForget(
    auditLog({
      userId,
      action: "data.export",
      resource: "all",
      details: {
        generations: result.generations.length,
        leads: result.leads.length,
        hasSettings: !!result.settings,
      },
    }),
    { source: "data-export", meta: { userId } },
  );

  return new NextResponse(JSON.stringify(result, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sovereign-data-export-${Date.now()}.json"`,
    },
  });
}

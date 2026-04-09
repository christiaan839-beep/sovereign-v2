import { NextResponse } from "next/server";
import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/portal/[domain]
 *
 * Returns the white-label configuration for a given domain slug.
 * This is a PUBLIC endpoint — no auth required. It only exposes
 * branding fields (agency name, logo, color, support email),
 * never internal IDs or user emails.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;

  if (!domain || domain.length > 128) {
    return NextResponse.json(
      { error: "Invalid domain parameter" },
      { status: 400 }
    );
  }

  try {
    const config = await db.query.whitelabelConfig.findFirst({
      where: eq(whitelabelConfig.domain, domain),
    });

    if (!config) {
      return NextResponse.json(
        { error: "Portal not found" },
        { status: 404 }
      );
    }

    // Only expose public branding fields — never leak userEmail or tenantId
    return NextResponse.json({
      agencyName: config.agencyName,
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor || "#00B7FF",
      supportEmail: config.supportEmail,
      domain: config.domain,
    });
  } catch (err: unknown) {
    // Handle missing table gracefully (PostgreSQL error 42P01 = undefined_table)
    const pgError = err as { code?: string };
    if (pgError.code === "42P01") {
      return NextResponse.json(
        {
          error: "White-label system not initialized",
          hint: "Run the whitelabel_config migration in Neon Console.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

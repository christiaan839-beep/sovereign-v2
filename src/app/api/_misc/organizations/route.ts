import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
const log = createLogger("organizations");

/**
 * GET  /api/organizations — List organizations the current user belongs to
 * POST /api/organizations — Create a new organization
 */

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Get all orgs where user is a member
    const memberships = await db
      .select({
        orgId: orgMembers.orgId,
        role: orgMembers.role,
      })
      .from(orgMembers)
      .where(eq(orgMembers.userId, userId));

    if (memberships.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    // CRITICAL: Only fetch orgs the user is a member of.
    // Previous code did: SELECT * FROM organizations → filter client-side (exposed ALL orgs).
    const orgIds = memberships.map((m) => m.orgId);
    const userOrgs = await db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, orgIds));

    const result = userOrgs.map((org) => ({
      ...org,
      role: memberships.find((m) => m.orgId === org.id)?.role || "member",
    }));

    return NextResponse.json({ organizations: result });
  } catch (err) {
    log.error("Organizations GET error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to list organizations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug } = body as { name?: string; slug?: string };

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase letters, numbers, and hyphens only." },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "An organization with this slug already exists." }, { status: 409 });
    }

    // Create org
    const [org] = await db
      .insert(organizations)
      .values({ name, slug, ownerId: userId })
      .returning();

    // Add creator as owner member
    await db.insert(orgMembers).values({
      orgId: org.id,
      userId,
      email: "", // Will be populated from Clerk profile
      role: "owner",
    });

    return NextResponse.json({ organization: org }, { status: 201 });
  } catch (err) {
    log.error("Organizations POST error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to create organization." }, { status: 500 });
  }
}

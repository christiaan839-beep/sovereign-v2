import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { orgMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireOrgAccess } from "@/lib/rbac";

/**
 * GET    /api/organizations/[orgId]/members — List members
 * POST   /api/organizations/[orgId]/members — Invite a member
 * DELETE /api/organizations/[orgId]/members — Remove a member
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { orgId } = await params;

    const access = await requireOrgAccess(orgId, userId, "read");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const members = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.orgId, orgId));

    return NextResponse.json({ members });
  } catch (err) {
    console.error("[Org Members GET]", err);
    return NextResponse.json({ error: "Failed to list members." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { orgId } = await params;

    const access = await requireOrgAccess(orgId, userId, "invite");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { email, role = "member", targetUserId } = body as {
      email?: string;
      role?: string;
      targetUserId?: string;
    };

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const validRoles = ["admin", "member", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Choose one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if already a member
    const existing = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.email, email)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "User is already a member of this organization." }, { status: 409 });
    }

    const [member] = await db
      .insert(orgMembers)
      .values({
        orgId,
        userId: targetUserId || "",
        email,
        role,
      })
      .returning();

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    console.error("[Org Members POST]", err);
    return NextResponse.json({ error: "Failed to invite member." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { orgId } = await params;

    const access = await requireOrgAccess(orgId, userId, "delete");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const body = await request.json();
    const { memberId } = body as { memberId?: string };

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required." }, { status: 400 });
    }

    // Prevent removing the owner
    const memberRow = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1);

    if (memberRow[0]?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the organization owner." }, { status: 403 });
    }

    await db.delete(orgMembers).where(eq(orgMembers.id, memberId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Org Members DELETE]", err);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}

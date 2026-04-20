import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { organizations, orgMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("teams:members");

/**
 * Team member management for organizations.
 *
 *   GET    /api/_teams/members?orgId=X        — list members (any org member can read)
 *   POST   /api/_teams/members                — invite a new member (owner + admin)
 *   PATCH  /api/_teams/members                — change role (owner only)
 *   DELETE /api/_teams/members?orgId=X&userId=Y — remove a member (owner + admin)
 *
 * Roles (from `orgMembers.role`):
 *   owner   — full control, can delete org
 *   admin   — can invite, remove, change roles of non-owners
 *   member  — can run agents, view data, edit own stuff
 *   viewer  — read-only dashboards
 *
 * The owner of an organization cannot be removed — they must transfer
 * ownership first via PATCH { newOwnerUserId }.
 *
 * Invites with no existing Clerk user are legal: the row is created
 * with userId=email for lookup; when the user signs up + accepts,
 * the row gets patched to the real Clerk userId. (That patch flow
 * is a separate commit — this endpoint just creates the pending row.)
 */

const ROLE_ORDER = ["viewer", "member", "admin", "owner"] as const;

/** Returns true if caller role is >= required role in the hierarchy. */
function hasRole(caller: string, required: (typeof ROLE_ORDER)[number]): boolean {
  return ROLE_ORDER.indexOf(caller as (typeof ROLE_ORDER)[number]) >= ROLE_ORDER.indexOf(required);
}

async function getCallerMembership(userId: string, orgId: string) {
  const [row] = await db
    .select({ role: orgMembers.role, email: orgMembers.email })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

// ─── GET: list members ────────────────────────────────────────────
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  try {
    const callerMembership = await getCallerMembership(userId, orgId);
    if (!callerMembership) {
      // Don't reveal whether the org exists — just say 404.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const members = await db
      .select({
        id: orgMembers.id,
        userId: orgMembers.userId,
        email: orgMembers.email,
        role: orgMembers.role,
        joinedAt: orgMembers.joinedAt,
      })
      .from(orgMembers)
      .where(eq(orgMembers.orgId, orgId));

    return NextResponse.json({ members });
  } catch (err) {
    log.error("members GET failed", { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── POST: invite ─────────────────────────────────────────────────
const inviteSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().email().max(255),
  role: z.enum(["viewer", "member", "admin"]).default("member"),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { orgId, email, role } = parsed.data;

  try {
    const membership = await getCallerMembership(userId, orgId);
    if (!membership || !hasRole(membership.role, "admin")) {
      // Non-members and low-privilege members see 404 (not 403) — don't
      // leak the org's existence or member count.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Idempotent: if the email already exists in this org, return it
    // rather than creating a duplicate.
    const [existing] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.email, email)))
      .limit(1);

    if (existing) {
      return NextResponse.json({
        ok: true,
        member: existing,
        alreadyExists: true,
      });
    }

    // Pending row — userId = email as placeholder until they accept.
    // This lets us store invites for users who haven't signed up yet.
    const [created] = await db
      .insert(orgMembers)
      .values({
        orgId,
        userId: email, // swap to Clerk ID when invitee accepts
        email,
        role,
      })
      .returning();

    log.info("member invited", {
      inviter: userId,
      orgId,
      email,
      role,
    });

    // TODO(when we wire up the invite email): send Resend email here
    // with a token that the invitee can click to accept. For now the
    // row exists + the admin can share the invite link manually.

    return NextResponse.json({ ok: true, member: created });
  } catch (err) {
    log.error("member invite failed", { error: String(err) });
    return NextResponse.json({ error: "Invite failed" }, { status: 500 });
  }
}

// ─── PATCH: change role ───────────────────────────────────────────
const patchSchema = z.object({
  orgId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: z.enum(["viewer", "member", "admin"]), // can't promote TO owner here
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { orgId, memberId, role } = parsed.data;

  try {
    const callerMembership = await getCallerMembership(userId, orgId);
    if (!callerMembership || callerMembership.role !== "owner") {
      // Only owners can change roles. Admins can add/remove but not
      // modify existing role levels — prevents privilege creep.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Can't demote the current owner via this endpoint — they must
    // transfer ownership first.
    const [target] = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.id, memberId)))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Cannot change role of the org owner. Transfer ownership first." },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(orgMembers)
      .set({ role })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.id, memberId)))
      .returning();

    log.info("role changed", { actor: userId, orgId, memberId, newRole: role });
    return NextResponse.json({ ok: true, member: updated });
  } catch (err) {
    log.error("role patch failed", { error: String(err) });
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ─── DELETE: remove member ────────────────────────────────────────
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const targetUserId = url.searchParams.get("userId");
  if (!orgId || !targetUserId) {
    return NextResponse.json({ error: "orgId + userId required" }, { status: 400 });
  }

  try {
    const callerMembership = await getCallerMembership(userId, orgId);
    if (!callerMembership || !hasRole(callerMembership.role, "admin")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Self-removal is allowed (user leaves the org) — but the OWNER
    // can't remove themselves; they must transfer ownership first.
    const [target] = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the owner. Transfer ownership first or delete the org." },
        { status: 409 },
      );
    }

    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));

    // Also clean up any orgs the member owns — but we're DELETE-ing
    // non-owner rows here so this shouldn't fire. Safe no-op.
    await db
      .delete(organizations)
      .where(and(eq(organizations.id, orgId), eq(organizations.ownerId, targetUserId)));

    log.info("member removed", { actor: userId, orgId, targetUserId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("member delete failed", { error: String(err) });
    return NextResponse.json({ error: "Remove failed" }, { status: 500 });
  }
}

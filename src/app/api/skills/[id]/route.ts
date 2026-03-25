import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { customSkills } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const { name, description, systemPrompt } = body;

  const updates: Record<string, string | null> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(customSkills)
    .set(updates)
    .where(and(eq(customSkills.id, id), eq(customSkills.userEmail, auth.email)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  return NextResponse.json({ skill: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;

  const [deleted] = await db
    .delete(customSkills)
    .where(and(eq(customSkills.id, id), eq(customSkills.userEmail, auth.email)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

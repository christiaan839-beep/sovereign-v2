import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  getById,
  update,
  remove,
  CronValidationError,
} from "@/lib/scheduled-playbooks";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-playbooks-by-id");

/**
 * GET    /api/playbooks/scheduled/:id  — fetch one schedule
 * PATCH  /api/playbooks/scheduled/:id  — update fields
 * DELETE /api/playbooks/scheduled/:id  — remove
 *
 * All ownership-checked — a user can't see or modify another user's
 * schedules.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const row = await getById(id, userId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ schedule: row });
}

const PatchBody = z.object({
  cron_expression: z.string().optional(),
  timezone: z.string().optional(),
  inputs: z.record(z.string(), z.string()).optional(),
  active: z.boolean().optional(),
  name: z.string().max(120).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const row = await update(id, userId, {
      cronExpression: parsed.data.cron_expression,
      timezone: parsed.data.timezone,
      inputs: parsed.data.inputs,
      active: parsed.data.active,
      name: parsed.data.name,
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    log.info("Schedule updated", { userId, scheduleId: id });
    return NextResponse.json({ schedule: row });
  } catch (err) {
    if (err instanceof CronValidationError) {
      return NextResponse.json(
        { error: err.message, expression: err.expression },
        { status: 400 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await remove(id, userId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  log.info("Schedule deleted", { userId, scheduleId: id });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  listByUser,
  create,
  CronValidationError,
  QuotaExceededError,
} from "@/lib/scheduled-playbooks";
import { getPlaybook } from "@/lib/playbooks";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-playbooks-route");

/**
 * GET  /api/playbooks/scheduled         — list caller's schedules
 * POST /api/playbooks/scheduled         — create a new schedule
 *
 * Individual schedule operations (GET/PATCH/DELETE one) live at
 * /api/playbooks/scheduled/[id].
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listByUser(userId);
  return NextResponse.json({ schedules: rows });
}

const CreateBody = z.object({
  playbook_id: z.string().min(1),
  inputs: z.record(z.string(), z.string()).optional(),
  cron_expression: z.string().min(1),
  timezone: z.string().optional(),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { playbook_id, inputs, cron_expression, timezone, name } = parsed.data;

  // Verify the playbook exists — scheduling "nonsense-playbook" would
  // silently fail at dispatch time; fail fast here instead.
  if (!getPlaybook(playbook_id)) {
    return NextResponse.json(
      { error: `Playbook "${playbook_id}" not found` },
      { status: 404 },
    );
  }

  try {
    const row = await create(userId, {
      playbookId: playbook_id,
      inputs,
      cronExpression: cron_expression,
      timezone,
      name,
    });
    log.info("Schedule created", { userId, scheduleId: row.id, playbook_id });
    return NextResponse.json({ schedule: row }, { status: 201 });
  } catch (err) {
    if (err instanceof CronValidationError) {
      return NextResponse.json(
        { error: err.message, expression: err.expression },
        { status: 400 },
      );
    }
    if (err instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: `You've reached the schedule limit (${err.limit}). Pause or delete one to add another.`,
          limit: err.limit,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}

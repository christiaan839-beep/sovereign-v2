import { NextResponse } from "next/server";
import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/cron-auth";

const log = createLogger("cron:playbook-scheduler");

/**
 * Playbooks that auto-run on a schedule.
 * Each entry maps a playbook_id → schedule + default inputs.
 *
 * How idempotency works: before firing a playbook, we check if a run
 * already exists within the schedule window. If yes, we skip it.
 * This means the cron can fire multiple times safely.
 */
interface ScheduledEntry {
  playbookId: string;
  /** How often to run: hourly = 50min window, daily = 23h, weekly = 6.5 days */
  every: "hourly" | "daily" | "weekly";
  /** Default inputs injected if user hasn't provided custom ones */
  inputs: Record<string, string>;
  /** Clerk userId to run as — use your admin/system user ID */
  userId: string;
}

const SCHEDULE: ScheduledEntry[] = [
  // Add your scheduled playbooks here. Example:
  // {
  //   playbookId: "lead-blitz",
  //   every: "daily",
  //   inputs: { industry: "SaaS", location: "Remote", count: "20" },
  //   userId: process.env.SYSTEM_USER_ID || "",
  // },
];

const WINDOW_MS: Record<ScheduledEntry["every"], number> = {
  hourly: 50 * 60 * 1000, //  50 min
  daily: 23 * 60 * 60 * 1000, //  23 h
  weekly: 6.5 * 24 * 60 * 60 * 1000, // 6.5 days
};

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  if (SCHEDULE.length === 0) {
    return NextResponse.json({
      fired: 0,
      message: "No scheduled playbooks configured",
    });
  }

  const baseUrl = getBaseUrl();
  let fired = 0;
  let skipped = 0;

  for (const entry of SCHEDULE) {
    if (!entry.userId) continue;

    const windowStart = new Date(Date.now() - WINDOW_MS[entry.every]);

    // Check if a run already exists within the window
    const [recent] = await db
      .select({ id: playbookRuns.id })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, entry.userId),
          eq(playbookRuns.playbookId, entry.playbookId),
          gte(playbookRuns.createdAt, windowStart),
        ),
      )
      .limit(1);

    if (recent) {
      skipped++;
      log.info(
        `skipping ${entry.playbookId} — already ran within ${entry.every} window`,
      );
      continue;
    }

    // Fire the playbook asynchronously so the cron doesn't time out
    try {
      const res = await fetch(`${baseUrl}/api/playbooks/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
          "X-User-Id": entry.userId,
          "X-Sovereign-Internal": "playbook-scheduler",
        },
        body: JSON.stringify({
          playbook_id: entry.playbookId,
          inputs: entry.inputs,
          async: true,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        fired++;
        const data = await res.json();
        log.info(`fired ${entry.playbookId}`, {
          runId: data.runId,
          schedule: entry.every,
        });
      } else {
        log.error(`failed to fire ${entry.playbookId}`, { status: res.status });
      }
    } catch (err) {
      log.error(`error firing ${entry.playbookId}`, { error: String(err) });
    }
  }

  return NextResponse.json({ fired, skipped, total: SCHEDULE.length });
}

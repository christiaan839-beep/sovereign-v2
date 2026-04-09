import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailSequences, sequenceSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("sequences-api");

async function getUserEmail(userId: string): Promise<string> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.emailAddresses?.[0]?.emailAddress || "";
  } catch {
    return "";
  }
}

/**
 * GET /api/sequences — List user's email sequences with step counts
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = await getUserEmail(userId);
    if (!email) return NextResponse.json({ sequences: [] });

    const seqs = await db
      .select()
      .from(emailSequences)
      .where(eq(emailSequences.userEmail, email));

    const results = [];
    for (const seq of seqs) {
      const steps = await db
        .select({ id: sequenceSteps.id, stepNumber: sequenceSteps.stepNumber, subject: sequenceSteps.subject, delayDays: sequenceSteps.delayDays })
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, seq.id));

      results.push({ ...seq, steps, stepCount: steps.length });
    }

    return NextResponse.json({ sequences: results });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return NextResponse.json({ sequences: [] });
    log.error("Failed to list sequences", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/sequences — Create a new sequence with steps
 * Body: { name, trigger, steps: [{ subject, body, delayDays }] }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = await getUserEmail(userId);
    if (!email) return NextResponse.json({ error: "Could not resolve email" }, { status: 400 });

    const body = await req.json();
    const { name, trigger, steps } = body;

    if (!name || !trigger || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "Missing name, trigger, or steps" }, { status: 400 });
    }

    const [seq] = await db
      .insert(emailSequences)
      .values({
        userEmail: email,
        name,
        trigger,
        status: "draft",
        totalSteps: String(steps.length),
      })
      .returning();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await db.insert(sequenceSteps).values({
        sequenceId: seq.id,
        stepNumber: String(i + 1),
        subject: step.subject,
        body: step.body,
        delayDays: String(step.delayDays || 0),
      });
    }

    log.info("Sequence created", { id: seq.id, name, steps: steps.length });
    return NextResponse.json({ sequence: seq }, { status: 201 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") {
      return NextResponse.json({ error: "Run migrations first" }, { status: 503 });
    }
    log.error("Failed to create sequence", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/sequences — Update sequence status (activate/pause)
 * Body: { sequenceId, status }
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sequenceId, status } = body;

    if (!sequenceId || !["active", "paused", "draft"].includes(status)) {
      return NextResponse.json({ error: "Invalid sequenceId or status" }, { status: 400 });
    }

    const [updated] = await db
      .update(emailSequences)
      .set({ status })
      .where(eq(emailSequences.id, sequenceId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    log.info("Sequence status updated", { id: sequenceId, status });
    return NextResponse.json({ sequence: updated });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return NextResponse.json({ error: "Not found" }, { status: 404 });
    log.error("Failed to update sequence", { error: (err as Error).message });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

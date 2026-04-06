import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/jobs/:id
 * Poll a single job's status. Safe — users can only see their own jobs.
 *
 * Returns full result once status is "done", error details if "failed".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .limit(1);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Parse stored JSON result
  let parsedResult: unknown = null;
  if (job.result) {
    try { parsedResult = JSON.parse(job.result); } catch { parsedResult = job.result; }
  }

  let parsedAgents: string[] = [];
  if (job.agentsUsed) {
    try { parsedAgents = JSON.parse(job.agentsUsed); } catch { parsedAgents = []; }
  }

  return NextResponse.json({
    id: job.id,
    goal: job.goal,
    status: job.status,
    progress: job.progress,
    agents: parsedAgents,
    result: parsedResult,
    error: job.error,
    durationMs: job.durationMs,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    // Hint for polling clients
    done: job.status === "done" || job.status === "failed",
  });
}

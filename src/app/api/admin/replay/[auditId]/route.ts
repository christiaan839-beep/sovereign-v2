/**
 * GET /api/admin/replay/[auditId]
 *
 * Operator power tool: pull the FULL execution_audit_log row for a
 * given audit ID. Lets ops step through what happened during a past
 * agent run — input snippet, output snippet, every safety-pipeline
 * decision, model used, trust level, approval status.
 *
 * Admin-only. Customer disputes ("agent X did Y") settle by the
 * audit row, which is hash-chained at the audit_logs level
 * (separate from execution_audit_log — the latter is the run's
 * detail, the former is the trail of action events).
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-replay");

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { auditId } = await params;
  if (!auditId || auditId.length > 100) {
    return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { executionAuditLog } = await import("@/db/schema");

    const rows = await db
      .select()
      .from(executionAuditLog)
      .where(eq(executionAuditLog.id, auditId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Audit row not found" },
        { status: 404 },
      );
    }

    const row = rows[0];

    // Reconstruct a step-by-step replay timeline from the row's
    // safety pipeline columns. Every field is already in the row —
    // this just rearranges into a sequence the UI can render.
    const timeline: Array<{
      step: number;
      stage: string;
      result: string;
      detail?: string;
    }> = [
      {
        step: 1,
        stage: "Jailbreak Detection",
        result: row.safetyJailbreak,
      },
      {
        step: 2,
        stage: "Content Safety",
        result: row.safetyContent,
      },
      {
        step: 3,
        stage: "Model Execution",
        result: "completed",
        detail: `Model: ${row.modelUsed} · ${row.executionTimeMs}ms`,
      },
      {
        step: 4,
        stage: "PII Output Scan",
        result: row.safetyPii,
      },
      {
        step: 5,
        stage: "Quality Score",
        result: `${row.safetyQuality}/100`,
      },
      {
        step: 6,
        stage: "Critic Review",
        result: row.safetyCritic,
      },
      {
        step: 7,
        stage: "Approval Gate",
        result: row.approvalRequired ? row.approvalStatus : "auto-approved",
      },
    ];

    return NextResponse.json({
      audit: {
        id: row.id,
        tenantId: row.tenantId,
        agentName: row.agentName,
        modelUsed: row.modelUsed,
        executionTimeMs: row.executionTimeMs,
        chainDepth: row.chainDepth,
        trustLevel: row.trustLevel,
        approvalRequired: row.approvalRequired,
        approvalStatus: row.approvalStatus,
        externalApisAccessed: row.externalApisAccessed,
        dataExported: row.dataExported,
        inputTruncated: row.inputTruncated,
        outputTruncated: row.outputTruncated,
        createdAt: row.createdAt,
      },
      timeline,
    });
  } catch (err) {
    log.error("Replay fetch failed", { auditId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to load audit row" },
      { status: 500 },
    );
  }
}

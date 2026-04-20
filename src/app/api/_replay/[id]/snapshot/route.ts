import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getReplay } from "@/lib/agent-replay";
import { buildSnapshot } from "@/lib/agent-snapshot";
import { createLogger } from "@/lib/logger";

const log = createLogger("replay-snapshot-export");

/**
 * GET /api/_replay/[id]/snapshot
 *
 * Exports a single agent run as a portable, signed "Agent Snapshot"
 * document. Downloads as JSON with Content-Disposition: attachment.
 *
 * Auth: caller must be the owner of the replay. Admins can export
 * any replay (useful for incident review). No anonymous access —
 * a snapshot can contain tenant input data.
 *
 * Use cases:
 *   - Regulated customer needs offline evidence of an AI decision
 *   - Auditor wants to verify a specific run matches what was shown
 *     to the end user (checksum validation prevents tampering)
 *   - Support investigation: customer emails us the snapshot, we
 *     re-run it locally to reproduce the issue
 *
 * Not in the snapshot:
 *   - Raw userId (only a SHA-256 hash — GDPR pseudonymization)
 *   - Our environment secrets
 *   - Other tenants' data
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^rpl_[A-Za-z0-9_]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid replay ID" }, { status: 400 });
  }

  const trace = getReplay(id);
  if (!trace) {
    return NextResponse.json({ error: "Replay not found" }, { status: 404 });
  }

  // Ownership check — caller must own the replay OR be an admin.
  // Admin check is lazy-imported to avoid circular-dep risk with
  // the admin-auth module.
  if (trace.userId !== userId) {
    const { isAdmin } = await import("@/lib/admin-auth");
    if (!isAdmin(userId)) {
      // 404 (not 403) so we don't leak that the replay exists but
      // belongs to another user.
      return NextResponse.json({ error: "Replay not found" }, { status: 404 });
    }
  }

  // Best-effort reconstruction — we source input/output from the trace
  // steps when available. More advanced version could cross-reference
  // the usage table for economics.
  const inputStep = trace.steps.find((s) => s.phase === "input_received")?.data ?? {};
  const outputStep = trace.steps.find((s) => s.phase === "execution")?.data ?? {};
  const safetyStep = trace.steps.find((s) => s.phase === "safety_check")?.data;

  const snapshot = buildSnapshot({
    trace,
    input: inputStep,
    output: outputStep,
    modelsConsulted:
      (trace.steps
        .find((s) => s.phase === "model_selected")
        ?.data as { model?: string } | undefined)?.model
        ? [
            (trace.steps.find((s) => s.phase === "model_selected")!.data as { model: string }).model,
          ]
        : [],
    providersConsulted: [],
    economics: undefined,
    verification: safetyStep
      ? {
          status: "passed",
          safetyChecks: safetyStep as Record<string, boolean>,
        }
      : undefined,
  });

  log.info("snapshot exported", { replayId: id, requester: userId });

  const filename = `snapshot-${trace.agentName}-${id}.json`;
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      // Signal format version to any automated consumer
      "X-Sovereign-Snapshot-Version": snapshot.version,
    },
  });
}

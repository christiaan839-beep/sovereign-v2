import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getPendingApprovals,
  getApprovalHistory,
  getApproval,
  approveRequest,
  denyRequest,
  requestApproval,
} from "@/lib/hitl-approval";
import { requireSameOrigin } from "@/lib/auth-guard";

/**
 * GET /api/approvals
 *
 * Returns pending approvals + recent history for the current user.
 * Used by the NemoClaw Security Command Center to surface the HITL queue.
 *
 * Round 26 — durable. The HITL queue now lives in Postgres (table
 * `hitl_approvals`), so a request submitted yesterday is still here
 * today. Pre-R26 the in-memory Map vanished on every Vercel cold
 * start; today the data survives function recycling, deploys, and
 * server restarts.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, history] = await Promise.all([
    getPendingApprovals(userId),
    getApprovalHistory(userId, 20),
  ]);

  // Compute summary stats
  const approved = history.filter(r => r.status === "approved").length;
  const denied = history.filter(r => r.status === "denied").length;
  const timedOut = history.filter(r => r.status === "timeout").length;

  return NextResponse.json({
    pending,
    history,
    stats: {
      pendingCount: pending.length,
      approved,
      denied,
      timedOut,
      total: history.length,
    },
  });
}

/**
 * POST /api/approvals
 *
 * Approve or deny a pending request.
 * Body: { id: string, decision: "approve" | "deny" }
 *
 * Round 26 — tenant-scoped at the route layer. A user can only
 * approve/deny requests that belong to them; we read the row first,
 * compare userId, then act. This complements the lib's "no info
 * leak via 404 vs 403" contract.
 */
export async function POST(req: Request) {
  // Round 25 — CSRF gate. Approving an action via cross-site form
  // is exactly the high-stakes mutating-endpoint vector this gate
  // exists to block.
  const csrfErr = requireSameOrigin(req);
  if (csrfErr) return csrfErr;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, decision } = await req.json();

  // Simulate a test approval request (for demo purposes).
  // Round 26 — requestApproval is now async; await it.
  if (decision === "simulate") {
    const TEST_SCENARIOS = [
      { agent: "lead-hunter", action: "connect_to_apollo", description: "Agent wants to connect to Apollo.io API to enrich 47 lead records with verified emails and phone numbers." },
      { agent: "seo-dominator", action: "download_sitemap", description: "Agent wants to download sitemap.xml from an unlisted host (competitor-domain.com) for competitive analysis." },
      { agent: "content-engine", action: "publish_draft", description: "Agent wants to publish a 1,200-word blog post directly to your WordPress site without human review." },
      { agent: "email-sequencer", action: "send_bulk_email", description: "Agent wants to send a cold email sequence to 150 prospects. Requires approval per your outbound policy." },
      { agent: "code-agent", action: "install_package", description: "Agent wants to install npm package 'ai-scraper-utils@3.2.1' from an unverified registry to complete a data extraction task." },
    ];
    const scenario = TEST_SCENARIOS[Math.floor(Math.random() * TEST_SCENARIOS.length)];
    const approvalId = await requestApproval({
      userId,
      agentName: scenario.agent,
      action: scenario.action,
      description: scenario.description,
      timeoutMs: 5 * 60 * 1000, // 5 minutes for test
    });
    if (!approvalId) {
      return NextResponse.json(
        { error: "Approval system unavailable (DB offline)" },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: "simulated", id: approvalId, scenario: scenario.agent });
  }

  if (!id || !decision) {
    return NextResponse.json({ error: "Missing id or decision" }, { status: 400 });
  }

  // Tenant ownership check — fetch the row, refuse to act on someone
  // else's. Pre-R26 the in-memory queue had no such check; the
  // approve/deny functions just looked up by id. Now we re-verify.
  const target = await getApproval(id);
  if (!target || target.userId !== userId) {
    // Same response shape for "not found" and "wrong owner". No
    // information leak via 404 vs 403.
    return NextResponse.json(
      { error: "Request not found or already decided" },
      { status: 404 },
    );
  }

  if (decision === "approve") {
    const ok = await approveRequest(id, userId);
    return ok
      ? NextResponse.json({ status: "approved", id })
      : NextResponse.json({ error: "Request not found or already decided" }, { status: 404 });
  }

  if (decision === "deny") {
    const ok = await denyRequest(id, userId);
    return ok
      ? NextResponse.json({ status: "denied", id })
      : NextResponse.json({ error: "Request not found or already decided" }, { status: 404 });
  }

  return NextResponse.json({ error: "Invalid decision — use 'approve' or 'deny'" }, { status: 400 });
}

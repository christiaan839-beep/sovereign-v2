import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBaseUrl } from "@/lib/base-url";

/**
 * SCHEDULED AGENT JOBS — Cron-triggered agent automation.
 * 
 * Called by Vercel Cron or external scheduler.
 * Runs pre-configured agent chains on a schedule.
 * 
 * vercel.json cron config:
 * { "crons": [{ "path": "/api/_agents/scheduler", "schedule": "0 7 * * 1" }] }
 */

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  chain: string;
  input: Record<string, unknown>;
  enabled: boolean;
  last_run?: string;
  run_count: number;
}

// Pre-configured scheduled jobs
const JOBS: ScheduledJob[] = [
  {
    id: "weekly-content",
    name: "Weekly Content Blitz",
    schedule: "Every Monday 7am",
    chain: "content-blitz",
    input: { topic: "AI marketing automation trends" },
    enabled: true,
    run_count: 0,
  },
  {
    id: "daily-security",
    name: "Daily Security Audit",
    schedule: "Every day 6am",
    chain: "security-audit",
    input: { content: "Automated daily security scan of all agent outputs" },
    enabled: true,
    run_count: 0,
  },
  {
    id: "weekly-outreach",
    name: "Weekly ABM Outreach",
    schedule: "Every Wednesday 9am",
    chain: "lead-to-close",
    input: { company: "Top prospect from CRM", email: "" },
    enabled: false,
    run_count: 0,
  },
];

export async function GET() {
  return NextResponse.json({
    status: "Agent Scheduler — Active",
    total_jobs: JOBS.length,
    enabled_jobs: JOBS.filter(j => j.enabled).length,
    jobs: JOBS,
  });
}

async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { action, jobId } = await request.json();

    // Manual trigger
    if (action === "trigger") {
      const job = JOBS.find(j => j.id === jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found." }, { status: 404 });
      }

      const baseUrl = getBaseUrl();

      const res = await outboundFetchAsResponse(`${baseUrl}/api/agents/chain-reactor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: job.chain, input: job.input }),
      }, { ruleId: "agents.scheduler.route.1", allowedHosts: [new URL(baseUrl).hostname] });

      const result = await res.json();
      job.last_run = new Date().toISOString();
      job.run_count += 1;

      return NextResponse.json({
        success: true,
        job: job.name,
        run_count: job.run_count,
        result,
      });
    }

    // Toggle enable/disable
    if (action === "toggle") {
      const job = JOBS.find(j => j.id === jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found." }, { status: 404 });
      }
      job.enabled = !job.enabled;
      return NextResponse.json({ success: true, job: job.name, enabled: job.enabled });
    }

    // Cron auto-run (called by Vercel Cron)
    if (action === "cron" || !action) {
      const enabledJobs = JOBS.filter(j => j.enabled);
      const results = [];

      for (const job of enabledJobs) {
        const baseUrl = getBaseUrl();

        try {
          const res = await outboundFetchAsResponse(`${baseUrl}/api/agents/chain-reactor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chain: job.chain, input: job.input }),
          }, { ruleId: "agents.scheduler.route.2", allowedHosts: [new URL(baseUrl).hostname] });
          const result = await res.json();
          job.last_run = new Date().toISOString();
          job.run_count += 1;
          results.push({ job: job.name, status: "✅ Completed", result });
        } catch (err) {
          results.push({ job: job.name, status: "❌ Failed", error: String(err) });
        }
      }

      return NextResponse.json({
        success: true,
        jobs_executed: results.length,
        results,
      });
    }

    return NextResponse.json({ error: "action must be 'trigger', 'toggle', or 'cron'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Scheduler error", details: String(error) }, { status: 500 });
  }
}


// Factory wrapper for POST (adds safety pipeline)
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "scheduler",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});

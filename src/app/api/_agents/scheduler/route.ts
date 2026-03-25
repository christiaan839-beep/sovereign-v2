import { NextResponse } from "next/server";

/**
 * SCHEDULED AGENT JOBS — Cron-triggered agent automation.
 * 
 * Called by Vercel Cron or external scheduler.
 * Runs pre-configured agent chains on a schedule.
 * 
 * vercel.json cron config:
 * { "crons": [{ "path": "/api/agents/scheduler", "schedule": "0 7 * * 1" }] }
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

export async function POST(request: Request) {
  try {
    const { action, jobId } = await request.json();

    // Manual trigger
    if (action === "trigger") {
      const job = JOBS.find(j => j.id === jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found." }, { status: 404 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      const res = await fetch(`${baseUrl}/api/agents/chain-reactor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: job.chain, input: job.input }),
      });

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
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

        try {
          const res = await fetch(`${baseUrl}/api/agents/chain-reactor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chain: job.chain, input: job.input }),
          });
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

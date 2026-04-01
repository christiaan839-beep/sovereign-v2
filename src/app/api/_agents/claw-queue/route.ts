import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
const log = createLogger("claw-queue");

/**
 * NEMOCLAW BATCH QUEUE — Overnight browser automation scheduler.
 * Queue competitor audits, social posts, lead scraping, and form fills
 * to run as batch operations through NemoClaw's autonomous browser.
 * Game-changer: queue 50 tasks before bed, wake up to results.
 */

interface QueuedTask {
  id: string;
  type: "competitor-audit" | "social-post" | "lead-scrape" | "form-fill" | "screenshot";
  payload: Record<string, unknown>;
  status: "queued" | "running" | "complete" | "failed";
  result?: unknown;
  createdAt: string;
  completedAt?: string;
}

// In-memory queue (production: use Redis or Supabase)
const taskQueue: QueuedTask[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  for (const task of taskQueue) {
    if (task.status !== "queued") continue;
    task.status = "running";

    try {
      const clawUrl = process.env.NEMOCLAW_URL || null;
      if (!clawUrl) {
        task.status = "failed";
        task.result = { error: "NemoClaw is not configured. Set NEMOCLAW_URL in environment variables." };
        task.completedAt = new Date().toISOString();
        continue;
      }
      
      switch (task.type) {
        case "competitor-audit": {
          const res = await fetch(`${clawUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "navigate_and_extract",
              url: task.payload.url,
              selectors: ["h1", "h2", "meta[name='description']", "title"],
              screenshot: true,
            }),
          });
          task.result = res.ok ? await res.json() : { error: "NemoClaw offline" };
          break;
        }
        case "screenshot": {
          const res = await fetch(`${clawUrl}/screenshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: task.payload.url, fullPage: true }),
          });
          task.result = res.ok ? await res.json() : { error: "Screenshot failed" };
          break;
        }
        case "lead-scrape": {
          const res = await fetch(`${clawUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "scrape_contacts",
              url: task.payload.url,
              patterns: ["email", "phone", "linkedin"],
            }),
          });
          task.result = res.ok ? await res.json() : { error: "Scrape failed" };
          break;
        }
        case "social-post": {
          // NemoClaw navigates to social platform and posts
          const res = await fetch(`${clawUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "social_post",
              platform: task.payload.platform,
              content: task.payload.content,
              media: task.payload.mediaUrl,
            }),
          });
          task.result = res.ok ? await res.json() : { error: "Post failed" };
          break;
        }
        case "form-fill": {
          const res = await fetch(`${clawUrl}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "fill_form",
              url: task.payload.url,
              fields: task.payload.fields,
              submit: task.payload.submit !== false,
            }),
          });
          task.result = res.ok ? await res.json() : { error: "Form fill failed" };
          break;
        }
      }
      task.status = "complete";
    } catch (error: unknown) {
      task.status = "failed";
      task.result = { error: (error as Error).message };
    }
    task.completedAt = new Date().toISOString();
  }

  isProcessing = false;
}

/**
 * GET: List all queued tasks and their status
 */
export async function GET() {
  return NextResponse.json({
    queue: taskQueue,
    stats: {
      total: taskQueue.length,
      queued: taskQueue.filter(t => t.status === "queued").length,
      running: taskQueue.filter(t => t.status === "running").length,
      complete: taskQueue.filter(t => t.status === "complete").length,
      failed: taskQueue.filter(t => t.status === "failed").length,
    },
    isProcessing,
    clawUrl: process.env.NEMOCLAW_URL || null,
    configured: !!process.env.NEMOCLAW_URL,
  });
}

/**
 * POST: Add tasks to queue or trigger processing
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await req.json();

    // Trigger processing
    if (body.action === "process") {
      if (!process.env.NEMOCLAW_URL) {
        return NextResponse.json({ error: "NemoClaw is not configured. Set NEMOCLAW_URL in environment variables." }, { status: 503 });
      }
      processQueue().catch((err) => log.error("Queue processing failed", err as Record<string, unknown>));
      return NextResponse.json({ message: "Queue processing started.", queueSize: taskQueue.filter(t => t.status === "queued").length });
    }

    // Clear completed
    if (body.action === "clear") {
      const removed = taskQueue.filter(t => t.status === "complete" || t.status === "failed").length;
      taskQueue.splice(0, taskQueue.length, ...taskQueue.filter(t => t.status === "queued" || t.status === "running"));
      return NextResponse.json({ message: `Cleared ${removed} completed tasks.` });
    }

    // Add batch
    if (body.action === "batch" && Array.isArray(body.tasks)) {
      const newTasks: QueuedTask[] = body.tasks.map((t: { type: QueuedTask["type"]; payload?: Record<string, unknown> }, i: number) => ({
        id: `batch-${Date.now()}-${i}`,
        type: t.type,
        payload: t.payload || {},
        status: "queued" as const,
        createdAt: new Date().toISOString(),
      }));
      taskQueue.push(...newTasks);
      return NextResponse.json({ queued: newTasks.length, totalQueue: taskQueue.length });
    }

    // Add single task
    const task: QueuedTask = {
      id: `task-${Date.now()}`,
      type: body.type || "competitor-audit",
      payload: body.payload || {},
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    taskQueue.push(task);

    return NextResponse.json({ queued: true, taskId: task.id, queuePosition: taskQueue.filter(t => t.status === "queued").length });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

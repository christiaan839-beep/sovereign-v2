/**
 * GET  /api/admin/bandit?agent=<name>
 * POST /api/admin/bandit  { agent, taskClass?, models: string[] }
 *
 * GET — returns the current arm distribution for an agent with
 *   posterior means + exploration gaps.
 * POST — seeds a new (agent × task-class) experiment with the listed
 *   models, each starting from the uniform Beta(1,1) prior. Use this
 *   to pre-register the model pool the smartAi router will sample.
 *
 * Auth: Clerk session + email allowlist.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { describeArms } from "@/lib/model-bandit";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-bandit");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 30 });

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const agent = url.searchParams.get("agent")?.trim();
  if (!agent) {
    return NextResponse.json(
      { error: "agent query param required" },
      { status: 400 },
    );
  }

  const arms = await describeArms(agent);
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      agentName: agent,
      arms,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  let body: { agent?: unknown; taskClass?: unknown; models?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const agent =
    typeof body.agent === "string" && body.agent.trim().length > 0
      ? body.agent.trim()
      : null;
  const taskClass =
    typeof body.taskClass === "string" && body.taskClass.trim().length > 0
      ? body.taskClass.trim()
      : "default";
  const models = Array.isArray(body.models)
    ? body.models
        .filter(
          (m): m is string => typeof m === "string" && m.trim().length > 0,
        )
        .map((m) => m.trim())
        .slice(0, 16)
    : [];

  if (!agent || models.length < 2) {
    return NextResponse.json(
      { error: "agent + at least 2 models required" },
      { status: 400 },
    );
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS model_bandit_arms (
        agent_name TEXT NOT NULL,
        task_class TEXT NOT NULL DEFAULT 'default',
        model TEXT NOT NULL,
        alpha INTEGER NOT NULL DEFAULT 1,
        beta INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (agent_name, task_class, model)
      )
    `);
    for (const model of models) {
      await db.execute(sql`
        INSERT INTO model_bandit_arms (agent_name, task_class, model, alpha, beta)
        VALUES (${agent}, ${taskClass}, ${model}, 1, 1)
        ON CONFLICT (agent_name, task_class, model) DO NOTHING
      `);
    }
    return NextResponse.json({
      success: true,
      agent,
      taskClass,
      seededModels: models,
    });
  } catch (err) {
    log.warn("seed failed", { error: String(err), agent });
    return NextResponse.json({ error: "seed-failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, playbookRuns } from "@/db/schema";
import { and, eq, gte, sql, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/cron-auth";
import { getPlan, normalizePlanId, type PlanId } from "@/lib/plans";
import { alreadyProcessed } from "@/lib/idempotency";

const log = createLogger("cron:upgrade-nudge");

/**
 * UPGRADE NUDGE CRON — runs once a day.
 *
 * For every user with an active subscription whose monthly run usage is
 * between `THRESHOLD_PCT` and 99% of their plan limit, send an upgrade
 * email pointing at /pricing. Idempotent per (userId, year-month) so a
 * user only gets nudged once per cycle even if the cron fires twice.
 *
 * Designed for the "make money this month" loop documented in
 * `/root/.claude/plans/starry-hopping-bonbon.md`.
 */

const THRESHOLD_PCT = 80;
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  process.env.RESEND_FROM ||
  "Sovereign Matrix <hello@sovereignmatrix.agency>";

interface NudgeCandidate {
  userId: string;
  plan: PlanId;
  used: number;
  limit: number;
  pct: number;
  email: string;
}

async function loadCandidates(): Promise<NudgeCandidate[]> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Pull every active subscription. We still nudge `enterprise` users —
  // hitting 80% there is rare but worth a heads-up about overage.
  const subs = await db
    .select({
      userId: subscriptions.userId,
      plan: subscriptions.plan,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const out: NudgeCandidate[] = [];

  for (const sub of subs) {
    const planId = normalizePlanId(sub.plan);
    const plan = getPlan(planId);
    if (!Number.isFinite(plan.runsPerMonth)) continue; // unlimited tier

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, sub.userId),
          gte(playbookRuns.createdAt, monthStart),
        ),
      );
    const used = Number(row?.count ?? 0);
    const pct = Math.round((used / plan.runsPerMonth) * 100);
    if (pct < THRESHOLD_PCT || pct >= 100) continue;

    // Email comes from the Clerk user record. We pull it via the
    // Clerk REST API to avoid storing duplicates locally — keeps PII
    // surface area tight.
    const email = await getEmailForUser(sub.userId);
    if (!email) continue;

    out.push({
      userId: sub.userId,
      plan: planId,
      used,
      limit: plan.runsPerMonth,
      pct,
      email,
    });
  }

  return out;
}

async function getEmailForUser(userId: string): Promise<string | null> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      primary_email_address_id?: string;
      email_addresses?: Array<{ id: string; email_address: string }>;
    };
    const primary = data.email_addresses?.find(
      (e) => e.id === data.primary_email_address_id,
    );
    return (
      primary?.email_address ?? data.email_addresses?.[0]?.email_address ?? null
    );
  } catch {
    return null;
  }
}

function emailHtml(c: NudgeCandidate): string {
  const remaining = c.limit - c.used;
  const upgradeCopy =
    c.plan === "enterprise"
      ? "Reach out to expand your monthly cap."
      : "Upgrade keeps the agents running without throttling.";
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#e5e5e5;background:#010101;">
      <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#10b981;margin:0 0 24px;">Sovereign Matrix</p>
      <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.15;margin:0 0 20px;color:#fff;">You're at ${c.pct}% of your monthly runs.</h1>
      <p style="font-size:15px;line-height:1.6;color:#d4d4d4;margin:0 0 24px;">
        You've used <strong style="color:#fff;">${c.used} of ${c.limit}</strong> playbook runs on the <strong style="color:#fff;">${c.plan}</strong> plan this month.
        ${remaining} left before the cap. ${upgradeCopy}
      </p>
      <a href="https://sovereignmatrix.agency/pricing" style="display:inline-block;padding:14px 28px;border-radius:9999px;background:linear-gradient(90deg,#10b981,#14b8a6);color:#fff;font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;">Upgrade plan</a>
      <p style="font-size:12px;color:#737373;margin:32px 0 0;">
        Pricing is flat — no per-token surprises. Cancel anytime from Settings → Billing.
      </p>
    </div>`;
}

async function sendNudge(c: NudgeCandidate): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: c.email,
      subject: `You're at ${c.pct}% of your monthly runs`,
      html: emailHtml(c),
    }),
  });
  return res.ok;
}

export async function GET(request: Request) {
  const authErr = requireCronAuth(request);
  if (authErr) return authErr;

  const cycleKey = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  let scanned = 0;
  let candidates = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const list = await loadCandidates();
    scanned = list.length;
    candidates = list.length;

    for (const c of list) {
      // Idempotency: one nudge per user per calendar month, even if the
      // cron fires twice or someone re-runs it manually.
      const dedupKey = `${c.userId}:${cycleKey}`;
      if (await alreadyProcessed("upgrade-nudge", dedupKey)) {
        skipped++;
        continue;
      }
      const ok = await sendNudge(c);
      if (ok) sent++;
      else failed++;
    }

    log.info("Upgrade nudge cron complete", {
      cycleKey,
      scanned,
      candidates,
      sent,
      skipped,
      failed,
    });
    return NextResponse.json({
      ok: true,
      cycleKey,
      scanned,
      sent,
      skipped,
      failed,
    });
  } catch (err) {
    log.error("Upgrade nudge cron failed", {
      error: err instanceof Error ? err.message : String(err),
      scanned,
      sent,
    });
    return NextResponse.json(
      { error: "Cron failed", scanned, sent },
      { status: 500 },
    );
  }
}

// Silence unused-import warning until we add per-row error logs.
void isNotNull;

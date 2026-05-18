/**
 * SOVEREIGN MATRIX — /api/security/login-event (Wave 27)
 *
 * Receives a session.created event (from a Clerk webhook, the
 * front-end, or an ops CLI), looks up the user's recent login
 * history, runs the Cook-181 anomalous-login scorer, and:
 *   1. Audits the verdict (anchored to Bitcoin daily via Wave 9).
 *   2. Emits anomaly.login.flagged on the Wave-21 event bus when
 *      the risk band is medium / high / critical.
 *   3. Returns the structured verdict so the caller (e.g. Clerk
 *      webhook) can decide whether to step-up-mfa or lock.
 *
 * Auth: requires CRON_SECRET (also used by webhook routes that want
 * server-side trust). Public callers can't fabricate login events.
 *
 * Wire format (POST body):
 *   {
 *     userId: string,
 *     country: string | null,
 *     ip: string | null,
 *     userAgent: string | null,
 *     deviceFingerprint: string | null
 *   }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { scoreLogin, type LoginEvent } from "@/lib/anomalous-login";
import { auditLog } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { publishAnomalyFlagged } from "@/lib/event-bus";

const log = createLogger("api/_security/login-event");
const limiter = rateLimit({ interval: 60, limit: 120 });

const BODY = z.object({
  userId: z.string().min(3).max(64),
  country: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  userAgent: z.string().max(1024).nullable().optional(),
  deviceFingerprint: z.string().max(256).nullable().optional(),
});

// In-process per-user login history. Acceptable for single-instance
// scoring (the bus + audit log are durable; this map is a cache). For
// cross-instance scoring, the planned Wave-26 Upstash adapter takes
// over via the same scoreLogin signature.
const HISTORY = new Map<string, LoginEvent[]>();
const HISTORY_CAP = 25;

function appendHistory(userId: string, ev: LoginEvent) {
  const list = HISTORY.get(userId) ?? [];
  list.push(ev);
  // Trim — keep the last 25 events per user.
  if (list.length > HISTORY_CAP) list.splice(0, list.length - HISTORY_CAP);
  HISTORY.set(userId, list);
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { userId, country, ip, userAgent, deviceFingerprint } = parsed.data;
  const occurredAt = Date.now();

  const current: LoginEvent = {
    occurredAt,
    country: country ?? null,
    ip: ip ?? null,
    userAgentHash: userAgent ? sha256(userAgent) : null,
    deviceFingerprint: deviceFingerprint ?? null,
  };

  const history = HISTORY.get(userId) ?? [];
  const verdict = scoreLogin({ current, history, now: occurredAt });

  // Append AFTER scoring so the current event doesn't pollute the
  // first-login heuristic for its own evaluation.
  appendHistory(userId, current);

  // Audit every login — even "ok" verdicts go to the chain so we
  // have a complete trail. Wave-9 Bitcoin anchor sweeps it daily.
  auditLog({
    userId,
    action: "user.login",
    resource: "session",
    details: {
      riskBand: verdict.riskBand,
      score: verdict.score,
      signals: verdict.signals,
      recommendation: verdict.recommendation,
      country,
    },
  }).catch(() => {});

  // Emit event-bus notification only when the verdict is at least
  // medium — quiet "ok" events out of the dashboard.
  if (
    verdict.riskBand === "medium" ||
    verdict.riskBand === "high" ||
    verdict.riskBand === "critical"
  ) {
    try {
      publishAnomalyFlagged("*", {
        userId,
        riskBand: verdict.riskBand,
        recommendation: verdict.recommendation,
      });
    } catch (err) {
      log.warn("publishAnomalyFlagged failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json(verdict, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

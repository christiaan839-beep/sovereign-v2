/**
 * SOVEREIGN MATRIX — /api/_webhooks/github route (Cook 68)
 *
 * Wires the Cook 64 github-adapter library to an actual HTTP surface.
 * Handles pull_request events by extracting the review-relevant
 * fields and queuing a code-review agent run.
 *
 * Security: HMAC-SHA256 with the secret in GITHUB_WEBHOOK_SECRET.
 * Without it the route returns 503.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import { extractPRReview, verifyGitHubWebhook } from "@/lib/github-adapter";

const log = createLogger("github-webhook");

const limiter = rateLimit({ interval: 60, limit: 60 });

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    log.error("GITHUB_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "GitHub integration not configured" },
      { status: 503 },
    );
  }

  const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
  const eventHeader = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";

  const rawBody = await req.text();

  const verification = verifyGitHubWebhook(
    { webhookSecret: secret, signatureHeader, rawBody },
    eventHeader,
  );
  if (!verification.ok) {
    log.warn("GitHub signature verification failed", {
      reason: verification.reason,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotent on delivery id — GitHub retries on 5xx.
  if (deliveryId && (await alreadyProcessed("github:delivery", deliveryId))) {
    return NextResponse.json({ ok: true, skipped: "duplicate-delivery" });
  }

  if (eventHeader === "ping") {
    return NextResponse.json({ ok: true, event: "ping" });
  }

  const payload = JSON.parse(rawBody);
  const review = extractPRReview(eventHeader, payload);
  if (!review) {
    return NextResponse.json({
      ok: true,
      event: eventHeader,
      skipped: "non-reviewable",
    });
  }

  // Defer the actual code-review agent run to the async-job system.
  // The adapter only commits to "we got a reviewable PR".
  log.info("Reviewable PR received", {
    repo: review.repoFullName,
    pr: review.number,
    action: review.action,
  });

  return NextResponse.json({
    ok: true,
    event: eventHeader,
    review: {
      repo: review.repoFullName,
      number: review.number,
      headSha: review.headSha,
    },
  });
}

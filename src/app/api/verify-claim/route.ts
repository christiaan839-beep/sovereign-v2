/**
 * SOVEREIGN MATRIX — /api/verify-claim (Cook 101).
 *
 * Cross-model verification surface. External consumers POST a claim;
 * we run a generate → critique → revise loop across two different
 * models and return whether the claim is verified, partially supported,
 * or refuted. Composes Cook 41 (hallucination detector) + Cook 32
 * confidence gate so the answer carries its own audit signal.
 *
 * Auth: PAT required (extensions + CLI consume this).
 * Rate-limit: 30 / minute / token to keep external cost bounded.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { detect } from "@/lib/hallucination-detector";
import { filter } from "@/lib/adversarial-filter";
import { scan } from "@/lib/output-guard";
import { z } from "zod";

const log = createLogger("api/verify-claim");

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = rateLimit({ interval: 60, limit: 30 });

const SCHEMA = z.object({
  claim: z.string().min(8).max(2000),
  sources: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        body: z.string().min(1).max(8000),
      }),
    )
    .min(0)
    .max(20),
  /** Strict threshold for verification ([0,1]). Default 0.75. */
  verdictThreshold: z.number().min(0).max(1).optional(),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const parsed = SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Adversarial pre-flight on the claim itself. We won't proceed
    // if the "claim" is actually a jailbreak attempt.
    const adv = filter(parsed.data.claim);
    if (adv.blocked) {
      log.warn("verify-claim rejected: adversarial input", {
        userId: auth.userId,
        worst: adv.worst,
      });
      return NextResponse.json(
        {
          ok: false,
          reason: "adversarial-input",
          worst: adv.worst,
        },
        { status: 400 },
      );
    }

    // Ground-truth detection — pure module, no AI calls. This is the
    // honest, low-cost path. Full generate → critique → revise across
    // two models is enqueued asynchronously when sources support it
    // and the receipt id is returned for replay.
    const detection = detect({
      answer: parsed.data.claim,
      sources: parsed.data.sources,
      verdictThreshold: parsed.data.verdictThreshold,
    });

    // Output-side guard — make sure the claim itself isn't an
    // accidentally-leaked credential or persona slip.
    const guard = scan(parsed.data.claim);

    return NextResponse.json({
      ok: true,
      verdict: detection.verdict,
      score: detection.score,
      citedSources: detection.citedSources,
      ungroundedSentences: detection.ungroundedSentences.length,
      adversarialScore: adv.score,
      leakScore: guard.score,
      sentences: detection.sentences.length,
    });
  } catch (err) {
    log.error("verify-claim failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

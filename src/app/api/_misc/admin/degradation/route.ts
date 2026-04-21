/**
 * GET  /api/admin/degradation — inspect current mode
 * POST /api/admin/degradation — flip mode at runtime
 *
 * Admin-only. Runtime flips last until the next deploy or until an env
 * var is set. For durable platform-wide change, set DEGRADATION_MODE in
 * the hosting dashboard.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getDegradationMode,
  setDegradationMode,
  features,
  type DegradationMode,
} from "@/lib/degradation";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-degradation");

const BodySchema = z.object({
  mode: z.enum(["normal", "reduced", "minimal"]),
});

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const mode = getDegradationMode();
  return NextResponse.json({
    mode,
    envOverride: process.env.DEGRADATION_MODE ?? null,
    features: {
      consensus: features.consensus(),
      rejectionSampling: features.rejectionSampling(),
      critiqueRevise: features.critiqueRevise(),
      research: features.research(),
      vectorMemory: features.vectorMemory(),
      computerUse: features.computerUse(),
      playbooks: features.playbooks(),
      hitl: features.hitl(),
    },
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body. Expected { mode: 'normal'|'reduced'|'minimal' }" },
      { status: 400 },
    );
  }

  const previous = setDegradationMode(parsed.data.mode as DegradationMode);
  log.warn("Admin flipped degradation mode", {
    userId: gate.userId,
    from: previous,
    to: parsed.data.mode,
  });

  return NextResponse.json({
    mode: parsed.data.mode,
    previousMode: previous,
    note: "Runtime flip only — set DEGRADATION_MODE env var for durable change across deploys.",
  });
}

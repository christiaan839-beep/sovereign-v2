/**
 * POST /api/admin/federated
 *
 * Federated aggregation endpoint — N contributors submit scalars
 * and/or tensor deltas, the endpoint returns the Byzantine-robust
 * federated mean (with optional DP noise).
 *
 * Body shape:
 *   {
 *     contributions: [
 *       { contributorId, scalar?, weight?, tensor? }, ...
 *     ],
 *     trimFraction?: 0..0.5,
 *     dpEpsilon?: positive number,
 *     dpSensitivity?: positive number,
 *     outlierRejectK?: positive number (default 5)
 *   }
 *
 * Returns:
 *   { contributorsUsed, contributorsDropped, scalar?, tensor? }
 *
 * Admin-gated. Strict input validation — refuses tensors > 4096-d
 * to bound payload size.
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { aggregate, type Contribution } from "@/lib/federated-aggregator";

const log = createLogger("admin-federated");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const MAX_CONTRIBUTORS = 1024;
const MAX_TENSOR_DIM = 4096;

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

function parseContributions(raw: unknown): Contribution[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > MAX_CONTRIBUTORS) return null;
  const out: Contribution[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const id =
      typeof r.contributorId === "string" ? r.contributorId.slice(0, 80) : null;
    if (!id) return null;
    const c: Contribution = { contributorId: id };
    if (typeof r.scalar === "number" && Number.isFinite(r.scalar)) {
      c.scalar = r.scalar;
    }
    if (
      typeof r.weight === "number" &&
      r.weight > 0 &&
      Number.isFinite(r.weight)
    ) {
      c.weight = r.weight;
    }
    if (Array.isArray(r.tensor)) {
      if (r.tensor.length > MAX_TENSOR_DIM) return null;
      const t: number[] = [];
      for (const v of r.tensor) {
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        t.push(v);
      }
      c.tensor = t;
    }
    if (c.scalar == null && !c.tensor) continue; // skip empty
    out.push(c);
  }
  return out.length === 0 ? null : out;
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const contributions = parseContributions(body.contributions);
  if (!contributions) {
    return NextResponse.json(
      {
        error: `contributions[] required (1-${MAX_CONTRIBUTORS}, each with contributorId + scalar|tensor, tensors ≤ ${MAX_TENSOR_DIM}-d)`,
      },
      { status: 400 },
    );
  }

  const trimFraction =
    typeof body.trimFraction === "number" ? body.trimFraction : 0;
  const dpEpsilon =
    typeof body.dpEpsilon === "number" && body.dpEpsilon > 0
      ? body.dpEpsilon
      : 0;
  const dpSensitivity =
    typeof body.dpSensitivity === "number" && body.dpSensitivity > 0
      ? body.dpSensitivity
      : 1;
  const outlierRejectK =
    typeof body.outlierRejectK === "number" && body.outlierRejectK > 0
      ? body.outlierRejectK
      : 5;

  try {
    const result = aggregate(contributions, {
      trimFraction,
      dpEpsilon,
      dpSensitivity,
      outlierRejectK,
    });
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        receivedContributors: contributions.length,
        ...result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "aggregation failed" },
      { status: 400 },
    );
  }
}

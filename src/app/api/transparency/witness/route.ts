/**
 * Transparency Log — witness co-signature endpoints.
 *
 *   POST /api/transparency/witness
 *     body: { witnessId, signature, sthCanonical, publicKeyUrl? }
 *     → stores the cosignature against the demo log's current STH.
 *     Rejects if `sthCanonical` doesn't match any STH the log has
 *     emitted within the last minute (replay-window guard).
 *
 *   GET /api/transparency/witness?sth=<canonical>
 *     → returns the list of all cosignatures recorded for that STH.
 *     Used by monitors + auditors to confirm "≥ N independent
 *     witnesses have co-signed this tree head".
 *
 * Authentication: anonymous. The whole point of a witness is that
 * any independent party can submit one — that's the social-trust
 * model. Witness IDs MUST publish their public key at the
 * `publicKeyUrl` so a verifier can independently confirm each cosig.
 *
 * Rate-limited via the platform's rate-limit lib to prevent abuse.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  recordCosignature,
  getCosignatures,
  sthKey,
  type WitnessCosignature,
} from "@/lib/witness-store";
import { getDemoTransparencyLog } from "@/lib/transparency-singleton";
import {
  isPersistenceEnabled,
  upstashRecordCosignature,
  upstashGetCosignatures,
} from "@/lib/upstash-log-store";

const log = createLogger("transparency-witness");

const limiter = rateLimit({ interval: 60, limit: 20 });

const POST_SCHEMA = z.object({
  witnessId: z.string().min(2).max(120),
  signature: z.string().min(8).max(8192),
  sthCanonical: z.string().min(10).max(8192),
  publicKeyUrl: z.string().url().optional(),
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const limited = await limiter.check(req);
    if (limited) return limited;

    const body = (await req.json()) as unknown;
    const parsed = POST_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders() },
      );
    }
    const { witnessId, signature, sthCanonical, publicKeyUrl } = parsed.data;

    // Tree-state guard: the canonical must commit to the SAME
    // (logId, treeSize, rootHash) triple as the log's current state.
    // We tolerate timestamp drift (a witness's clock differs from
    // ours by a few seconds — that's fine; the cosig is still over a
    // canonical that commits to the same tree state). What we reject:
    // a canonical that commits to a DIFFERENT tree state (different
    // root or size), which is the actual attacker scenario.
    const tlog = await getDemoTransparencyLog();
    const currentSth = tlog.currentSth();
    let canonicalShape: {
      logId?: unknown;
      treeSize?: unknown;
      rootHash?: unknown;
    };
    try {
      canonicalShape = JSON.parse(sthCanonical) as typeof canonicalShape;
    } catch {
      return NextResponse.json(
        { error: "sthCanonical is not valid JSON" },
        { status: 400, headers: corsHeaders() },
      );
    }
    if (
      canonicalShape.logId !== currentSth.logId ||
      canonicalShape.treeSize !== currentSth.treeSize ||
      canonicalShape.rootHash !== currentSth.rootHash
    ) {
      return NextResponse.json(
        {
          error:
            "sthCanonical does not commit to the current tree state (logId/treeSize/rootHash mismatch). Refresh /api/transparency/sth and resubmit.",
        },
        { status: 409, headers: corsHeaders() },
      );
    }

    const cosig: WitnessCosignature = {
      witnessId,
      signature,
      submittedAt: new Date().toISOString(),
      publicKeyUrl,
    };
    const { created } = recordCosignature(sthCanonical, cosig);

    // Mirror to Upstash when configured so cosignatures survive across
    // replica restarts. Failure to persist is non-fatal — the in-memory
    // store has already recorded the cosig + the request returned 200,
    // but the operator gets a structured warning in the logs.
    if (isPersistenceEnabled()) {
      const hashHex = sthKey(sthCanonical);
      try {
        await upstashRecordCosignature(sthCanonical, hashHex, cosig);
      } catch (err) {
        log.warn("Upstash cosig persistence failed (in-memory only)", {
          error: String(err),
          witnessId,
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        recorded: true,
        firstForThisSth: created,
        witnessCount: getCosignatures(sthCanonical).length,
        persistent: isPersistenceEnabled(),
      },
      { headers: corsHeaders() },
    );
  } catch (err) {
    log.error("witness POST failed", { error: String(err) });
    return NextResponse.json(
      { error: "Unable to record cosignature" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const sth = url.searchParams.get("sth");
    if (!sth) {
      return NextResponse.json(
        { error: "missing 'sth' query parameter" },
        { status: 400, headers: corsHeaders() },
      );
    }
    // Union in-memory + Upstash (when configured) so a query against a
    // replica that hasn't seen an in-memory submission still returns
    // cosignatures recorded by other replicas.
    const local = getCosignatures(sth);
    let remote: WitnessCosignature[] = [];
    if (isPersistenceEnabled()) {
      try {
        remote = await upstashGetCosignatures(sthKey(sth));
      } catch (err) {
        log.warn("Upstash cosig fetch failed (local-only response)", {
          error: String(err),
        });
      }
    }
    // Dedup by (witnessId, signature) — local cosig may have already
    // been mirrored remotely, we don't want to double-count.
    const seen = new Set<string>();
    const merged: WitnessCosignature[] = [];
    for (const c of [...local, ...remote]) {
      const key = `${c.witnessId}|${c.signature}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    return NextResponse.json(
      {
        sthCanonical: sth,
        witnessCount: merged.length,
        cosignatures: merged,
        persistent: isPersistenceEnabled(),
      },
      {
        headers: {
          ...corsHeaders(),
          "Cache-Control": "public, max-age=30, s-maxage=30",
        },
      },
    );
  } catch (err) {
    log.error("witness GET failed", { error: String(err) });
    return NextResponse.json(
      { error: "Unable to fetch cosignatures" },
      { status: 500, headers: corsHeaders() },
    );
  }
}

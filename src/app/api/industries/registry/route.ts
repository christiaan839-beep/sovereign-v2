/**
 * SOVEREIGN MATRIX — /api/industries/registry (Wave 29).
 *
 * Public, signed catalog of every industry × workflow gap Sovereign
 * addresses. Backs the marketing claim that the platform covers ~40
 * industries × ~380 verifiable-AI workflows.
 *
 * Returns:
 *   {
 *     summary: { industryCount, workflowCount, shippedCount, ... },
 *     industries: Industry[],
 *     attestation: { canonical, contentHash, signature }
 *   }
 *
 * Verifier protocol:
 *   1. Drop the `attestation` block.
 *   2. Recompute canonicalize() over { summary, industries }.
 *   3. SHA-256 the recomputed canonical → compare to contentHash.
 *   4. Validate the signature against the platform's published key.
 *
 * No auth. 5-minute cache — the registry is append-only on disk so
 * the JSON only changes on deploy.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  listIndustries,
  registrySummary,
  signRegistry,
} from "@/lib/industries-registry";

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const summary = registrySummary();
  const industries = listIndustries();
  const attestation = signRegistry();

  return NextResponse.json(
    {
      summary,
      industries,
      attestation,
    },
    {
      status: 200,
      headers: {
        "cache-control": "public, max-age=300, s-maxage=600",
      },
    },
  );
}

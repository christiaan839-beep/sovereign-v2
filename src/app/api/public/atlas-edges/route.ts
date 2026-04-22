/**
 * GET /api/public/atlas-edges
 *
 * Returns A2E edges for the landing v2 Atlas graph. Edges represent
 * "agent A commonly calls agent B" relationships derived from the
 * A2E call history. For the initial ship we hardcode a curated edge
 * list; subsequent iteration derives from live agent-spawn.ts call
 * tracking.
 *
 * Shape: { edges: Array<{ source: string, target: string, weight: number }> }
 *
 * Long cache (1h s-maxage) — edges change slowly.
 */

import { NextResponse } from "next/server";

const CURATED_EDGES: ReadonlyArray<{ source: string; target: string; weight: number }> = [
  // Lead-gen chain (Apex playbook)
  { source: "icp-profiler", target: "prospect-hunter", weight: 0.9 },
  { source: "prospect-hunter", target: "contact-enricher", weight: 0.85 },
  { source: "contact-enricher", target: "angle-generator", weight: 0.8 },
  // Competitor-takedown chain (Velox playbook)
  { source: "competitor-mapper", target: "weakness-scanner", weight: 0.85 },
  { source: "weakness-scanner", target: "counter-positioning", weight: 0.82 },
  // Content-engine chain (Scribe playbook)
  { source: "research-synthesizer", target: "draft-writer", weight: 0.88 },
  { source: "draft-writer", target: "edit-sharpener", weight: 0.78 },
  // Cross-chain edges — verification runs on everyone
  { source: "draft-writer", target: "argus-verifier", weight: 0.6 },
  { source: "angle-generator", target: "argus-verifier", weight: 0.6 },
  { source: "counter-positioning", target: "argus-verifier", weight: 0.6 },
  // (Extend with live data once agent-spawn tracking is aggregated.)
];

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { edges: CURATED_EDGES, count: CURATED_EDGES.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}

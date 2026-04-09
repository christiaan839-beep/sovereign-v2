import { NextResponse } from "next/server";
import { discoverAllModels } from "@/lib/model-discovery";

/**
 * GET /api/models/discover — Discover available models across all providers.
 * Returns total count, new models, and per-provider breakdown.
 * Cached for 1 hour to avoid excessive API calls.
 */
export async function GET() {
  try {
    const result = await discoverAllModels();
    return NextResponse.json({
      success: true,
      ...result,
      discoveredAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Discovery failed", details: String(error) },
      { status: 500 }
    );
  }
}

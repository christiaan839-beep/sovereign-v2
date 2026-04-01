/**
 * GET /api/_integrations/registry
 *
 * Returns the full integration connector registry.
 * Auth-gated via Clerk.
 *
 * Query params:
 *   ?category=CRM          — filter by category
 *   ?status=available       — filter by status
 */

import { NextRequest, NextResponse } from "next/server";
import { guardRoute, errorResponse } from "@/lib/api-guard";
import {
  INTEGRATION_REGISTRY,
  type IntegrationCategory,
  type IntegrationStatus,
} from "@/lib/integrations";

export async function GET(req: NextRequest) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const { searchParams } = req.nextUrl;
    const categoryFilter = searchParams.get("category") as IntegrationCategory | null;
    const statusFilter = searchParams.get("status") as IntegrationStatus | null;

    let results = INTEGRATION_REGISTRY;

    if (categoryFilter) {
      results = results.filter((c) => c.category === categoryFilter);
    }
    if (statusFilter) {
      results = results.filter((c) => c.status === statusFilter);
    }

    return NextResponse.json({
      integrations: results,
      total: results.length,
      filters: {
        category: categoryFilter,
        status: statusFilter,
      },
    });
  } catch {
    return errorResponse("Failed to load integration registry", 500, "REGISTRY_ERROR");
  }
}

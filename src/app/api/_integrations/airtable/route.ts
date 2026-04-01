/**
 * POST /api/_integrations/airtable — Create a record
 * GET  /api/_integrations/airtable — List records
 *
 * Uses the Airtable REST API with Bearer token auth.
 * Requires AIRTABLE_API_KEY env var (personal access token).
 *
 * POST body: { baseId: string, table: string, fields: Record<string, unknown> }
 * GET  query: ?baseId=xxx&table=yyy&maxRecords=100&view=Grid+view
 */

import { NextRequest, NextResponse } from "next/server";
import { guardRoute, errorResponse, sanitizeString, sanitizeNumber, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:airtable");

const AIRTABLE_BASE = "https://api.airtable.com/v0";

function getApiKey(): string | null {
  return process.env.AIRTABLE_API_KEY ?? null;
}

// ── POST — Create a record ──────────────────────────────────────

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const apiKey = getApiKey();
    if (!apiKey) {
      log.warn("Airtable API key not configured");
      return errorResponse(
        "Airtable not configured. Add AIRTABLE_API_KEY to env vars.",
        503,
        "AIRTABLE_NOT_CONFIGURED"
      );
    }

    const body = await req.json();
    const missing = validateRequired(body, ["baseId", "table", "fields"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const baseId = sanitizeString(body.baseId, 200);
    const table = sanitizeString(body.table, 200);
    const fields: Record<string, unknown> = body.fields;

    if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
      return errorResponse("fields must be a plain object", 400, "VALIDATION_ERROR");
    }

    log.info("Creating Airtable record", { baseId, table, userId: auth.userId });

    const url = `${AIRTABLE_BASE}/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.error("Airtable create error", { status: res.status, error: errBody });
      return errorResponse(`Airtable API error: ${res.status}`, 502, "AIRTABLE_API_ERROR");
    }

    const record = await res.json();
    log.info("Airtable record created", { recordId: record.id });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    log.error("Airtable POST error", { error: String(err) });
    return errorResponse("Failed to create Airtable record", 500, "AIRTABLE_ERROR");
  }
}

// ── GET — List records ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const apiKey = getApiKey();
    if (!apiKey) {
      log.warn("Airtable API key not configured");
      return errorResponse(
        "Airtable not configured. Add AIRTABLE_API_KEY to env vars.",
        503,
        "AIRTABLE_NOT_CONFIGURED"
      );
    }

    const { searchParams } = req.nextUrl;
    const baseId = sanitizeString(searchParams.get("baseId"), 200);
    const table = sanitizeString(searchParams.get("table"), 200);

    if (!baseId || !table) {
      return errorResponse("Missing required query params: baseId, table", 400, "VALIDATION_ERROR");
    }

    const maxRecords = sanitizeNumber(searchParams.get("maxRecords"), 1, 100, 100);
    const view = searchParams.get("view");

    log.info("Listing Airtable records", { baseId, table, maxRecords, userId: auth.userId });

    const url = new URL(`${AIRTABLE_BASE}/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`);
    url.searchParams.set("maxRecords", String(maxRecords));
    if (view) url.searchParams.set("view", view);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.error("Airtable list error", { status: res.status, error: errBody });
      return errorResponse(`Airtable API error: ${res.status}`, 502, "AIRTABLE_API_ERROR");
    }

    const data = await res.json();
    log.info("Airtable records fetched", { count: data.records?.length ?? 0 });

    return NextResponse.json({
      success: true,
      records: data.records,
      offset: data.offset,
    });
  } catch (err) {
    log.error("Airtable GET error", { error: String(err) });
    return errorResponse("Failed to list Airtable records", 500, "AIRTABLE_ERROR");
  }
}

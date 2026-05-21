/**
 * POST /api/_integrations/notion — Create a page
 * GET  /api/_integrations/notion — Search pages
 *
 * Uses the Notion API v1 with an internal integration token.
 * Requires NOTION_API_KEY env var (internal integration token starting with ntn_ or secret_).
 *
 * POST body: { parentId: string, title: string, content?: string }
 * GET  query: ?query=search+text&pageSize=10
 */

import { NextRequest, NextResponse } from "next/server";
import { guardRoute, errorResponse, sanitizeString, sanitizeNumber, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:notion");

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getApiKey(): string | null {
  return process.env.NOTION_API_KEY ?? null;
}

function notionHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// ── POST — Create a page ────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const apiKey = getApiKey();
    if (!apiKey) {
      log.warn("Notion API key not configured");
      return errorResponse(
        "Notion not configured. Add NOTION_API_KEY to env vars.",
        503,
        "NOTION_NOT_CONFIGURED"
      );
    }

    const body = await req.json();
    const missing = validateRequired(body, ["parentId", "title"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const parentId = sanitizeString(body.parentId, 200);
    const title = sanitizeString(body.title, 500);
    const content = sanitizeString(body.content ?? "", 10000);

    log.info("Creating Notion page", { parentId, title, userId: auth.userId });

    // Build the page payload — parent can be a page or database
    const isDatabase = parentId.length === 32 || parentId.includes("-");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagePayload: Record<string, any> = {
      parent: isDatabase
        ? { database_id: parentId }
        : { page_id: parentId },
      properties: {
        title: {
          title: [
            {
              text: { content: title },
            },
          ],
        },
      },
    };

    // Add content as paragraph blocks if provided
    if (content) {
      // Split long content into chunks of 2000 chars (Notion block limit)
      const chunks = splitIntoChunks(content, 2000);
      pagePayload.children = chunks.map((chunk) => ({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: chunk } }],
        },
      }));
    }

    const res = await outboundFetchAsResponse(`${NOTION_BASE}/pages`, {
      method: "POST",
      headers: notionHeaders(apiKey),
      body: JSON.stringify(pagePayload),
    }, { ruleId: "integrations.notion.route.1", allowedHosts: [new URL(NOTION_BASE).hostname] });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.error("Notion create error", { status: res.status, error: errBody });
      return errorResponse(`Notion API error: ${res.status}`, 502, "NOTION_API_ERROR");
    }

    const page = await res.json();
    log.info("Notion page created", { pageId: page.id });

    return NextResponse.json({
      success: true,
      pageId: page.id,
      url: page.url,
    });
  } catch (err) {
    log.error("Notion POST error", { error: String(err) });
    return errorResponse("Failed to create Notion page", 500, "NOTION_ERROR");
  }
}

// ── GET — Search pages ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const apiKey = getApiKey();
    if (!apiKey) {
      log.warn("Notion API key not configured");
      return errorResponse(
        "Notion not configured. Add NOTION_API_KEY to env vars.",
        503,
        "NOTION_NOT_CONFIGURED"
      );
    }

    const { searchParams } = req.nextUrl;
    const query = sanitizeString(searchParams.get("query") ?? "", 500);
    const pageSize = sanitizeNumber(searchParams.get("pageSize"), 1, 100, 10);

    log.info("Searching Notion", { query, pageSize, userId: auth.userId });

    const res = await outboundFetchAsResponse(`${NOTION_BASE}/search`, {
      method: "POST", // Notion search is POST
      headers: notionHeaders(apiKey),
      body: JSON.stringify({
        query,
        page_size: pageSize,
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
      }),
    }, { ruleId: "integrations.notion.route.2", allowedHosts: [new URL(NOTION_BASE).hostname] });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log.error("Notion search error", { status: res.status, error: errBody });
      return errorResponse(`Notion API error: ${res.status}`, 502, "NOTION_API_ERROR");
    }

    const data = await res.json();
    log.info("Notion search complete", { resultCount: data.results?.length ?? 0 });

    return NextResponse.json({
      success: true,
      results: data.results?.map((r: Record<string, unknown>) => ({
        id: r.id,
        object: r.object,
        url: r.url,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        title: extractTitle(r as any),
        lastEdited: r.last_edited_time,
      })),
      hasMore: data.has_more,
      nextCursor: data.next_cursor,
    });
  } catch (err) {
    log.error("Notion GET error", { error: String(err) });
    return errorResponse("Failed to search Notion", 500, "NOTION_ERROR");
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.slice(i, i + maxLen));
  }
  return chunks.length > 0 ? chunks : [""];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

function extractTitle(page: any): string {
  try {
    const props = page.properties ?? {};
    for (const key of Object.keys(props)) {
      const prop = props[key];
      if (prop?.type === "title" && prop.title?.[0]?.plain_text) {
        return prop.title[0].plain_text;
      }
    }
    // Fallback for child pages
    if (page.child_page?.title) return page.child_page.title;
    if (page.child_database?.title) return page.child_database.title;
  } catch {
    // ignore
  }
  return "Untitled";
}

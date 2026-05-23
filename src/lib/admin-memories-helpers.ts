/**
 * SOVEREIGN MATRIX — Admin memory browser helpers (Wave 143).
 *
 * Pure utilities for /api/admin/memories. Extracted so query-param
 * coercion + result shaping is pinned by tests without the Clerk +
 * pgvector pipeline.
 */

export const MEMORY_VALID_SORTS = [
  "createdAt-desc",
  "createdAt-asc",
  "agent",
] as const;
export type MemorySort = (typeof MEMORY_VALID_SORTS)[number];

export interface MemoryFilters {
  userId: string | null;
  agentName: string | null;
  search: string | null;
  limit: number;
  sort: MemorySort;
}

/**
 * Parse + bounds-check the query params for the admin memories
 * endpoint. Returns a normalized filter shape regardless of input.
 */
export function parseMemoryFilters(params: URLSearchParams): MemoryFilters {
  const userId = params.get("userId")?.trim() || null;
  const agentName = params.get("agent")?.trim() || null;
  const rawSearch = params.get("q")?.trim();
  const search = rawSearch && rawSearch.length > 0 ? rawSearch : null;
  const limit = clampLimit(params.get("limit"));
  const sort = normalizeSort(params.get("sort"));
  return { userId, agentName, search, limit, sort };
}

export function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 200);
}

export function normalizeSort(raw: string | null): MemorySort {
  if (!raw) return "createdAt-desc";
  const trimmed = raw.trim();
  if ((MEMORY_VALID_SORTS as readonly string[]).includes(trimmed)) {
    return trimmed as MemorySort;
  }
  return "createdAt-desc";
}

/**
 * Truncate + collapse a memory content string for the admin table.
 * Single-line, max 220 chars, suffix ellipsis when truncated.
 */
export function truncateContent(s: string, max: number = 220): string {
  if (!s) return "—";
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, max) + "…";
}

/**
 * Strip / re-shape metadata for the admin response. Drops embedding
 * blobs (huge), keeps only kind, url, target, category, etc.
 */
export function projectMetadata(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  const keep = [
    "kind",
    "category",
    "url",
    "target",
    "mode",
    "leadId",
    "domain",
    "consolidatedFrom",
    "oldestAt",
    "newestAt",
  ];
  for (const k of keep) {
    if (k in obj) out[k] = obj[k];
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * Build a SQL ORDER BY fragment for the chosen sort. Returns the
 * literal string — the route caller must inject it via sql.raw().
 * The fragment is whitelisted so callers cannot smuggle SQL via
 * sort.
 */
export function sortFragment(sort: MemorySort): string {
  switch (sort) {
    case "createdAt-asc":
      return "created_at ASC";
    case "agent":
      return "agent_name ASC, created_at DESC";
    case "createdAt-desc":
    default:
      return "created_at DESC";
  }
}

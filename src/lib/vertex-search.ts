/**
 * SOVEREIGN MATRIX — Vertex AI Search adapter (Wave 137).
 *
 * When GCP_VERTEX_SEARCH_PROJECT + GCP_VERTEX_SEARCH_ENGINE_ID are set,
 * provides a higher-quality grounded-search alternative to direct
 * Tavily / Gemini REST. Pairs with the `oss-inference` pattern from
 * Wave 133 — same env-var-flip + outboundFetch allowlist contract.
 *
 * Why this exists:
 *   - Gemini's `tools: [{ google_search: {} }]` grounding works but is
 *     opaque (no citation metadata)
 *   - Tavily gives citations but isn't backed by Google's index
 *   - Vertex AI Search (formerly Discovery Engine) returns ranked
 *     snippets WITH structured citations from Google's index — the
 *     best of both worlds
 *
 * Activation:
 *   - GCP_VERTEX_SEARCH_PROJECT       (e.g. "sovereign-matrix-1234")
 *   - GCP_VERTEX_SEARCH_ENGINE_ID     (the Discovery Engine app id)
 *   - GCP_VERTEX_SEARCH_LOCATION      (default "global")
 *   - GCP_VERTEX_SEARCH_ACCESS_TOKEN  (short-lived OAuth, refresh
 *                                      with gcloud / Workload Identity)
 *
 * Pure-function design:
 *   `parseVertexResponse` is exposed for tests so the snippet+citation
 *   parsing is pinned without making real HTTP calls.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";
import { createLogger } from "@/lib/logger";

const log = createLogger("vertex-search");

const HOST = "discoveryengine.googleapis.com";

export interface VertexSearchOptions {
  /** Cap on returned snippets. Default 5, max 20. */
  pageSize?: number;
  /** Strict / moderate / off — Vertex's safetySettings. Default "moderate". */
  safety?: "strict" | "moderate" | "off";
  /** Wall-clock timeout ms. Default 15s. */
  timeoutMs?: number;
  /** Optional ruleId for the outboundFetch audit. */
  ruleId?: string;
}

export interface VertexSnippet {
  /** Snippet text (the answer-relevant excerpt). */
  text: string;
  /** Source URL the snippet came from. */
  uri: string;
  /** Page title, when Vertex returns one. */
  title?: string;
  /** Vertex's relevance score (0-1). */
  score?: number;
}

export interface VertexSearchResult {
  query: string;
  snippets: VertexSnippet[];
  totalResults: number;
  /** Vertex's synthesised answer when generative_answer is enabled. */
  summary?: string;
}

export function isVertexSearchConfigured(): boolean {
  return !!(
    process.env.GCP_VERTEX_SEARCH_PROJECT?.trim() &&
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID?.trim() &&
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN?.trim()
  );
}

/**
 * Parse the Vertex AI Search API response into our flat snippet shape.
 * Pure — operates on the parsed JSON object directly so it's testable
 * without HTTP.
 */
export function parseVertexResponse(
  query: string,
  data: unknown,
): VertexSearchResult {
  const obj = (data ?? {}) as {
    results?: Array<{
      document?: {
        derivedStructData?: {
          snippets?: Array<{ snippet?: string; snippet_status?: string }>;
          link?: string;
          title?: string;
        };
      };
      modelScore?: number;
    }>;
    summary?: { summaryText?: string };
    totalSize?: number;
  };

  const snippets: VertexSnippet[] = [];
  for (const r of obj.results ?? []) {
    const link = r.document?.derivedStructData?.link;
    const title = r.document?.derivedStructData?.title;
    const sn = r.document?.derivedStructData?.snippets ?? [];
    for (const s of sn) {
      const text = (s.snippet ?? "").replace(/\s+/g, " ").trim();
      if (!text || !link) continue;
      snippets.push({
        text,
        uri: link,
        title: title || undefined,
        score: typeof r.modelScore === "number" ? r.modelScore : undefined,
      });
    }
  }

  return {
    query,
    snippets,
    totalResults:
      typeof obj.totalSize === "number" ? obj.totalSize : snippets.length,
    summary: obj.summary?.summaryText?.trim() || undefined,
  };
}

/**
 * Live Vertex AI Search call. Returns null when not configured (so
 * callers can fall through to Tavily / Gemini grounding).
 */
export async function vertexSearch(
  query: string,
  opts: VertexSearchOptions = {},
): Promise<VertexSearchResult | null> {
  if (!isVertexSearchConfigured()) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  const project = process.env.GCP_VERTEX_SEARCH_PROJECT!.trim();
  const engineId = process.env.GCP_VERTEX_SEARCH_ENGINE_ID!.trim();
  const location = process.env.GCP_VERTEX_SEARCH_LOCATION?.trim() || "global";
  const token = process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN!.trim();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 5, 1), 20);

  // Discovery Engine v1 search endpoint
  const url =
    `https://${HOST}/v1/projects/${encodeURIComponent(project)}` +
    `/locations/${encodeURIComponent(location)}` +
    `/collections/default_collection/engines/${encodeURIComponent(engineId)}` +
    `/servingConfigs/default_search:search`;

  try {
    const res = await outboundFetchAsResponse(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: trimmed,
          pageSize,
          // Generative summarisation on top of the snippets
          contentSearchSpec: {
            snippetSpec: { returnSnippet: true },
            summarySpec: {
              summaryResultCount: Math.min(pageSize, 5),
              includeCitations: true,
              ignoreAdversarialQuery: opts.safety !== "off",
            },
          },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      },
      {
        ruleId: opts.ruleId ?? "vertex-search.query",
        allowedHosts: [HOST],
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.warn("vertex search non-2xx", {
        status: String(res.status),
        body: text.slice(0, 200),
      });
      return null;
    }
    const data = await res.json();
    return parseVertexResponse(trimmed, data);
  } catch (err) {
    log.warn("vertex search threw", { error: String(err) });
    return null;
  }
}

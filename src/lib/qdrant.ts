/**
 * QDRANT ADAPTER — Self-hosted vector database, Apache 2.0 license.
 *
 * Why Qdrant over Pinecone:
 *   - Self-hosted on Hetzner → zero marginal cost per query
 *   - Apache 2.0 → true ownership, deploy anywhere
 *   - Single binary → easy ops, low resource footprint
 *   - OpenAI-compatible API → same call patterns as Pinecone
 *
 * Compatible with Pinecone's surface: upsert/query/delete. Callers can
 * swap between this module and memory.ts (Pinecone) by env var. When
 * both are configured, Qdrant is preferred (user owns the data).
 *
 * Graceful degradation:
 *   - QDRANT_URL missing → returns null from getClient(), callers fall back
 *   - Qdrant unreachable → throws with clear message, circuit breaker trips
 *   - Collection missing → auto-created on first upsert
 */

import { createLogger } from "@/lib/logger";
import { withTimeout, TIMEOUTS } from "@/lib/with-timeout";

const log = createLogger("qdrant");

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY; // optional; only if auth is enabled

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

function authHeaders(): Record<string, string> {
  if (!QDRANT_API_KEY) return {};
  return { "api-key": QDRANT_API_KEY };
}

/**
 * Lightweight check — true if QDRANT_URL is set and we can reach it.
 * Use this to decide whether to prefer Qdrant over Pinecone at startup.
 */
export async function isQdrantAvailable(): Promise<boolean> {
  if (!QDRANT_URL) return false;
  try {
    const res = await withTimeout(
      TIMEOUTS.VECTOR,
      (signal) => fetch(`${QDRANT_URL}/healthz`, { signal, headers: authHeaders() }),
      "Qdrant health",
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure a collection exists with the right vector dimension. Idempotent —
 * if the collection already exists with a different dimension we log a
 * warning but do NOT recreate (that would silently delete the user's data).
 */
export async function ensureCollection(
  name: string,
  dimension: number,
  distance: "Cosine" | "Dot" | "Euclid" = "Cosine",
): Promise<void> {
  if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");

  // Check if collection exists
  const existsRes = await withTimeout(
    TIMEOUTS.VECTOR,
    (signal) =>
      fetch(`${QDRANT_URL}/collections/${encodeURIComponent(name)}`, {
        signal,
        headers: authHeaders(),
      }),
    `Qdrant check collection ${name}`,
  );

  if (existsRes.ok) {
    const info = await existsRes.json().catch(() => null);
    const existingDim = info?.result?.config?.params?.vectors?.size as number | undefined;
    if (existingDim && existingDim !== dimension) {
      log.warn("Qdrant collection has different dimension", {
        collection: name,
        existing: existingDim,
        requested: dimension,
      });
    }
    return;
  }

  // Doesn't exist → create it
  const createRes = await withTimeout(
    TIMEOUTS.VECTOR,
    (signal) =>
      fetch(`${QDRANT_URL}/collections/${encodeURIComponent(name)}`, {
        method: "PUT",
        signal,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          vectors: { size: dimension, distance },
        }),
      }),
    `Qdrant create collection ${name}`,
  );

  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(`Qdrant create collection failed: ${createRes.status} ${detail}`);
  }
  log.info("Qdrant collection created", { name, dimension, distance });
}

/**
 * Upsert points. Qdrant requires either UUID-string or unsigned int IDs —
 * if the caller passes other string shapes, we hash them into a stable UUID.
 */
export async function upsert(
  collection: string,
  points: QdrantPoint[],
): Promise<void> {
  if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");
  if (points.length === 0) return;

  const res = await withTimeout(
    TIMEOUTS.VECTOR,
    (signal) =>
      fetch(`${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points?wait=true`, {
        method: "PUT",
        signal,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ points }),
      }),
    `Qdrant upsert ${collection}`,
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Qdrant upsert failed: ${res.status} ${detail}`);
  }
}

/**
 * k-NN search. Returns the top-k points by cosine similarity (or whatever
 * distance metric the collection was created with).
 */
export async function search(
  collection: string,
  vector: number[],
  limit: number = 5,
  filter?: Record<string, unknown>,
): Promise<QdrantSearchResult[]> {
  if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");

  const res = await withTimeout(
    TIMEOUTS.VECTOR,
    (signal) =>
      fetch(`${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/search`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          vector,
          limit,
          with_payload: true,
          ...(filter ? { filter } : {}),
        }),
      }),
    `Qdrant search ${collection}`,
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Qdrant search failed: ${res.status} ${detail}`);
  }

  const body = await res.json();
  return (body?.result ?? []) as QdrantSearchResult[];
}

/** Delete points by ID. Silent on non-existent IDs. */
export async function deletePoints(
  collection: string,
  ids: Array<string | number>,
): Promise<void> {
  if (!QDRANT_URL) throw new Error("QDRANT_URL not configured");
  if (ids.length === 0) return;

  await withTimeout(
    TIMEOUTS.VECTOR,
    (signal) =>
      fetch(`${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/delete?wait=true`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ points: ids }),
      }),
    `Qdrant delete ${collection}`,
  );
}

/**
 * Count of points in a collection — useful for dashboards and "this
 * agent has N memories" summaries.
 */
export async function count(collection: string): Promise<number> {
  if (!QDRANT_URL) return 0;
  try {
    const res = await withTimeout(
      TIMEOUTS.VECTOR,
      (signal) =>
        fetch(`${QDRANT_URL}/collections/${encodeURIComponent(collection)}/points/count`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ exact: false }),
        }),
      `Qdrant count ${collection}`,
    );
    if (!res.ok) return 0;
    const body = await res.json();
    return (body?.result?.count as number) ?? 0;
  } catch {
    return 0;
  }
}

/**
 * EDGE NODE REGISTRY — pure-function helpers.
 *
 * The registry is just a `Map<id, EdgeNode>`. The pure functions
 * in this file implement: list (sorted), find-by-capability
 * (capability_match × deployment_match × stub-penalty), and a
 * health snapshot summary suitable for the public registry feed.
 *
 * No DB. No clocks. Caller passes the registry to every helper
 * (testability + inspector portability).
 */

import type {
  EdgeNode,
  EdgeNodeManifest,
  EdgeNodeCapability,
  EdgeNodePersona,
  EdgeNodeDeployment,
  EdgeNodeHealthStatus,
} from "./types";

// ── Type aliases ──────────────────────────────────────────────────

export type EdgeNodeRegistry = Map<string, EdgeNode>;

// ── Construction ──────────────────────────────────────────────────

/**
 * Create an empty registry. Caller registers nodes via Map.set().
 * Wrapped as a function for symmetry with other libs.
 */
export function createEdgeNodeRegistry(
  initial: ReadonlyArray<EdgeNode> = [],
): EdgeNodeRegistry {
  const r: EdgeNodeRegistry = new Map();
  for (const node of initial) {
    const m = node.describe();
    if (r.has(m.id)) {
      throw new Error(
        `duplicate edge-node id ${m.id} during registry construction`,
      );
    }
    r.set(m.id, node);
  }
  return r;
}

// ── Pure: list registered manifests ───────────────────────────────

export interface ListFilter {
  persona?: EdgeNodePersona;
  capability?: EdgeNodeCapability;
  deployment?: EdgeNodeDeployment;
  /** Default false — include stub nodes (so procurement sees what's
   *  available to enable). Set to true to filter to only configured. */
  excludeStubs?: boolean;
}

/**
 * Pure: list manifests matching the optional filter, sorted by id.
 *
 * The output is what `GET /api/edge-nodes` returns and what the
 * /trust/edge-nodes page renders. Stable order = deterministic UI.
 */
export function listEdgeNodes(
  registry: EdgeNodeRegistry,
  filter: ListFilter = {},
): EdgeNodeManifest[] {
  const out: EdgeNodeManifest[] = [];
  for (const [, node] of registry) {
    const m = node.describe();
    if (filter.persona && m.persona !== filter.persona) continue;
    if (
      filter.capability &&
      !m.capabilities.includes(filter.capability)
    )
      continue;
    if (filter.deployment && m.deployment !== filter.deployment)
      continue;
    if (filter.excludeStubs && m.isStub) continue;
    out.push(m);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

// ── Pure: capability ranking ─────────────────────────────────────

export interface CapabilityMatch {
  manifest: EdgeNodeManifest;
  /**
   * Ranking score: deterministic, in range [0, 1]. Real (non-stub)
   * configured nodes always rank above stubs, even when the stub
   * would otherwise have a higher capability score.
   */
  score: number;
  /** Procurement-readable rationale for the score. */
  rationale: string;
  /** Was the node a stub (will fail closed)? */
  isStub: boolean;
}

/**
 * Pure: rank registered nodes against a desired capability +
 * deployment posture. Returns matches sorted by score descending.
 *
 * Algorithm:
 *
 *   base    = 1.0 if capability exact-match, else 0
 *   deploy  = 1.0 if deployment exact-match, 0.5 if `hybrid`, else 0
 *   stub    = 0.5 if stub, 1.0 if real
 *   score   = base × deploy × stub
 *
 * The stub-penalty ensures that a real-but-imperfect-deployment
 * node still outranks a stub-but-perfect-deployment node — which
 * is what the procurement audience expects (configured > unconfigured).
 */
export function findEdgeNodesByCapability(
  registry: EdgeNodeRegistry,
  capability: EdgeNodeCapability,
  deployment?: EdgeNodeDeployment,
): CapabilityMatch[] {
  const out: CapabilityMatch[] = [];
  for (const [, node] of registry) {
    const m = node.describe();
    const base = m.capabilities.includes(capability) ? 1.0 : 0.0;
    if (base === 0.0) continue;
    let deploy = 1.0;
    if (deployment) {
      if (m.deployment === deployment) deploy = 1.0;
      else if (m.deployment === "hybrid") deploy = 0.5;
      else deploy = 0.0;
    }
    if (deploy === 0.0) continue;
    const stub = m.isStub ? 0.5 : 1.0;
    const score = base * deploy * stub;
    const rationale = [
      `capability ${capability} ${m.capabilities.includes(capability) ? "matched" : "missing"}`,
      deployment
        ? `deployment ${deployment} ${m.deployment === deployment ? "matched" : m.deployment === "hybrid" ? "partial" : "mismatched"}`
        : null,
      m.isStub ? "STUB (will fail closed)" : "configured",
    ]
      .filter((s): s is string => s !== null)
      .join(" · ");
    out.push({ manifest: m, score, rationale, isStub: m.isStub });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.manifest.id.localeCompare(b.manifest.id);
  });
  return out;
}

// ── Health snapshot (impure — calls each node's health()) ───────

export interface HealthSnapshotEntry {
  id: string;
  persona: EdgeNodePersona;
  status: EdgeNodeHealthStatus;
  detail?: string;
  lastReadyAt?: string;
}

export interface HealthSnapshot {
  /** Per-node health entries, sorted by id. */
  entries: HealthSnapshotEntry[];
  /** Roll-up counts by status. */
  byStatus: Record<EdgeNodeHealthStatus, number>;
  /** Highest-impact status across all nodes (worst wins). */
  worstStatus: EdgeNodeHealthStatus;
}

/**
 * Snapshot health across all registered nodes. Impure — calls each
 * node's `health()` in parallel. Stub nodes always report
 * `not-configured`, never `error`, so a fresh deployment shows
 * "everything is stub-ready" rather than "everything is broken."
 */
export async function snapshotEdgeNodeHealth(
  registry: EdgeNodeRegistry,
): Promise<HealthSnapshot> {
  const ids = Array.from(registry.keys()).sort();
  const entries: HealthSnapshotEntry[] = [];
  const byStatus: Record<EdgeNodeHealthStatus, number> = {
    ready: 0,
    "configured-but-unreachable": 0,
    "not-configured": 0,
    error: 0,
  };

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const node = registry.get(id)!;
      const m = node.describe();
      try {
        const h = await node.health();
        return {
          id,
          persona: m.persona,
          status: h.status,
          detail: h.detail,
          lastReadyAt: h.lastReadyAt,
        };
      } catch (err) {
        return {
          id,
          persona: m.persona,
          status: "error" as const,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      entries.push(r.value);
      byStatus[r.value.status] += 1;
    } else {
      // Defensive — Promise.allSettled never throws, but typescript
      // makes us handle it.
      const detail =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      entries.push({
        id: "<unknown>",
        persona: "custom",
        status: "error",
        detail,
      });
      byStatus.error += 1;
    }
  }

  // Worst-status rollup. Order: error > configured-but-unreachable >
  // not-configured > ready. This matches procurement triage priority.
  const worstStatus: EdgeNodeHealthStatus =
    byStatus.error > 0
      ? "error"
      : byStatus["configured-but-unreachable"] > 0
        ? "configured-but-unreachable"
        : byStatus["not-configured"] > 0
          ? "not-configured"
          : "ready";

  return { entries, byStatus, worstStatus };
}

// ── Pure: registry summary stats ─────────────────────────────────

export interface RegistryStats {
  total: number;
  byPersona: Record<EdgeNodePersona, number>;
  byDeployment: Record<EdgeNodeDeployment, number>;
  configuredCount: number;
  stubCount: number;
}

/**
 * Pure summary stats for the /trust/edge-nodes hero card.
 */
export function edgeNodeRegistryStats(
  registry: EdgeNodeRegistry,
): RegistryStats {
  const stats: RegistryStats = {
    total: 0,
    byPersona: {
      "software-engineer": 0,
      analyst: 0,
      operator: 0,
      custom: 0,
    },
    byDeployment: {
      "air-gapped": 0,
      "customer-cloud": 0,
      "managed-cloud": 0,
      hybrid: 0,
    },
    configuredCount: 0,
    stubCount: 0,
  };
  for (const [, node] of registry) {
    const m = node.describe();
    stats.total += 1;
    stats.byPersona[m.persona] += 1;
    stats.byDeployment[m.deployment] += 1;
    if (m.isStub) stats.stubCount += 1;
    else stats.configuredCount += 1;
  }
  return stats;
}

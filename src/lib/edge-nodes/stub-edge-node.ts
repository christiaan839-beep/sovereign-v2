/**
 * STUB EDGE NODE — fail-closed default implementation.
 *
 * Same posture as R71 stub guardrails adapter: ships across every
 * deployment, refuses to do anything, exposes the API surface real
 * integrations plug into. Customers / operators wire up their
 * preferred upstream (Trae / CUA / Cognee / Kimi K2.6 / etc.) and
 * REPLACE this stub via the registry.
 *
 * Why fail-closed (not "best-effort fallback"):
 *
 *   A platform that quietly succeeds on a stub when the customer
 *   thought they had Trae Agent enabled is worse than failing.
 *   Procurement / SOC 2 audits depend on the principle that the
 *   platform never silently substitutes one integration for another.
 *
 * Pure-function constructor. No I/O. No side effects.
 */

import type {
  EdgeNode,
  EdgeNodeManifest,
  DispatchRequest,
  DispatchResult,
  EdgeNodeHealthStatus,
} from "./types";

export interface StubEdgeNodeConfig {
  /** Unique id — must be unique within the registry. */
  id: string;
  /** What the real implementation will be (informs procurement UI). */
  manifestOverlay: Omit<EdgeNodeManifest, "isStub">;
  /**
   * If set, dispatch returns this `details` string. Defaults to a
   * procurement-readable explanation citing the upstream projects.
   */
  detailsOverride?: string;
}

export class StubEdgeNode implements EdgeNode {
  constructor(private readonly cfg: StubEdgeNodeConfig) {}

  describe(): EdgeNodeManifest {
    return { ...this.cfg.manifestOverlay, isStub: true };
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const upstreams = this.cfg.manifestOverlay.upstreamProjects
      .map((u) => u.name)
      .join(" / ");
    const details =
      this.cfg.detailsOverride ??
      `Edge Node "${this.cfg.id}" is a stub. Wire up an upstream integration (${upstreams}) and replace via the registry.`;
    return {
      ok: false,
      edgeNodeId: this.cfg.id,
      capability: request.capability,
      reason: "edge_node_not_configured",
      details,
      receiptLine: `dispatch refused — edge node ${this.cfg.id} is a stub (${upstreams})`,
    };
  }

  async health(): Promise<{
    status: EdgeNodeHealthStatus;
    detail?: string;
  }> {
    return {
      status: "not-configured",
      detail: `stub — wire up ${this.cfg.manifestOverlay.upstreamProjects.map((u) => u.name).join(", ")}`,
    };
  }
}

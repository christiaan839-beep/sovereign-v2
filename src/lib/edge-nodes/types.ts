/**
 * EDGE NODE FRAMEWORK — R120.
 *
 * The fourth instance of Sovereign's adapter-framework pattern
 * (after R54 KMS Signer, R55 CMEK Provider, R71 Guardrails Adapter).
 *
 * Edge Nodes are the FORMAL BOUNDARY between Sovereign's internal
 * universe (223 R101-registered single-function agents + R107 mesh
 * + R110 perception + ...) and the external open-source agentic
 * ecosystem (Trae Agent swarms, CUA sandboxes, Cognee graphs,
 * Kimi K2.6 swarms, AgentFlow planners, etc.).
 *
 * THE KEY DISTINCTION:
 *
 *   Internal Agent (R101)     = a single Sovereign function
 *   Sovereign Playbook        = a chain of internal agents
 *   Edge Node (R120 — this)   = an EXTERNAL agentic system that
 *                               Sovereign delegates to under our
 *                               trust substrate
 *
 * Why this matters strategically: "we integrate with Trae Agent"
 * is not a feature — anyone can call Trae's API. The moat is
 * integrating Trae UNDER our composition layer:
 *
 *   - R100 Policy Engine gates every dispatch (deny / hitl / acat-require)
 *   - R102 Cost Governance applies tenant + team + agent budgets
 *   - R26 Audit Chain logs every dispatch, every result, every error
 *   - R37 ACT capability tokens authorize the agent to delegate
 *   - R91 ACAT ensures any commerce action carries the trust artifact
 *   - R101 Capability Registry decides which Edge Node fits the task
 *
 * That's the substrate. Specific integrations follow as separate
 * rounds (R121 Trae, R122 CUA, R123 Cognee, R124 AgentFlow, ...).
 *
 * STUB-FIRST. Every Edge Node ships with a `StubEdgeNode` that
 * fails closed when its backing integration is not configured.
 * Same pattern as R71 — customers / operators wire up real
 * integrations themselves; the platform never quietly approves
 * a dispatch that the customer hasn't explicitly enabled.
 *
 * PURE FUNCTIONS THROUGHOUT. The registry, dispatcher, and health
 * classifier are pure functions. The thin runtime that actually
 * issues HTTP calls / spawns processes / etc. composes them.
 * Ports verbatim to @sovereign/inspector for offline procurement
 * verification.
 */

// ── Persona taxonomy ───────────────────────────────────────────────

/**
 * The three procurement-recognized Edge Node personas. Adopters
 * see "what is this for?" not "how is it built." Implementations
 * map to specific OSS projects per the integration roadmap.
 */
export type EdgeNodePersona =
  | "software-engineer" // autonomous coding swarm — Trae / AgentFlow / Werkstatt
  | "analyst" // research + reasoning swarm — Kimi K2.6 / Cognee / Qualixar
  | "operator" // UI automation workforce — UI-TARS / CUA / Understudy
  | "custom"; // operator-defined persona

// ── Capability taxonomy ────────────────────────────────────────────

/**
 * What an Edge Node CAN do at the procurement-readable level.
 * Distinct from R101 capability kinds (those describe single-function
 * Sovereign agents). Edge Node capabilities describe whole agentic
 * systems and are pitched at a higher level.
 */
export type EdgeNodeCapability =
  // Software-engineer family
  | "fix-github-issue"
  | "open-pull-request"
  | "review-pull-request"
  | "run-test-suite"
  | "refactor-codebase"
  // Analyst family
  | "ingest-documents"
  | "build-knowledge-graph"
  | "answer-research-question"
  | "generate-executive-summary"
  | "compliance-report"
  // Operator family
  | "control-desktop-application"
  | "fill-web-form"
  | "navigate-legacy-ui"
  | "perform-data-migration"
  | "monitor-screen-feed"
  // Cross-cutting
  | "spawn-subordinate-swarm"
  | "produce-evidence-bundle";

// ── Deployment posture ─────────────────────────────────────────────

/**
 * Where the Edge Node runs. Procurement / CISO / FedRAMP audiences
 * filter on this — sovereign deployments require `air-gapped` or
 * `customer-cloud` only.
 */
export type EdgeNodeDeployment =
  | "air-gapped" // entirely on-prem, no external network
  | "customer-cloud" // customer's VPC / sovereign cloud
  | "managed-cloud" // Sovereign-hosted (cheapest, lowest sovereignty)
  | "hybrid"; // mix — caller must inspect the manifest

// ── Health classification ──────────────────────────────────────────

export type EdgeNodeHealthStatus =
  | "ready"
  | "configured-but-unreachable"
  | "not-configured"
  | "error";

// ── Self-describe manifest ─────────────────────────────────────────

/**
 * The procurement-readable manifest every Edge Node implementation
 * exposes via `describe()`. This is what shows up in
 * `GET /api/edge-nodes` and on the /trust/edge-nodes page.
 */
export interface EdgeNodeManifest {
  /** Stable id — lowercase-kebab. Unique within the registry. */
  id: string;
  /** Persona — software-engineer / analyst / operator / custom. */
  persona: EdgeNodePersona;
  /** Display name. */
  name: string;
  /** Procurement-readable description (1-3 sentences). */
  description: string;
  /** Capabilities the Edge Node claims to provide. */
  capabilities: EdgeNodeCapability[];
  /** Underlying open-source projects this Edge Node wraps (for transparency). */
  upstreamProjects: Array<{
    name: string;
    license: string;
    /** Optional homepage / repo URL for procurement audit. */
    url?: string;
  }>;
  /** Deployment posture. */
  deployment: EdgeNodeDeployment;
  /**
   * Cost band — broad classification. Specific cents resolved at
   * dispatch time by R102 cost governance.
   */
  costBand: "free" | "low" | "medium" | "high";
  /**
   * Whether dispatch results may include PII or otherwise
   * sensitive data (drives R102 + R26 retention rules).
   */
  outputClass: "public" | "tenant-private" | "confidential";
  /**
   * If the implementation is the fail-closed stub, this is true.
   * Procurement teams filter on this to find "what could be enabled."
   */
  isStub: boolean;
  /**
   * Optional regulatory citations — for procurement context.
   * E.g., "SOC 2 CC8.1" for change-management workflows.
   */
  regulatoryNotes?: string[];
}

// ── Dispatch request / result ──────────────────────────────────────

export interface DispatchRequest {
  /** R34 user invoking the dispatch. */
  userId: string;
  /** Optional team identifier (drives R102 team budget). */
  teamId?: string;
  /** Optional R37 ACT chain hash (proof of capability delegation). */
  actChainHash?: string;
  /** Optional R91 ACAT chain hash (proof of agentic-commerce auth). */
  acatChainHash?: string;
  /** The capability being asked of the Edge Node. */
  capability: EdgeNodeCapability;
  /** Free-form structured task input (Edge Node interprets). */
  task: Record<string, unknown>;
  /** Optional resource tags (drive R100 policy predicates). */
  resourceTags?: Record<string, string>;
  /** Caller-supplied — for testability. */
  now?: Date;
  /** Optional cap on dispatch duration (seconds). */
  budgetSeconds?: number;
}

/**
 * The structured outcome of a dispatch — same shape whether the
 * Edge Node is a stub or a real integration.
 */
export type DispatchResult =
  | {
      ok: true;
      edgeNodeId: string;
      capability: EdgeNodeCapability;
      output: Record<string, unknown>;
      durationMs: number;
      /** Optional cost in cents (0 for free-tier or stub). */
      costCents: number;
      /** Procurement-readable summary for R26 audit + R45 export. */
      receiptLine: string;
    }
  | {
      ok: false;
      edgeNodeId: string;
      capability: EdgeNodeCapability;
      reason:
        | "edge_node_not_configured"
        | "edge_node_not_found"
        | "capability_unsupported"
        | "policy_denied"
        | "budget_exhausted"
        | "act_required"
        | "acat_required"
        | "upstream_error"
        | "timeout"
        | "internal_error";
      details?: string;
      receiptLine: string;
    };

// ── The interface every implementation provides ──────────────────

/**
 * The contract third-party Edge Node implementations satisfy. Same
 * structural pattern as R71 GuardrailsAdapter — describe + execute,
 * with the platform handling everything around the call (policy,
 * cost, audit, ACT/ACAT verification).
 */
export interface EdgeNode {
  /** Self-describe — used for the registry feed + UI. */
  describe(): EdgeNodeManifest;
  /**
   * Execute a dispatch. Implementations MUST be deterministic with
   * respect to inputs (the platform's audit chain expects
   * reproducible result shapes).
   */
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  /**
   * Cheap, idempotent health check. Should NOT incur cost. Returns
   * a procurement-readable status — `ready` / `not-configured` /
   * `configured-but-unreachable` / `error`.
   */
  health(): Promise<{
    status: EdgeNodeHealthStatus;
    detail?: string;
    /** Optional ISO 8601 — last-known good response. */
    lastReadyAt?: string;
  }>;
}

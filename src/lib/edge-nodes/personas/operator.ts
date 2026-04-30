/**
 * OPERATOR EDGE NODE — pre-built stub.
 *
 * The procurement-readable persona for a UI-automation workforce.
 * Wraps the upstream open-source stack: UI-TARS-desktop (ByteDance,
 * vision-language GUI agent), CUA (MIT, OS-agnostic agent sandbox),
 * Understudy (intent-based local agent that drives any application).
 *
 * Stub-only today; specific integrations ship as R127-R129 (CUA
 * sandbox provisioning, UI-TARS adapter, Understudy bridge). See
 * docs/EDGE-NODE-FRAMEWORK.md.
 *
 * Why this persona is so valuable: the bulk of enterprise work
 * still happens in legacy software (SAP, Oracle EBS, Workday, IBM
 * mainframe greenscreens, custom in-house tools). Most have no API.
 * The Operator Edge Node turns "must train a new hire to operate
 * Concur" into "delegate the migration to the Operator persona."
 *
 * Critical safety property: every Operator dispatch is `Tier 3`
 * by R101 manifest standards (browser_control + payment_op).
 * R100 policy gates default-deny for prod-tagged resources unless
 * a HITL approval is in scope.
 */

import { StubEdgeNode } from "../stub-edge-node";

export const OPERATOR_EDGE_NODE_ID = "operator-default";

export function createOperatorStub(): StubEdgeNode {
  return new StubEdgeNode({
    id: OPERATOR_EDGE_NODE_ID,
    manifestOverlay: {
      id: OPERATOR_EDGE_NODE_ID,
      persona: "operator",
      name: "Operator Edge Node (default stub)",
      description:
        "UI-automation workforce — sees screens via vision-language models, controls applications, fills forms, navigates legacy enterprise UIs. Wraps UI-TARS-desktop + CUA + Understudy under the Sovereign trust substrate. Tier 3 by default; HITL-required for prod-tagged resources.",
      capabilities: [
        "control-desktop-application",
        "fill-web-form",
        "navigate-legacy-ui",
        "perform-data-migration",
        "monitor-screen-feed",
        "produce-evidence-bundle",
      ],
      upstreamProjects: [
        {
          name: "UI-TARS-desktop",
          license: "Apache 2.0",
          url: "https://github.com/bytedance/UI-TARS-desktop",
        },
        {
          name: "CUA",
          license: "MIT",
        },
        {
          name: "Understudy",
          license: "MIT",
        },
      ],
      deployment: "customer-cloud",
      costBand: "high",
      outputClass: "confidential",
      regulatoryNotes: [
        "SOC 2 CC8.1 — UI-driven changes route through HITL gates by default.",
        "HIPAA Security Rule 45 CFR 164.312 — applicable when Operator touches PHI-bearing apps; require R100 PHI-deny policy unless explicitly authorized.",
      ],
    },
    detailsOverride:
      "Operator Edge Node is stub-only by default. Wire up CUA sandbox + UI-TARS-desktop + Understudy and replace this stub via the registry. See docs/EDGE-NODE-FRAMEWORK.md (R127-R129).",
  });
}

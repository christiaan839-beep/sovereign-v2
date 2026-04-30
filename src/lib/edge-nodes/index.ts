/**
 * Edge Node Framework — public surface.
 *
 * Re-exports the framework primitives + the three persona stubs +
 * the Aider real adapter (R121, first non-stub Edge Node).
 * Composes with the rest of the trust substrate:
 *   R100 policy → R102 cost → R37 ACT → dispatch → R26 audit
 */

export * from "./types";
export * from "./registry";
export * from "./dispatcher";
export * from "./stub-edge-node";

// Persona stubs (default registry contents)
export {
  createSoftwareEngineerStub,
  SOFTWARE_ENGINEER_EDGE_NODE_ID,
} from "./personas/software-engineer";
export { createAnalystStub, ANALYST_EDGE_NODE_ID } from "./personas/analyst";
export {
  createOperatorStub,
  OPERATOR_EDGE_NODE_ID,
} from "./personas/operator";

// R121 — Aider Software Engineer (first real adapter, feature-flagged)
export {
  createAiderSoftwareEngineerNode,
  AiderSoftwareEngineerEdgeNode,
  AIDER_SOFTWARE_ENGINEER_EDGE_NODE_ID,
  AIDER_SUPPORTED_CAPABILITIES,
  isAiderEnabled,
  validateDispatchTask as validateAiderDispatchTask,
  buildAiderArgs,
  parseAiderOutput,
  validateAiderConfig,
  buildAiderManifest,
  type AiderDispatchTask,
  type AiderSubprocessRunner,
  type AiderSubprocessRunResult,
  type AiderEdgeNodeOptions,
} from "./personas/aider-software-engineer";
export { defaultAiderRunner } from "./personas/aider-runner";

import { createSoftwareEngineerStub } from "./personas/software-engineer";
import { createAnalystStub } from "./personas/analyst";
import { createOperatorStub } from "./personas/operator";
import { createAiderSoftwareEngineerNode } from "./personas/aider-software-engineer";
import { defaultAiderRunner } from "./personas/aider-runner";
import { createEdgeNodeRegistry, type EdgeNodeRegistry } from "./registry";

/**
 * Convenience: build a registry pre-populated with the persona stubs
 * PLUS the Aider real adapter (which itself becomes a stub unless
 * SOVEREIGN_AIDER_ENABLED=true). Everything fail-closed until
 * customers / operators wire up real integrations.
 */
export function createDefaultEdgeNodeRegistry(): EdgeNodeRegistry {
  return createEdgeNodeRegistry([
    createSoftwareEngineerStub(),
    createAnalystStub(),
    createOperatorStub(),
    createAiderSoftwareEngineerNode({ runner: defaultAiderRunner }),
  ]);
}

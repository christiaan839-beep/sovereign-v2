/**
 * Edge Node Framework — public surface.
 *
 * Re-exports the framework primitives + the three persona stubs.
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

import { createSoftwareEngineerStub } from "./personas/software-engineer";
import { createAnalystStub } from "./personas/analyst";
import { createOperatorStub } from "./personas/operator";
import { createEdgeNodeRegistry, type EdgeNodeRegistry } from "./registry";

/**
 * Convenience: build a registry pre-populated with the three default
 * persona stubs. This is what the platform boots with — everything
 * fail-closed until customers / operators replace stubs with real
 * integrations.
 */
export function createDefaultEdgeNodeRegistry(): EdgeNodeRegistry {
  return createEdgeNodeRegistry([
    createSoftwareEngineerStub(),
    createAnalystStub(),
    createOperatorStub(),
  ]);
}

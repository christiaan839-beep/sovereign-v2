/**
 * Performance Observatory — public surface.
 *
 * Re-exports all the pure-function primitives. The runtime adapter
 * that actually signs attestations + writes to the R26 audit chain
 * lives separately and composes these pieces.
 */

export * from "./targets";
export * from "./benchmark-results";
export * from "./gap-analysis";
export * from "./attestation";

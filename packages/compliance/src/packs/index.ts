/**
 * The catalogues, exported individually.
 *
 * Most callers want the registry in `../index.js` instead. This entry
 * point exists for a framework-specific exporter that needs one
 * catalogue but renders its own document — ISO/IEC 42001, whose Annex A
 * controls are a matrix but whose clauses 4-10 are not.
 *
 * @packageDocumentation
 */

export { SOC2_PACK } from "./soc2.js";
export { ISO_42001_PACK } from "./iso-42001.js";
export { NIST_AI_RMF_PACK } from "./nist-ai-rmf.js";
export { HIPAA_SECURITY_PACK } from "./hipaa-security.js";
export { EU_CRA_PACK } from "./eu-cra.js";

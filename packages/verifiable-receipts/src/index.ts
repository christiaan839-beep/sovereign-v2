/**
 * @sovereign-matrix/verifiable-receipts
 *
 * Pure-TypeScript primitives for cryptographically-signed AI agent
 * receipts. Zero platform coupling — drop into any AI agent runtime.
 *
 * Three composable pieces:
 *   1. Post-quantum dual-signing (Ed25519 + ML-DSA-65 / Dilithium3)
 *   2. ZIP-bundle export with signed MANIFEST
 *   3. Guardian rule runner + 5 pre-built regulated-vertical packs
 *      (HIPAA, SR 11-7, NAIC, DSCSA, CSRD)
 *
 * Quick start:
 *   ```ts
 *   import {
 *     runGuardian, hipaaPack,
 *     buildSignedBundle, verifyManifest,
 *     signMlDsa65, verifyDualSig, generateMlDsa65Keypair,
 *   } from "@sovereign-matrix/verifiable-receipts";
 *   ```
 *
 * Subpath exports for selective import:
 *   "@sovereign-matrix/verifiable-receipts/pq-sign"
 *   "@sovereign-matrix/verifiable-receipts/guardian"
 *   "@sovereign-matrix/verifiable-receipts/bundle"
 *   "@sovereign-matrix/verifiable-receipts/packs"
 */

export {
  signMlDsa65,
  verifyMlDsa65,
  verifyDualSig,
  formatV3Wire,
  generateMlDsa65Keypair,
  type DualSigVerdict,
} from "./pq-sign.js";

export {
  runGuardian,
  verifyGuardianAttestation,
  quorumCollapse,
  outputSizeRule,
  forbiddenSubstringRule,
  requireTokenRule,
  type GuardianVerdict,
  type GuardianContext,
  type GuardianRule,
  type RuleVerdict,
  type GuardianAttestation,
} from "./guardian.js";

export {
  buildZip,
  bundleDigest,
  buildSignedBundle,
  verifyManifest,
  type ZipEntry,
  type BundleReceiptRow,
  type BundleManifest,
} from "./bundle.js";

export {
  leafHash,
  innerHash,
  treeRoot,
  inclusionProof,
  verifyInclusionProof,
  consistencyProof,
  verifyConsistencyProof,
  buildSth,
  canonicalizeSth,
  type SignedTreeHead,
} from "./transparency.js";

export {
  hipaaRules,
  hipaaPack,
  sr117Rules,
  sr117Pack,
  naicRules,
  naicPack,
  dscsaRules,
  dscsaPack,
  csrdRules,
  csrdPack,
  ALL_PACKS,
  findPack,
  composePacks,
  type GuardianPack,
} from "./packs.js";

/**
 * @sovereign-matrix/elite-sdk — Cook 36-80 public surface (Cook 84).
 *
 * Single import surface for the Tier 1-7 elite primitives. Distinct
 * from `./index.ts` (createAgent / agent-config style); this module
 * exposes the pure library functions external consumers want:
 * cryptographic disclosure, hallucination + bias auditors, billing
 * math, marketplace state machine, workflow DSL, attestation letters,
 * SOC 2 posture, extension SDK, tool registry, CLI dispatcher.
 *
 * Nothing in this module touches Clerk / db / env-bound singletons —
 * everything is pure or dependency-injected. Safe to import from
 * extension hosts, edge runtimes, and Node CLIs alike.
 */

// ── Extension SDK (Cook 65) ───────────────────────────────────────────────
export {
  invokeAgent,
  renderPlainText,
  EXTENSION_SDK_CONSTANTS,
} from "@/lib/extension-sdk";
export type {
  AuthConfig as ExtensionAuthConfig,
  Selection as ExtensionSelection,
  InvokeRequest as ExtensionInvokeRequest,
  InvokeResponse as ExtensionInvokeResponse,
  InvokeOutcome as ExtensionInvokeOutcome,
  FetchImpl,
} from "@/lib/extension-sdk";

// ── Selective disclosure (Cook 51) ────────────────────────────────────────
export {
  commit as commitDisclosure,
  discloseField,
  verifyDisclosure,
  hashLeaf as hashDisclosureLeaf,
} from "@/lib/selective-disclosure";
export type {
  Disclosure,
  FieldProof,
  DisclosureRecord,
} from "@/lib/selective-disclosure";

// ── Multi-party attestation (Cook 43) ─────────────────────────────────────
export {
  sign as signAttestation,
  verifyBatch as verifyAttestationBatch,
} from "@/lib/multi-party-attestation";
export type {
  Attestation,
  AttestationMessage,
  AttestationPolicy,
  VerifyOutcome as AttestationVerifyOutcome,
  WitnessKeyResolver,
} from "@/lib/multi-party-attestation";

// ── Hallucination + bias auditors (Cook 41 / 42) ──────────────────────────
export {
  detect as detectHallucination,
  splitSentences,
} from "@/lib/hallucination-detector";
export type {
  Source as HallucinationSource,
  DetectionRequest,
  DetectionResult,
  SentenceFinding,
} from "@/lib/hallucination-detector";
export { audit as auditBias } from "@/lib/bias-auditor";
export type {
  BiasDimension,
  BiasReport,
  AuditRequest as BiasAuditRequest,
} from "@/lib/bias-auditor";

// ── Receipt analytics (Cook 55) ───────────────────────────────────────────
export { buildTimeline, diffReceipts } from "@/lib/receipt-analytics";
export type {
  ReceiptSummary,
  TimelineBucket,
  ReceiptDiff,
  FieldDiff,
  DiffOp,
} from "@/lib/receipt-analytics";

// ── Compliance scorecards (Cook 49 / 53 / 58) ─────────────────────────────
export {
  CONTROLS,
  buildScorecard,
  renderControlLine,
} from "@/lib/compliance-mappings";
export type {
  Framework,
  Control,
  FrameworkScorecard,
} from "@/lib/compliance-mappings";
export {
  generateAttestationLetter,
  verifyAttestationLetter,
} from "@/lib/attestation-letter";
export type {
  AttestationLetter,
  LetterRequest,
  PeriodStats,
} from "@/lib/attestation-letter";
export {
  buildPosture as buildSoc2Posture,
  SOC2_RULES,
} from "@/lib/soc2-monitor";
export type {
  Soc2Posture,
  ControlRule as Soc2Rule,
  IndicatorReading,
  Tsc as Soc2Tsc,
  ControlStatus as Soc2ControlStatus,
} from "@/lib/soc2-monitor";

// ── Billing math (Cook 19) ────────────────────────────────────────────────
export {
  bankersRound,
  annualPriceFor,
  effectiveDiscount,
  quoteNewSubscription,
  prorateSwitch,
  cancelRefund,
  addMonths,
  DEFAULT_ANNUAL_DISCOUNT,
} from "@/lib/billing-math";
export type {
  Cadence,
  PlanPricing,
  BillingBreakdown,
} from "@/lib/billing-math";

// ── Marketplace math (Cook 62) ────────────────────────────────────────────
export {
  validateListing,
  splitRevenue,
  transition as transitionMarketplaceListing,
  MARKETPLACE_CONSTANTS,
} from "@/lib/marketplace-core";
export type {
  ListingStatus,
  SafetyLayer,
  MarketplaceListing,
  RevenueSplit,
  TransitionResult,
} from "@/lib/marketplace-core";

// ── Orchestration DSL (Cook 37) ───────────────────────────────────────────
export {
  agent as workflowAgent,
  branch,
  parallel,
  runWorkflow,
  seq,
} from "@/lib/orchestration";
export type {
  WorkflowStep,
  WorkflowContext,
  WorkflowResult,
  AgentRunner,
  StepResult,
  AgentStep,
  BranchStep,
  ParallelStep,
  SeqStep,
} from "@/lib/orchestration";

// ── Workflow builder (Cook 66) ────────────────────────────────────────────
export {
  validate as validateWorkflowGraph,
  compile as compileWorkflowGraph,
} from "@/lib/workflow-builder";
export type {
  BuilderNode,
  BuilderEdge,
  WorkflowGraph,
  BuilderNodeKind,
  ValidationResult as WorkflowValidationResult,
  ValidationIssue as WorkflowValidationIssue,
  CompileResult as WorkflowCompileResult,
} from "@/lib/workflow-builder";

// ── CLI dispatcher (Cook 24) ──────────────────────────────────────────────
export {
  CommandRegistry,
  parseArgs,
  renderCommandHelp,
} from "@/lib/cli-dispatcher";
export type {
  ArgSpec,
  CommandSpec,
  CommandInvocation,
  ParseOutcome,
} from "@/lib/cli-dispatcher";

// ── Tool registry (Cook 36) ───────────────────────────────────────────────
export {
  ToolRegistry,
  parseToolCallOutput,
  MAX_TOOL_CALLS_PER_STEP,
  TOOL_CALL_SCHEMA,
} from "@/lib/tool-registry";
export type {
  ToolDefinition,
  ToolContext,
  ToolCallResult,
  ToolCallEnvelope,
} from "@/lib/tool-registry";

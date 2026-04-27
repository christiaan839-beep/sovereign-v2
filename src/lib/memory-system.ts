/**
 * SOVEREIGN MATRIX — Memory System (canonical entry point)
 *
 * The platform has five memory layers, each with a distinct purpose. New code
 * should import from this barrel rather than reaching into the underlying
 * modules — that lets us refactor the implementations without ripping
 * through call sites.
 *
 * ┌───────────────────────────────┬───────────────────────────────────────────┐
 * │ Use case                      │ Entry point                               │
 * ├───────────────────────────────┼───────────────────────────────────────────┤
 * │ Per-user / per-agent rolling  │ saveMemory / queryMemory / getMemory…     │
 * │ context (last N executions)   │ from `tenant-memory`                      │
 * │                               │                                           │
 * │ Long-term semantic recall     │ rememberExecution / recallRelevant /      │
 * │ across executions (embedding) │ buildMemoryContext from `semantic-memory` │
 * │                               │                                           │
 * │ Pub/sub signals between       │ emitSignal / subscribeAgent /             │
 * │ agents during a swarm run     │ getRecentSignals from `agent-memory`      │
 * │                               │                                           │
 * │ Pinecone vector ops           │ remember / recall / memorize from         │
 * │                               │ `memory` (legacy)                         │
 * │                               │                                           │
 * │ Alternative vector storage    │ storeMemory / searchMemory from           │
 * │                               │ `vector-memory`                           │
 * └───────────────────────────────┴───────────────────────────────────────────┘
 *
 * Pick the layer whose verbs match your task — they are not interchangeable.
 */

// ── Tenant rolling memory (per user, per agent) ─────────────────────────────
export {
  saveMemory,
  queryMemory,
  getMemoryContext,
  getMemoryStats,
  clearMemory,
  type MemoryEntry as TenantMemoryEntry,
  type MemoryStats as TenantMemoryStats,
} from "@/lib/tenant-memory";

// ── Semantic / embedding-based recall ───────────────────────────────────────
export {
  rememberExecution,
  recallRelevant,
  buildMemoryContext,
  getSemanticMemoryStats,
  type MemoryType as SemanticMemoryType,
  type SemanticMemoryEntry,
  type SaveMemoryOptions as SemanticSaveOptions,
} from "@/lib/semantic-memory";

// ── Inter-agent signals (pub/sub during a swarm) ────────────────────────────
export {
  emitSignal,
  subscribeAgent,
  getRecentSignals,
  getAgentContext,
  getSignalStats,
  type SignalType,
  type AgentSignal,
} from "@/lib/agent-memory";

// ── Pinecone vector ops (legacy raw layer) ──────────────────────────────────
export {
  getPineconeClient,
  ingestContextualDocument,
  remember as rememberPinecone,
  memorize as memorizePinecone,
  recall as recallPinecone,
} from "@/lib/memory";

// ── Alternative vector storage ──────────────────────────────────────────────
export {
  storeMemory,
  searchMemory,
  getMemoryContextForPrompt,
} from "@/lib/vector-memory";

/**
 * AGENT REGISTRY & CREW COMPOSER — R101.
 *
 * Multi-agent discovery is one of the 6 non-negotiables for an
 * enterprise agentic-AI control plane (per the JBoltAI framework
 * + n8n / UiPath / JumpCloud feature analysis). Sovereign already
 * has 223 agents in `agent-manifests.generated.ts`, but no enforced
 * registry semantics — agents could execute without being declared,
 * and there was no machine-readable way to ask "find me a Tier-1
 * agent that handles invoices."
 *
 * R101 closes that gap with three pure-function primitives:
 *
 *   1. `listRegisteredAgents(filter?)` — read-only query over the
 *      generated manifest map. The auth boundary: an agent NOT in
 *      the manifest is NOT registered, and execute layers can
 *      enforce "registered or refuse" against this list.
 *
 *   2. `findAgentsByCapability(capability)` — capability search
 *      against the manifest's `tools` + `signals` arrays. Returns
 *      candidates with a per-agent capability_match score.
 *
 *   3. `composeCrew(input)` — the Crew Composer. Given a list of
 *      required capabilities + a trust profile (min reputation
 *      grade, max tier, etc.), returns a ranked crew of agents.
 *      Algorithm: capability_match × trust_score × availability,
 *      exactly as specified in the blueprint Prompt 2.
 *
 * Strategic property: this is what activates the "Multi-Agent
 * Discovery" non-negotiable for procurement. n8n requires technical
 * expertise to wire workflows; we ship semantic agent discovery
 * out of the box, against 223 pre-registered agents.
 *
 * No I/O. No DB. No clocks. Pure functions over the static map.
 * Ports to @sovereign/inspector for offline registry queries by
 * auditors verifying "what agents could the platform have spawned?"
 *
 * COMPOSITION:
 *   - Reads agent-manifest.ts shape (tier, tools, signals, output class)
 *   - Composes with R40 reputation (caller passes per-agent grade map)
 *   - Composes with R42 credit lines (caller passes per-agent headroom)
 *   - Composes with R100 policy-engine (the registry filter is
 *     a predicate input that policies can reference)
 */

import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";
import type { AgentManifest, AgentTier } from "@/lib/agent-manifest";
import type { LetterGrade } from "@/lib/agent-reputation";

// ── Capability keywords (extracted from manifest signals + tools) ─

/**
 * The semantic capability surface the registry can match against.
 * These are the verbs an agent CAN do — derived from agent-manifest's
 * `signals.kind` enum and tool names.
 */
export type AgentCapability =
  | "read"
  | "model_call"
  | "external_fetch"
  | "db_write"
  | "file_write"
  | "browser_control"
  | "payment_op"
  | "voice_call"
  | "email_send"
  | "image_gen"
  | "audio_gen"
  | "code_exec";

/**
 * Pure: derive an agent's capabilities from its manifest signals.
 * Tier-1 agents always have "read" + "model_call".
 * Higher tiers get the kinds present in their signals array.
 */
export function deriveCapabilities(m: AgentManifest): AgentCapability[] {
  const caps = new Set<AgentCapability>(["read", "model_call"]);
  for (const sig of m.signals) {
    switch (sig.kind) {
      case "external_fetch":
      case "db_write":
      case "file_write":
      case "browser_control":
      case "payment_op":
      case "voice_call":
      case "email_send":
        caps.add(sig.kind);
        break;
      // model_call already in base set
    }
  }
  // Tools sometimes hint at capabilities not present in signals.
  for (const tool of m.tools) {
    const name = tool.name.toLowerCase();
    if (name.includes("image") || name.includes("flux")) caps.add("image_gen");
    if (name.includes("voice") || name.includes("tts")) caps.add("audio_gen");
    if (name.includes("exec") || name.includes("sandbox"))
      caps.add("code_exec");
  }
  return Array.from(caps).sort();
}

// ── Filter / query types ──────────────────────────────────────────

export interface RegistryFilter {
  /** Inclusive max tier. Default 3 (all tiers). */
  maxTier?: AgentTier;
  /** Required capabilities — ALL must be present on the agent. */
  requiredCapabilities?: AgentCapability[];
  /** PII guard mode allowlist. Default: any. */
  piiGuardModes?: ("mask" | "flag" | "skip" | "default-mask")[];
  /** Output class allowlist. Default: any. */
  outputClasses?: ("public" | "tenant-private" | "confidential")[];
  /** Free-form name pattern (substring, case-insensitive). */
  slugSubstring?: string;
}

export interface RegisteredAgent {
  slug: string;
  manifest: AgentManifest;
  capabilities: AgentCapability[];
}

/**
 * Pure: list all registered agents matching an optional filter.
 *
 * Returns a stable sorted list (slug ascending) for deterministic
 * UI rendering and snapshot testing.
 */
export function listRegisteredAgents(
  filter?: RegistryFilter,
  manifests: Record<string, AgentManifest> = AGENT_MANIFESTS,
): RegisteredAgent[] {
  const out: RegisteredAgent[] = [];
  for (const [slug, m] of Object.entries(manifests)) {
    if (filter?.maxTier !== undefined && m.tier > filter.maxTier) continue;
    if (
      filter?.piiGuardModes &&
      !filter.piiGuardModes.includes(m.pii.guardMode)
    )
      continue;
    if (
      filter?.outputClasses &&
      !filter.outputClasses.includes(m.outputClass)
    )
      continue;
    if (
      filter?.slugSubstring &&
      !slug.toLowerCase().includes(filter.slugSubstring.toLowerCase())
    )
      continue;
    const caps = deriveCapabilities(m);
    if (filter?.requiredCapabilities) {
      const required = new Set(filter.requiredCapabilities);
      let allPresent = true;
      for (const r of required) {
        if (!caps.includes(r)) {
          allPresent = false;
          break;
        }
      }
      if (!allPresent) continue;
    }
    out.push({ slug, manifest: m, capabilities: caps });
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

/**
 * Pure: assert that an agent slug is in the registry. The execute
 * layer calls this before invoking an agent — refuses unknown slugs
 * even if the route handler exists. This is the "registered or
 * refuse" guarantee the JBoltAI framework calls for.
 */
export function isRegistered(
  slug: string,
  manifests: Record<string, AgentManifest> = AGENT_MANIFESTS,
): boolean {
  return Object.prototype.hasOwnProperty.call(manifests, slug);
}

// ── Capability matching ──────────────────────────────────────────

export interface CapabilityMatch {
  slug: string;
  manifest: AgentManifest;
  capabilities: AgentCapability[];
  /**
   * Capability match score: |required ∩ agent_caps| / |required|.
   * 1.0 = agent has every required capability.
   */
  capabilityScore: number;
  /** Required capabilities the agent is MISSING. */
  missingCapabilities: AgentCapability[];
}

/**
 * Pure: find agents matching a required capability set, ranked by
 * how completely they cover the requirement.
 */
export function findAgentsByCapability(
  required: AgentCapability[],
  manifests: Record<string, AgentManifest> = AGENT_MANIFESTS,
): CapabilityMatch[] {
  if (required.length === 0) return [];
  const requiredSet = new Set(required);
  const out: CapabilityMatch[] = [];
  for (const [slug, m] of Object.entries(manifests)) {
    const caps = deriveCapabilities(m);
    const have = caps.filter((c) => requiredSet.has(c));
    const missing = required.filter((r) => !caps.includes(r));
    const score = have.length / required.length;
    if (score === 0) continue;
    out.push({
      slug,
      manifest: m,
      capabilities: caps,
      capabilityScore: score,
      missingCapabilities: missing,
    });
  }
  // Sort: full matches first, then by score desc, then slug asc.
  out.sort((a, b) => {
    if (b.capabilityScore !== a.capabilityScore) {
      return b.capabilityScore - a.capabilityScore;
    }
    return a.slug.localeCompare(b.slug);
  });
  return out;
}

// ── Crew Composer ────────────────────────────────────────────────

const GRADE_RANK: Record<LetterGrade, number> = {
  "A+": 11,
  A: 10,
  "A-": 9,
  "B+": 8,
  B: 7,
  "B-": 6,
  "C+": 5,
  C: 4,
  "C-": 3,
  D: 2,
  F: 1,
  // "no_score_yet" agents are excluded from any minimum-grade filter
  // upstream; the rank value here is unused but required for type
  // exhaustiveness against the LetterGrade union.
  no_score_yet: 0,
};

export interface CrewComposeInput {
  /** Required capabilities for the task. */
  requiredCapabilities: AgentCapability[];
  /** Optional: minimum reputation grade required. */
  minReputationGrade?: LetterGrade;
  /** Optional: max tier (e.g., 1 for read-only crews). */
  maxTier?: AgentTier;
  /** Optional: per-agent reputation map (slug → grade). */
  reputationByAgent?: Record<string, LetterGrade>;
  /** Optional: per-agent availability score 0-1 (slug → score). */
  availabilityByAgent?: Record<string, number>;
  /** Optional: max crew size to return. Default 5. */
  maxCrewSize?: number;
}

export interface CrewMember {
  slug: string;
  manifest: AgentManifest;
  capabilities: AgentCapability[];
  /** capability_match × trust_score × availability — higher is better. */
  rankingScore: number;
  capabilityScore: number;
  reputationGrade?: LetterGrade;
  availability: number;
  /** True if this agent covers EVERY required capability single-handedly. */
  fullCoverage: boolean;
}

export interface CrewProposal {
  /** Members ranked by overall score, descending. */
  members: CrewMember[];
  /** True if at least one member has fullCoverage. */
  fullCoverageAvailable: boolean;
  /** Capabilities that NO crew member can provide. */
  unmetCapabilities: AgentCapability[];
  /** Procurement-readable rationale. */
  rationale: string;
}

/**
 * Pure: compose a ranked crew for a multi-capability task.
 *
 * Algorithm (matches blueprint Prompt 2 spec):
 *   ranking_score = capability_match × trust_score × availability
 *
 * Where:
 *   capability_match = |agent_caps ∩ required| / |required|
 *   trust_score = grade-rank / max-grade-rank (default 0.5 if no rep)
 *   availability = caller-supplied 0-1 (default 1.0)
 *
 * Returns up to maxCrewSize members, plus the set of capabilities
 * not covered by anyone in the crew (the "escalate-to-human" set).
 */
export function composeCrew(
  input: CrewComposeInput,
  manifests: Record<string, AgentManifest> = AGENT_MANIFESTS,
): CrewProposal {
  const requiredSet = new Set(input.requiredCapabilities);
  const required = input.requiredCapabilities;
  const maxSize = input.maxCrewSize ?? 5;
  const minGrade = input.minReputationGrade;

  // Pre-filter by tier + reputation floor + capability overlap.
  const candidates: CrewMember[] = [];
  for (const [slug, m] of Object.entries(manifests)) {
    if (input.maxTier !== undefined && m.tier > input.maxTier) continue;
    const caps = deriveCapabilities(m);
    const intersect = caps.filter((c) => requiredSet.has(c));
    if (intersect.length === 0) continue;

    const grade = input.reputationByAgent?.[slug];
    if (minGrade) {
      if (!grade) continue; // no rep snapshot ⇒ excluded when floor specified
      if (GRADE_RANK[grade] < GRADE_RANK[minGrade]) continue;
    }

    const trust = grade ? GRADE_RANK[grade] / 11 : 0.5;
    const availability = input.availabilityByAgent?.[slug] ?? 1.0;
    const capabilityScore = intersect.length / required.length;
    const rankingScore = capabilityScore * trust * availability;
    const fullCoverage = required.every((r) => caps.includes(r));

    candidates.push({
      slug,
      manifest: m,
      capabilities: caps,
      rankingScore,
      capabilityScore,
      reputationGrade: grade,
      availability,
      fullCoverage,
    });
  }

  candidates.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    return a.slug.localeCompare(b.slug);
  });

  const members = candidates.slice(0, maxSize);
  const covered = new Set<AgentCapability>();
  for (const m of members) {
    for (const c of m.capabilities) {
      if (requiredSet.has(c)) covered.add(c);
    }
  }
  const unmet = required.filter((r) => !covered.has(r));
  const fullCoverageAvailable = members.some((m) => m.fullCoverage);

  const rationale = [
    `Required capabilities: ${required.join(", ")}.`,
    `Evaluated ${Object.keys(manifests).length} registered agents.`,
    `Returned crew: ${members.length} member${members.length === 1 ? "" : "s"} ranked by capability_match × trust × availability.`,
    fullCoverageAvailable
      ? `At least one member covers every required capability — single-agent execution is viable.`
      : `No single agent covers every capability; multi-agent orchestration required.`,
    unmet.length === 0
      ? `All capabilities met by the proposed crew.`
      : `Unmet capabilities: ${unmet.join(", ")} — escalate to human or expand registry.`,
  ].join(" ");

  return {
    members,
    fullCoverageAvailable,
    unmetCapabilities: unmet,
    rationale,
  };
}

// ── Stats / summary ──────────────────────────────────────────────

export interface RegistryStats {
  total: number;
  byTier: Record<AgentTier, number>;
  byOutputClass: Record<"public" | "tenant-private" | "confidential", number>;
  byPiiGuard: Record<"mask" | "flag" | "skip" | "default-mask", number>;
  totalSignals: number;
  totalTools: number;
}

/**
 * Pure: summary statistics over the registered agents — used by the
 * /trust/control-plane page and the public registry endpoint.
 */
export function registryStats(
  manifests: Record<string, AgentManifest> = AGENT_MANIFESTS,
): RegistryStats {
  const stats: RegistryStats = {
    total: 0,
    byTier: { 1: 0, 2: 0, 3: 0 },
    byOutputClass: { public: 0, "tenant-private": 0, confidential: 0 },
    byPiiGuard: { mask: 0, flag: 0, skip: 0, "default-mask": 0 },
    totalSignals: 0,
    totalTools: 0,
  };
  for (const m of Object.values(manifests)) {
    stats.total += 1;
    stats.byTier[m.tier] += 1;
    stats.byOutputClass[m.outputClass] += 1;
    stats.byPiiGuard[m.pii.guardMode] += 1;
    stats.totalSignals += m.signals.length;
    stats.totalTools += m.tools.length;
  }
  return stats;
}

/**
 * Move 20 — Platform AIBOM builder.
 *
 * Composes a Sovereign Matrix platform-level AIBOM (Agentic Bill of
 * Materials, R150) from three sources of truth that live in the
 * codebase:
 *
 *   1. src/lib/agent-manifests.generated.ts — every agent's models,
 *      tools, signals, output class, etc.
 *   2. A curated model registry (the 39+ frontier + open-source
 *      models the platform routes across)
 *   3. package.json (transitive dependencies don't appear; only the
 *      direct top-level deps, since AIBOM is procurement-readable
 *      not security-scanner output)
 *
 * Every component carries a SHA-256 fingerprint over its identity
 * fields so a downstream auditor can `validateAIBOMDocument()` the
 * served doc and confirm nothing was tampered with after generation.
 *
 * The builder is PURE-FUNCTION (no I/O at call site — caller passes
 * AGENT_MANIFESTS + package version). Output is a complete
 * AIBOMDocument suitable for serving at /.well-known/aibom.json
 * and for `validateAIBOMDocument` in the inspector.
 */

import {
  buildAIBOMDocument,
  type AIBOMComponent,
  type AIBOMDocument,
  type AIBOMRelationship,
} from "@/lib/supply-chain/aibom";
import type { AgentManifest } from "@/lib/agent-manifest";

/**
 * Curated model registry. Each entry is one of the frontier or
 * open-source models the platform's router may invoke. Versions
 * are pinned to the registry-id used in src/lib/ai.ts and provider
 * configs.
 *
 * If you add a new model to the routing layer, add it here so the
 * AIBOM stays accurate. weekly-health invariants enforce the count.
 */
export const PLATFORM_MODEL_COMPONENTS: ReadonlyArray<
  Omit<AIBOMComponent, "fingerprint">
> = [
  // NVIDIA NIM (free tier, primary)
  { id: "model.nemotron-ultra-253b-v1", kind: "model", name: "Nemotron Ultra 253B", version: "v1", license: "NVIDIA Open Model", supplier: "NVIDIA NIM" },
  { id: "model.nemotron-cascade-2", kind: "model", name: "Nemotron Cascade 2", version: "2", license: "NVIDIA Open Model", supplier: "NVIDIA NIM" },
  { id: "model.llama-4-maverick", kind: "model", name: "Llama 4 Maverick (400B MoE)", version: "4", license: "Meta Llama 4", supplier: "NVIDIA NIM" },
  { id: "model.deepseek-v3-2", kind: "model", name: "DeepSeek V3.2", version: "3.2", license: "DeepSeek License", supplier: "NVIDIA NIM" },
  { id: "model.qwen-3", kind: "model", name: "Qwen 3", version: "3", license: "Apache-2.0", supplier: "NVIDIA NIM" },
  { id: "model.nv-embedqa-1b-v2", kind: "model", name: "nv-embedqa-1b-v2", version: "v2", license: "NVIDIA Open Model", supplier: "NVIDIA NIM" },
  // Google
  { id: "model.gemini-3-1-pro", kind: "model", name: "Gemini 3.1 Pro", version: "3.1", license: "Proprietary", supplier: "Google" },
  { id: "model.gemma-4-31b-it", kind: "model", name: "Gemma 4 31B IT", version: "4", license: "Gemma License", supplier: "Google" },
  // Anthropic
  { id: "model.claude-mythos", kind: "model", name: "Claude Mythos", version: "preview", license: "Proprietary", supplier: "Anthropic" },
  { id: "model.claude-opus-4-7", kind: "model", name: "Claude Opus 4.7", version: "4.7", license: "Proprietary", supplier: "Anthropic" },
  // Cerebras
  { id: "model.cerebras-fast", kind: "model", name: "Cerebras (Llama 3.3 70B)", version: "70b", license: "Llama 3", supplier: "Cerebras" },
  // Groq
  { id: "model.groq-fast", kind: "model", name: "Groq (Mixtral 8x7B)", version: "8x7b", license: "Apache-2.0", supplier: "Groq" },
  // Black Forest Labs
  { id: "model.flux-1", kind: "model", name: "FLUX.1", version: "1", license: "BFL Non-Commercial", supplier: "Black Forest Labs" },
];

/**
 * Curated tool registry. The MCP-shaped tools the platform exposes
 * to peer agents. For now: a small canonical set; will grow as the
 * MCP tool gateway (R161) wires up more tool descriptors.
 */
export const PLATFORM_TOOL_COMPONENTS: ReadonlyArray<
  Omit<AIBOMComponent, "fingerprint">
> = [
  { id: "tool.platform-health-check", kind: "tool", name: "Platform health check", version: "v1", license: "MIT", supplier: "Sovereign Matrix" },
  { id: "tool.audit-chain-head", kind: "tool", name: "Audit chain head probe", version: "v1", license: "MIT", supplier: "Sovereign Matrix" },
];

/**
 * Pure: build the platform-level AIBOM document. Caller supplies the
 * AGENT_MANIFESTS map (so this stays deterministic + testable) plus a
 * platformVersion string (typically the deploy SHA or package version).
 */
export function buildPlatformAIBOM(args: {
  agentManifests: Record<string, AgentManifest>;
  platformVersion: string;
  generatedAt: string;
}): AIBOMDocument {
  const components: Array<Omit<AIBOMComponent, "fingerprint">> = [];
  const relationships: AIBOMRelationship[] = [];

  // 1. Models
  for (const m of PLATFORM_MODEL_COMPONENTS) {
    components.push(m);
  }

  // 2. Tools
  for (const t of PLATFORM_TOOL_COMPONENTS) {
    components.push(t);
  }

  // 3. Each agent in the manifest registry
  for (const [slug, manifest] of Object.entries(args.agentManifests)) {
    const agentId = `agent.${slug}`;
    components.push({
      id: agentId,
      kind: "agent",
      name: slug,
      version: args.platformVersion,
      license: "Proprietary",
      supplier: "Sovereign Matrix",
      tags: [
        `tier:${manifest.tier}`,
        `output-class:${manifest.outputClass}`,
        `pii-mode:${manifest.pii.guardMode}`,
      ],
    });
    // Relationships: agent INVOKES each declared model provider.
    // Map manifest provider names to component ids by supplier.
    // Each agent INVOKES one provider entry per declared ref;
    // we collapse duplicates by (agentId, supplier).
    const seen = new Set<string>();
    for (const ref of manifest.models ?? []) {
      const supplierMatch = PLATFORM_MODEL_COMPONENTS.find(
        (m) =>
          m.supplier?.toLowerCase().includes(ref.provider.replace("-", " ")) ||
          ref.provider.includes(m.supplier?.toLowerCase().split(" ")[0] ?? ""),
      );
      if (supplierMatch) {
        const key = `${agentId}->${supplierMatch.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({
          fromId: agentId,
          toId: supplierMatch.id,
          kind: "INVOKES",
        });
      }
    }
  }

  return buildAIBOMDocument({
    scope: "platform",
    generatedAt: args.generatedAt,
    components,
    relationships,
  });
}

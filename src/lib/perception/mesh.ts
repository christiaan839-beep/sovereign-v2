/**
 * MULTIMODAL PERCEPTION MESH — R111.
 *
 * The strategic moat over "platforms that use Nemotron Omni." This
 * primitive turns ONE MODEL into a PRODUCT CATEGORY by letting
 * customers compose a SWARM of specialized perception nodes — each
 * an instance of Nemotron Omni tuned for a specific modality + task
 * — and CORRELATE THEIR OUTPUTS across streams.
 *
 * THE PROBLEM WE SOLVE:
 *
 *   "Watch this video stream + transcribe these calls + analyze
 *   these screenshots + ALERT when a phrase in the audio matches
 *   a face in the video appearing in a screenshot."
 *
 *   That cross-modal correlation is what fragmented model chains
 *   cannot do — they lose context at every model handoff. With
 *   Nemotron Omni's UNIFIED context, the correlation logic is
 *   tractable AND deterministic.
 *
 * DESIGN CONTRACT:
 *
 *   1. Pure-function plan composition. `composePerceptionMesh(spec,
 *      inputs)` produces a deterministic execution plan. No I/O.
 *      Tests verify the plan against fixtures; ports to inspector.
 *
 *   2. Five node kinds. Each is a specialized Omni invocation:
 *      - `video-monitor` — continuous video understanding
 *      - `audio-transcriber` — speech-to-text + speaker labels
 *      - `screenshot-analyzer` — computer-use GUI extraction
 *      - `document-extractor` — structured JSON from PDFs/docs
 *      - `freeform-synthesizer` — flexible cross-input synthesis
 *
 *   3. Cross-modal correlation. After all nodes run,
 *      `correlateAcrossNodes(outputs, rules)` extracts the signals
 *      that NO single node could see — keyword overlap, time
 *      proximity, named-entity match, sentiment delta, and more.
 *
 *   4. Composition with the Control Plane. Mesh execution respects
 *      R100 policy decisions (e.g., "only allow video monitoring
 *      with explicit consent tag"). Mesh outputs feed R26 audit
 *      chain. Mesh budget is gated by R102 cost governance.
 *
 *   5. Plan determinism. Same spec + same inputs = same plan. Same
 *      plan + same node outputs = same correlation. Customers can
 *      replay any mesh decision offline via @sovereign/inspector.
 */

import type {
  PerceptionInputPart,
  PerceptionRequestInput,
  PerceptionTask,
} from "./nemotron-omni-client";
import {
  defaultSystemPromptFor,
  buildOmniRequest,
  type OmniRequestBody,
} from "./nemotron-omni-client";

// ── Node kinds ────────────────────────────────────────────────────

export type MeshNodeKind =
  | "video-monitor"
  | "audio-transcriber"
  | "screenshot-analyzer"
  | "document-extractor"
  | "freeform-synthesizer";

/** Map mesh node kinds to default perception tasks (system prompts). */
const NODE_KIND_TO_TASK: Record<MeshNodeKind, PerceptionTask> = {
  "video-monitor": "video-summarize",
  "audio-transcriber": "audio-transcribe",
  "screenshot-analyzer": "screenshot-analyze",
  "document-extractor": "document-extract",
  "freeform-synthesizer": "freeform",
};

export interface MeshNodeSpec {
  /** Unique within a mesh — used for correlation references. */
  nodeId: string;
  kind: MeshNodeKind;
  /** Customize the default system prompt with extra instructions. */
  systemPromptAddendum?: string;
  /** Override task default (rarely needed). */
  systemPromptOverride?: string;
  /** Force JSON output (auto-enabled for document-extractor). */
  responseFormat?: "text" | "json";
  /** Token budget per node. Default 1024. */
  maxTokens?: number;
}

/**
 * Specification of a perception mesh — what nodes to run and how
 * inputs map to them.
 */
export interface MeshSpec {
  nodes: MeshNodeSpec[];
  /** Time budget (seconds) — used by cost governance. */
  budgetSeconds?: number;
}

/**
 * Each node's input — a subset of the global mesh inputs that's
 * routed to that specific node.
 */
export interface MeshInputs {
  /** Global text context (e.g., a user question). Available to every node. */
  context?: string;
  /** nodeId → parts to feed that node. */
  perNode: Record<string, PerceptionInputPart[]>;
}

// ── Plan: what the runtime will execute ──────────────────────────

export interface MeshNodePlan {
  nodeId: string;
  kind: MeshNodeKind;
  /** The exact OmniRequestBody this node will POST. */
  request: OmniRequestBody;
  /** Echoed back for procurement-readable plan trace. */
  systemPrompt: string;
  /** Echoed back so the auditor can see what was routed where. */
  partKindsRouted: string[];
}

export interface MeshExecutionPlan {
  /** The per-node plans, in stable nodeId order. */
  nodePlans: MeshNodePlan[];
  /** Procurement-readable rationale. */
  rationale: string;
  /** Total estimated tokens (sum of per-node maxTokens). */
  estimatedMaxTokens: number;
}

// ── Pure: plan composition ───────────────────────────────────────

/**
 * Pure: given a mesh spec + inputs, build the execution plan.
 *
 * This is the PURE-FUNCTION substrate. The plan is what gets
 * audited, what gets cost-governed, and what can be re-played
 * offline by the inspector.
 *
 * Throws on misconfigured specs (caller's job to handle).
 */
export function composePerceptionMesh(
  spec: MeshSpec,
  inputs: MeshInputs,
): MeshExecutionPlan {
  if (!spec.nodes || spec.nodes.length === 0) {
    throw new Error("Mesh spec must include at least one node");
  }
  // Stable order — sort by nodeId to make plans deterministic
  // regardless of caller-supplied ordering.
  const nodes = [...spec.nodes].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId),
  );

  const nodePlans: MeshNodePlan[] = [];
  let estimatedTokens = 0;

  for (const n of nodes) {
    const task = NODE_KIND_TO_TASK[n.kind];
    const baseSystem =
      n.systemPromptOverride ?? defaultSystemPromptFor(task);
    const systemPrompt = n.systemPromptAddendum
      ? `${baseSystem}\n\nAdditional instructions: ${n.systemPromptAddendum}`
      : baseSystem;

    const parts = inputs.perNode[n.nodeId] ?? [];
    if (parts.length === 0) {
      throw new Error(
        `Mesh node ${n.nodeId} has no inputs in MeshInputs.perNode`,
      );
    }
    // Inject the global context as a prefix text part if present.
    const fullParts: PerceptionInputPart[] = inputs.context
      ? [{ kind: "text", text: inputs.context }, ...parts]
      : parts;

    // document-extractor implies JSON output (matches the perception-task default).
    const responseFormat: "text" | "json" =
      n.responseFormat ?? (n.kind === "document-extractor" ? "json" : "text");

    const requestInput: PerceptionRequestInput = {
      system: systemPrompt,
      parts: fullParts,
      responseFormat,
      maxTokens: n.maxTokens ?? 1024,
    };
    const request = buildOmniRequest(requestInput);
    estimatedTokens += request.max_tokens;

    nodePlans.push({
      nodeId: n.nodeId,
      kind: n.kind,
      request,
      systemPrompt,
      partKindsRouted: parts.map((p) => p.kind),
    });
  }

  const rationale = [
    `Composed ${nodePlans.length} perception node${nodePlans.length === 1 ? "" : "s"}.`,
    `Total estimated max-tokens: ${estimatedTokens}.`,
    `Node kinds: ${nodePlans.map((p) => `${p.nodeId}(${p.kind})`).join(", ")}.`,
    inputs.context
      ? `Global context (${inputs.context.length} chars) prefixed to every node.`
      : `No global context — nodes operate on per-node inputs only.`,
    `Plan is deterministic — same spec + inputs always yields this plan. Replayable offline via @sovereign/inspector.`,
  ].join(" ");

  return { nodePlans, rationale, estimatedMaxTokens: estimatedTokens };
}

// ── Cross-modal correlation ──────────────────────────────────────

/**
 * Per-node output — what the runtime feeds back to the correlator
 * after each node returns from Omni.
 */
export interface MeshNodeOutput {
  nodeId: string;
  kind: MeshNodeKind;
  /** The raw text returned by Omni for this node. */
  text: string;
  /** True if the output is structured JSON. */
  isJsonOutput?: boolean;
  /** Optional: structured entities the node detected (text/JSON parsing
   *  by the runtime). */
  entities?: Array<{
    name: string;
    /** "person" | "place" | "company" | "phrase" | "anything else" */
    type: string;
    /** Confidence 0-1; defaults 1.0 if unknown. */
    confidence?: number;
  }>;
  /** Optional: timestamp the node observed (ISO 8601). */
  observedAt?: string;
}

export interface CorrelationRule {
  /** Stable name for procurement audit. */
  name: string;
  /** Human-readable purpose. */
  description?: string;
  kind:
    | "keyword-overlap"
    | "entity-overlap"
    | "time-proximity"
    | "json-field-match";
  /** For keyword-overlap: substrings (case-insensitive) that must appear in 2+ nodes. */
  keywords?: string[];
  /** For entity-overlap: entity names that must appear in 2+ nodes. */
  entityNames?: string[];
  /** For time-proximity: max delta in seconds between two node observations. */
  proximitySeconds?: number;
  /** For json-field-match: a dotted JSON path that must agree between 2+ nodes. */
  jsonField?: string;
  /** Per-rule severity (informational / warn / alert). */
  severity?: "info" | "warn" | "alert";
}

export interface CrossModalSignal {
  ruleName: string;
  severity: "info" | "warn" | "alert";
  matchedNodeIds: string[];
  /** Procurement-readable explanation. */
  reason: string;
  /** What was matched (keywords / entity names / values). */
  matchedTokens: string[];
}

// ── Pure: correlation ────────────────────────────────────────────

function lcContains(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Pure: extract cross-modal correlation signals from the per-node
 * outputs against a list of rules.
 *
 * Each rule kind has a precise, testable predicate:
 *   - keyword-overlap: at least one keyword appears in 2+ node texts.
 *   - entity-overlap: at least one named entity (case-insensitive)
 *     appears in 2+ nodes' entity lists.
 *   - time-proximity: 2+ nodes' observedAt timestamps are within
 *     proximitySeconds of each other.
 *   - json-field-match: 2+ nodes' parsed JSON outputs share the same
 *     value at the rule's jsonField.
 */
export function correlateAcrossNodes(
  outputs: MeshNodeOutput[],
  rules: CorrelationRule[],
): CrossModalSignal[] {
  const signals: CrossModalSignal[] = [];

  for (const rule of rules) {
    const sev = rule.severity ?? "info";

    if (rule.kind === "keyword-overlap") {
      const kws = rule.keywords ?? [];
      for (const kw of kws) {
        const matched = outputs.filter((o) => lcContains(o.text, kw));
        if (matched.length >= 2) {
          signals.push({
            ruleName: rule.name,
            severity: sev,
            matchedNodeIds: matched.map((m) => m.nodeId),
            matchedTokens: [kw],
            reason: `keyword "${kw}" present in ${matched.length} nodes (${matched.map((m) => m.nodeId).join(", ")})`,
          });
        }
      }
    }

    if (rule.kind === "entity-overlap") {
      const targets = (rule.entityNames ?? []).map((e) => e.toLowerCase());
      for (const target of targets) {
        const matched = outputs.filter((o) =>
          (o.entities ?? []).some((e) => e.name.toLowerCase() === target),
        );
        if (matched.length >= 2) {
          signals.push({
            ruleName: rule.name,
            severity: sev,
            matchedNodeIds: matched.map((m) => m.nodeId),
            matchedTokens: [target],
            reason: `entity "${target}" detected in ${matched.length} nodes (${matched.map((m) => m.nodeId).join(", ")})`,
          });
        }
      }
    }

    if (rule.kind === "time-proximity") {
      const proxSec = rule.proximitySeconds ?? 60;
      const dated = outputs.filter((o) => typeof o.observedAt === "string");
      for (let i = 0; i < dated.length; i++) {
        for (let j = i + 1; j < dated.length; j++) {
          const a = dated[i];
          const b = dated[j];
          // ESLint is not narrowing the filter() outcome — guard explicitly.
          if (
            typeof a.observedAt !== "string" ||
            typeof b.observedAt !== "string"
          )
            continue;
          const delta =
            Math.abs(
              new Date(a.observedAt).getTime() -
                new Date(b.observedAt).getTime(),
            ) / 1000;
          if (delta <= proxSec) {
            signals.push({
              ruleName: rule.name,
              severity: sev,
              matchedNodeIds: [a.nodeId, b.nodeId],
              matchedTokens: [`Δ ${delta.toFixed(1)}s`],
              reason: `nodes ${a.nodeId} and ${b.nodeId} observed within ${delta.toFixed(1)}s of each other (window ${proxSec}s)`,
            });
          }
        }
      }
    }

    if (rule.kind === "json-field-match" && rule.jsonField) {
      const pathParts = rule.jsonField.split(".");
      const valueByNode = new Map<string, string>();
      for (const o of outputs) {
        if (!o.isJsonOutput) continue;
        try {
          let v: unknown = JSON.parse(o.text);
          for (const p of pathParts) {
            if (v && typeof v === "object" && p in (v as Record<string, unknown>)) {
              v = (v as Record<string, unknown>)[p];
            } else {
              v = undefined;
              break;
            }
          }
          if (v !== undefined && v !== null) {
            valueByNode.set(o.nodeId, JSON.stringify(v));
          }
        } catch {
          // Skip malformed JSON.
        }
      }
      // Group node IDs by serialized value; flag groups with size ≥ 2.
      const byValue = new Map<string, string[]>();
      for (const [nodeId, v] of valueByNode.entries()) {
        const list = byValue.get(v) ?? [];
        list.push(nodeId);
        byValue.set(v, list);
      }
      for (const [v, ids] of byValue.entries()) {
        if (ids.length >= 2) {
          signals.push({
            ruleName: rule.name,
            severity: sev,
            matchedNodeIds: ids,
            matchedTokens: [v],
            reason: `JSON field "${rule.jsonField}" agrees on value ${v} across ${ids.length} nodes`,
          });
        }
      }
    }
  }

  // Sort signals: alert > warn > info; within tier, alphabetical by rule.
  const sevOrder: Record<CrossModalSignal["severity"], number> = {
    alert: 0,
    warn: 1,
    info: 2,
  };
  signals.sort((a, b) => {
    if (a.severity !== b.severity) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return a.ruleName.localeCompare(b.ruleName);
  });

  return signals;
}

// ── Convenience: pre-built mesh + correlation specs ───────────────

/**
 * Pre-built mesh: "Boardroom Watch" — video monitor + audio transcriber
 * + screenshot analyzer with cross-modal correlation watching for
 * compliance keywords.
 */
export const BOARDROOM_WATCH_MESH: MeshSpec = {
  nodes: [
    { nodeId: "boardroom-video", kind: "video-monitor" },
    { nodeId: "boardroom-audio", kind: "audio-transcriber" },
    { nodeId: "boardroom-screen", kind: "screenshot-analyzer" },
  ],
  budgetSeconds: 60,
};

export const BOARDROOM_COMPLIANCE_RULES: CorrelationRule[] = [
  {
    name: "earnings-leak-watch",
    description:
      "Alert when 'earnings' or 'guidance' or 'revenue' appears in any 2 of [video, audio, screen] within a meeting.",
    kind: "keyword-overlap",
    keywords: ["earnings", "guidance", "revenue", "Q1", "Q2", "Q3", "Q4"],
    severity: "warn",
  },
  {
    name: "named-entity-leak-watch",
    description:
      "Alert when a tracked party is mentioned across modalities.",
    kind: "entity-overlap",
    entityNames: [],
    severity: "warn",
  },
];

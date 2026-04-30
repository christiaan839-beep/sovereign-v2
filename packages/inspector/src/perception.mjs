/**
 * @sovereign/inspector — Multimodal Perception Mesh (R110 + R111).
 *
 * Pure-function port of src/lib/perception/{nemotron-omni-client,mesh}.ts
 * to standalone Node ESM. Same canonical message format, same plan
 * composition, same cross-modal correlation rules.
 *
 * Strategic property: a customer can verify OFFLINE that the platform's
 * perception mesh would produce the EXACT same plan + correlation
 * signals that this inspector computes. No Sovereign network call
 * required at verification time.
 *
 * Coverage:
 *   - buildOmniRequest / partToWire / buildOmniMessages
 *   - validatePerceptionInput (7 typed failure reasons)
 *   - parseOmniResponse (3 typed failure reasons)
 *   - composePerceptionMesh (deterministic plan composer)
 *   - correlateAcrossNodes (4 cross-modal rule kinds)
 */

// ── Constants ─────────────────────────────────────────────────────

const MAX_DATA_URL_BYTES = 25 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_AUDIO_MIMES = new Set([
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-wav",
  "audio/ogg",
]);

// ── Pure: input → wire content parts ──────────────────────────────

export function partToWire(part) {
  switch (part.kind) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return {
        type: "image_url",
        image_url: { url: part.imageUrl, detail: part.detail ?? "auto" },
      };
    case "image-base64":
      return {
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
      };
    case "audio":
      return { type: "audio_url", audio_url: { url: part.audioUrl } };
    case "audio-base64":
      return {
        type: "audio_url",
        audio_url: { url: `data:${part.mimeType};base64,${part.base64}` },
      };
    case "video":
      return { type: "video_url", video_url: { url: part.videoUrl } };
    default:
      throw new Error(`Unknown perception part kind: ${part?.kind}`);
  }
}

export function buildOmniMessages(input) {
  return [
    { role: "system", content: input.system },
    {
      role: "user",
      content: input.parts.map(partToWire),
    },
  ];
}

export function getOmniModelSlug() {
  return (
    process.env.NEMOTRON_OMNI_MODEL_SLUG ||
    "nvidia/nemotron-3-nano-omni-30b-a3b"
  );
}

export function buildOmniRequest(input) {
  const body = {
    model: getOmniModelSlug(),
    messages: buildOmniMessages({ system: input.system, parts: input.parts }),
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 1024,
  };
  if (input.tools && input.tools.length > 0) {
    body.tools = input.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = "auto";
  }
  if (input.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }
  return body;
}

// ── Pure: defensive validation ────────────────────────────────────

export function validatePerceptionInput(input) {
  if (!input.system || input.system.trim().length === 0) {
    return { ok: false, reason: "system_prompt_required" };
  }
  if (!input.parts || input.parts.length === 0) {
    return { ok: false, reason: "no_parts" };
  }
  if (
    input.maxTokens !== undefined &&
    (input.maxTokens < 1 || input.maxTokens > 32_000)
  ) {
    return { ok: false, reason: "max_tokens_out_of_range" };
  }
  for (const p of input.parts) {
    if (p.kind === "image-base64") {
      if (!ALLOWED_IMAGE_MIMES.has(p.mimeType)) {
        return { ok: false, reason: "unsupported_image_mime" };
      }
      if ((p.base64.length * 3) / 4 > MAX_DATA_URL_BYTES) {
        return { ok: false, reason: "image_data_url_too_large" };
      }
    }
    if (p.kind === "audio-base64") {
      if (!ALLOWED_AUDIO_MIMES.has(p.mimeType)) {
        return { ok: false, reason: "unsupported_audio_mime" };
      }
      if ((p.base64.length * 3) / 4 > MAX_DATA_URL_BYTES) {
        return { ok: false, reason: "audio_data_url_too_large" };
      }
    }
  }
  return { ok: true };
}

// ── Pure: response parser ─────────────────────────────────────────

export function parseOmniResponse(resp) {
  if (!resp || typeof resp !== "object") {
    return { ok: false, reason: "malformed_response" };
  }
  if (!Array.isArray(resp.choices) || resp.choices.length === 0) {
    return { ok: false, reason: "no_choices" };
  }
  const choice = resp.choices[0];
  if (!choice.message) {
    return { ok: false, reason: "no_message" };
  }
  const text = choice.message.content ?? "";
  const toolCalls = [];
  if (Array.isArray(choice.message.tool_calls)) {
    for (const tc of choice.message.tool_calls) {
      if (tc.type !== "function") continue;
      let parsed = {};
      try {
        parsed = JSON.parse(tc.function.arguments);
      } catch {
        // Malformed args: surface as empty rather than crash.
      }
      toolCalls.push({ name: tc.function.name, arguments: parsed });
    }
  }
  let isJsonOutput = false;
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      JSON.parse(text);
      isJsonOutput = true;
    } catch {
      // Not actually JSON — fine.
    }
  }
  return {
    ok: true,
    outcome: {
      text,
      toolCalls,
      isJsonOutput,
      usage: resp.usage
        ? {
            promptTokens: resp.usage.prompt_tokens,
            completionTokens: resp.usage.completion_tokens,
            totalTokens: resp.usage.total_tokens,
          }
        : undefined,
    },
  };
}

// ── Pure: per-task default system prompts ─────────────────────────

export function defaultSystemPromptFor(task) {
  switch (task) {
    case "video-summarize":
      return "You are a video understanding agent. Watch the provided video and return a concise summary covering: (1) overall topic, (2) key moments with timestamps, (3) any text on screen, (4) speakers and their roles. Be factual; cite exact moments.";
    case "audio-transcribe":
      return "You are an audio transcription agent. Return a verbatim transcript of the provided audio. Include speaker labels (Speaker 1, Speaker 2) when multiple voices are present. Preserve filler words, false starts, and timestamps every 30 seconds.";
    case "audio-summarize":
      return "You are an audio understanding agent. Listen to the provided audio and return: (1) topic, (2) key points, (3) decisions made or action items, (4) sentiment overall. Cite timestamps when relevant.";
    case "image-describe":
      return "You are a vision agent. Describe the provided image factually: subjects, setting, text on the image, any noteworthy details. Do NOT speculate beyond what is visible.";
    case "screenshot-analyze":
      return "You are a computer-use agent analyzing a screenshot. Identify: (1) the application/website, (2) interactive elements (buttons, fields, menus) with approximate coordinates, (3) the current state and any error messages. Output should be actionable for a downstream automation agent.";
    case "document-extract":
      return "You are a document understanding agent. Extract structured data from the provided document. Return JSON with all fields you can identify. Preserve original casing, dates in ISO 8601, currencies in ISO 4217.";
    case "freeform":
      return "You are a multimodal perception agent. Analyze the provided inputs and respond to the user's question. Cite which input you drew each conclusion from.";
    default:
      throw new Error(`Unknown perception task: ${task}`);
  }
}

// ── Mesh: node kind taxonomy ──────────────────────────────────────

const NODE_KIND_TO_TASK = {
  "video-monitor": "video-summarize",
  "audio-transcriber": "audio-transcribe",
  "screenshot-analyzer": "screenshot-analyze",
  "document-extractor": "document-extract",
  "freeform-synthesizer": "freeform",
};

// ── Pure: plan composition ────────────────────────────────────────

export function composePerceptionMesh(spec, inputs) {
  if (!spec.nodes || spec.nodes.length === 0) {
    throw new Error("Mesh spec must include at least one node");
  }
  const nodes = [...spec.nodes].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId),
  );

  const nodePlans = [];
  let estimatedTokens = 0;

  for (const n of nodes) {
    const task = NODE_KIND_TO_TASK[n.kind];
    if (!task) throw new Error(`Unknown mesh node kind: ${n.kind}`);
    const baseSystem = n.systemPromptOverride ?? defaultSystemPromptFor(task);
    const systemPrompt = n.systemPromptAddendum
      ? `${baseSystem}\n\nAdditional instructions: ${n.systemPromptAddendum}`
      : baseSystem;

    const parts = inputs.perNode[n.nodeId] ?? [];
    if (parts.length === 0) {
      throw new Error(
        `Mesh node ${n.nodeId} has no inputs in MeshInputs.perNode`,
      );
    }
    const fullParts = inputs.context
      ? [{ kind: "text", text: inputs.context }, ...parts]
      : parts;

    const responseFormat =
      n.responseFormat ?? (n.kind === "document-extractor" ? "json" : "text");

    const requestInput = {
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
    `Plan is deterministic — same spec + inputs always yields this plan. Replayable offline.`,
  ].join(" ");

  return { nodePlans, rationale, estimatedMaxTokens: estimatedTokens };
}

// ── Pure: cross-modal correlation ─────────────────────────────────

function lcContains(text, needle) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

export function correlateAcrossNodes(outputs, rules) {
  const signals = [];

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
            reason: `keyword "${kw}" present in ${matched.length} nodes (${matched
              .map((m) => m.nodeId)
              .join(", ")})`,
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
            reason: `entity "${target}" detected in ${matched.length} nodes (${matched
              .map((m) => m.nodeId)
              .join(", ")})`,
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
      const valueByNode = new Map();
      for (const o of outputs) {
        if (!o.isJsonOutput) continue;
        try {
          let v = JSON.parse(o.text);
          for (const p of pathParts) {
            if (v && typeof v === "object" && p in v) {
              v = v[p];
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
      const byValue = new Map();
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
  const sevOrder = { alert: 0, warn: 1, info: 2 };
  signals.sort((a, b) => {
    if (a.severity !== b.severity) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return a.ruleName.localeCompare(b.ruleName);
  });

  return signals;
}

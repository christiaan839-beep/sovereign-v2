/**
 * @sovereign/inspector — perception module tests.
 *
 * Verifies cross-implementation agreement between this port and the
 * TS source at src/lib/perception/. If these tests pass, customers
 * using @sovereign/inspector compute the EXACT same plans + correlation
 * signals that the platform computes at runtime.
 */

import { describe, it, expect } from "vitest";
import {
  partToWire,
  buildOmniMessages,
  buildOmniRequest,
  validatePerceptionInput,
  parseOmniResponse,
  composePerceptionMesh,
  correlateAcrossNodes,
  defaultSystemPromptFor,
} from "../src/perception.mjs";

describe("@sovereign/inspector perception — partToWire (4 modalities)", () => {
  it("text → type:text", () => {
    expect(partToWire({ kind: "text", text: "hello" })).toEqual({
      type: "text",
      text: "hello",
    });
  });
  it("image with detail=auto by default", () => {
    expect(
      partToWire({ kind: "image", imageUrl: "https://x.com/a.png" }),
    ).toEqual({
      type: "image_url",
      image_url: { url: "https://x.com/a.png", detail: "auto" },
    });
  });
  it("audio URL → audio_url", () => {
    expect(
      partToWire({ kind: "audio", audioUrl: "https://x.com/a.mp3" }),
    ).toEqual({
      type: "audio_url",
      audio_url: { url: "https://x.com/a.mp3" },
    });
  });
  it("video URL → video_url", () => {
    expect(
      partToWire({ kind: "video", videoUrl: "https://x.com/v.mp4" }),
    ).toEqual({
      type: "video_url",
      video_url: { url: "https://x.com/v.mp4" },
    });
  });
});

describe("buildOmniRequest — defaults + tool serialization", () => {
  const baseInput = {
    system: "test",
    parts: [{ kind: "text", text: "hi" }],
  };
  it("temperature defaults to 0.2 and max_tokens to 1024", () => {
    const r = buildOmniRequest(baseInput);
    expect(r.temperature).toBe(0.2);
    expect(r.max_tokens).toBe(1024);
  });
  it("response_format=json_object when requested", () => {
    const r = buildOmniRequest({ ...baseInput, responseFormat: "json" });
    expect(r.response_format).toEqual({ type: "json_object" });
  });
  it("tools serialize into OpenAI function format with tool_choice=auto", () => {
    const r = buildOmniRequest({
      ...baseInput,
      tools: [
        {
          name: "lookup_user",
          description: "Look up a user",
          parameters: {
            type: "object",
            properties: { id: { type: "string" } },
          },
        },
      ],
    });
    expect(r.tools?.[0].type).toBe("function");
    expect(r.tools?.[0].function.name).toBe("lookup_user");
    expect(r.tool_choice).toBe("auto");
  });
});

describe("validatePerceptionInput — anti-AI-washing", () => {
  it("ok on valid input", () => {
    expect(
      validatePerceptionInput({
        system: "x",
        parts: [{ kind: "text", text: "hi" }],
      }).ok,
    ).toBe(true);
  });
  it("rejects missing system prompt", () => {
    const r = validatePerceptionInput({
      system: "",
      parts: [{ kind: "text", text: "hi" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("system_prompt_required");
  });
  it("rejects empty parts", () => {
    const r = validatePerceptionInput({ system: "x", parts: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_parts");
  });
  it("rejects unsupported image MIME", () => {
    const r = validatePerceptionInput({
      system: "x",
      parts: [{ kind: "image-base64", mimeType: "image/bmp", base64: "abc" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported_image_mime");
  });
  it("rejects oversized image data URL (amplification defense)", () => {
    const huge = "A".repeat(34 * 1024 * 1024);
    const r = validatePerceptionInput({
      system: "x",
      parts: [{ kind: "image-base64", mimeType: "image/png", base64: huge }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("image_data_url_too_large");
  });
  it("rejects max_tokens out of range", () => {
    const r = validatePerceptionInput({
      system: "x",
      parts: [{ kind: "text", text: "hi" }],
      maxTokens: 99_999,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("max_tokens_out_of_range");
  });
});

describe("parseOmniResponse — outcome shape", () => {
  it("returns text outcome on a basic completion", () => {
    const r = parseOmniResponse({
      choices: [{ message: { role: "assistant", content: "hello" } }],
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome.text).toBe("hello");
      expect(r.outcome.usage?.totalTokens).toBe(13);
    }
  });
  it("rejects malformed body", () => {
    expect(parseOmniResponse(null).ok).toBe(false);
    expect(parseOmniResponse({}).ok).toBe(false);
  });
  it("rejects empty choices", () => {
    const r = parseOmniResponse({ choices: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_choices");
  });
});

describe("composePerceptionMesh — deterministic plan composition", () => {
  it("composes multi-node plan sorted by nodeId", () => {
    const spec = {
      nodes: [
        { nodeId: "z-last", kind: "freeform-synthesizer" },
        { nodeId: "a-first", kind: "audio-transcriber" },
      ],
    };
    const inputs = {
      perNode: {
        "z-last": [{ kind: "text", text: "x" }],
        "a-first": [{ kind: "audio", audioUrl: "u" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].nodeId).toBe("a-first");
    expect(plan.nodePlans[1].nodeId).toBe("z-last");
  });
  it("document-extractor auto-enables JSON response_format", () => {
    const spec = { nodes: [{ nodeId: "doc1", kind: "document-extractor" }] };
    const inputs = {
      perNode: { doc1: [{ kind: "image", imageUrl: "https://x.com/i.png" }] },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].request.response_format).toEqual({
      type: "json_object",
    });
  });
  it("global context is prefixed to every node", () => {
    const spec = {
      nodes: [
        { nodeId: "n1", kind: "audio-transcriber" },
        { nodeId: "n2", kind: "video-monitor" },
      ],
    };
    const inputs = {
      context: "BOARD MEETING",
      perNode: {
        n1: [{ kind: "audio", audioUrl: "u" }],
        n2: [{ kind: "video", videoUrl: "v" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    for (const np of plan.nodePlans) {
      const userContent = np.request.messages[1].content;
      expect(userContent[0].text).toContain("BOARD MEETING");
    }
  });
  it("throws on empty nodes spec", () => {
    expect(() => composePerceptionMesh({ nodes: [] }, { perNode: {} })).toThrow();
  });
  it("throws when node has no inputs", () => {
    expect(() =>
      composePerceptionMesh(
        { nodes: [{ nodeId: "n1", kind: "audio-transcriber" }] },
        { perNode: {} },
      ),
    ).toThrow(/no inputs/);
  });
});

describe("correlateAcrossNodes — cross-modal correlation", () => {
  const outputs = [
    {
      nodeId: "v1",
      kind: "video-monitor",
      text: "the CEO discussed Q3 earnings",
    },
    {
      nodeId: "a1",
      kind: "audio-transcriber",
      text: "let me share the earnings forecast",
    },
  ];

  it("keyword-overlap fires on 2+ nodes (case-insensitive)", () => {
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "earnings-watch",
        kind: "keyword-overlap",
        keywords: ["earnings"],
        severity: "warn",
      },
    ]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["a1", "v1"]);
  });
  it("entity-overlap is case-insensitive", () => {
    const ents = [
      {
        nodeId: "v1",
        kind: "video-monitor",
        text: "...",
        entities: [{ name: "Acme Corp", type: "company" }],
      },
      {
        nodeId: "a1",
        kind: "audio-transcriber",
        text: "...",
        entities: [{ name: "ACME CORP", type: "company" }],
      },
    ];
    const sigs = correlateAcrossNodes(ents, [
      {
        name: "company-watch",
        kind: "entity-overlap",
        entityNames: ["Acme Corp"],
      },
    ]);
    expect(sigs.length).toBe(1);
  });
  it("time-proximity fires within window only", () => {
    const dated = [
      {
        nodeId: "n1",
        kind: "video-monitor",
        text: "x",
        observedAt: "2026-04-29T12:00:00.000Z",
      },
      {
        nodeId: "n2",
        kind: "audio-transcriber",
        text: "y",
        observedAt: "2026-04-29T12:00:30.000Z",
      },
      {
        nodeId: "n3",
        kind: "screenshot-analyzer",
        text: "z",
        observedAt: "2026-04-29T13:00:00.000Z",
      },
    ];
    const sigs = correlateAcrossNodes(dated, [
      { name: "near", kind: "time-proximity", proximitySeconds: 60 },
    ]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["n1", "n2"]);
  });
  it("json-field-match groups identical JSON values", () => {
    const docs = [
      {
        nodeId: "d1",
        kind: "document-extractor",
        text: JSON.stringify({ invoice: { id: "INV-001" } }),
        isJsonOutput: true,
      },
      {
        nodeId: "d2",
        kind: "document-extractor",
        text: JSON.stringify({ invoice: { id: "INV-001" } }),
        isJsonOutput: true,
      },
    ];
    const sigs = correlateAcrossNodes(docs, [
      {
        name: "duplicate-invoice",
        kind: "json-field-match",
        jsonField: "invoice.id",
        severity: "alert",
      },
    ]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].severity).toBe("alert");
  });
  it("severity ordering: alert > warn > info", () => {
    const sigs = correlateAcrossNodes(
      [
        { nodeId: "n1", kind: "video-monitor", text: "alpha bravo" },
        { nodeId: "n2", kind: "audio-transcriber", text: "alpha bravo" },
      ],
      [
        {
          name: "info-rule",
          kind: "keyword-overlap",
          keywords: ["alpha"],
          severity: "info",
        },
        {
          name: "alert-rule",
          kind: "keyword-overlap",
          keywords: ["bravo"],
          severity: "alert",
        },
      ],
    );
    expect(sigs[0].severity).toBe("alert");
  });
});

describe("defaultSystemPromptFor — every task covered", () => {
  for (const t of [
    "video-summarize",
    "audio-transcribe",
    "audio-summarize",
    "image-describe",
    "screenshot-analyze",
    "document-extract",
    "freeform",
  ]) {
    it(`returns non-empty prompt for ${t}`, () => {
      expect(defaultSystemPromptFor(t).length).toBeGreaterThan(20);
    });
  }
});

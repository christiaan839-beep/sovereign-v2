/**
 * R111 — Multimodal Perception Mesh unit tests.
 *
 * Coverage:
 *   - composePerceptionMesh — happy path (1, 2, 3 nodes)
 *   - composePerceptionMesh — deterministic ordering (sort by nodeId)
 *   - composePerceptionMesh — global context prefixed to every node
 *   - composePerceptionMesh — document-extractor auto-enables JSON output
 *   - composePerceptionMesh — refuses spec with 0 nodes / no inputs
 *   - composePerceptionMesh — system prompt addendum + override paths
 *   - correlateAcrossNodes — keyword-overlap fires on 2+ nodes
 *   - correlateAcrossNodes — entity-overlap is case-insensitive
 *   - correlateAcrossNodes — time-proximity respects window
 *   - correlateAcrossNodes — json-field-match groups identical values
 *   - correlateAcrossNodes — severity ordering (alert > warn > info)
 *   - BOARDROOM_WATCH_MESH is a sane default
 */

import { describe, it, expect } from "vitest";
import {
  composePerceptionMesh,
  correlateAcrossNodes,
  BOARDROOM_WATCH_MESH,
  BOARDROOM_COMPLIANCE_RULES,
  type MeshSpec,
  type MeshInputs,
  type MeshNodeOutput,
  type CorrelationRule,
} from "@/lib/perception/mesh";

describe("composePerceptionMesh — happy path", () => {
  it("composes a single-node plan", () => {
    const spec: MeshSpec = {
      nodes: [{ nodeId: "audio1", kind: "audio-transcriber" }],
    };
    const inputs: MeshInputs = {
      perNode: {
        audio1: [{ kind: "audio", audioUrl: "https://x.com/a.mp3" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans.length).toBe(1);
    expect(plan.nodePlans[0].nodeId).toBe("audio1");
    expect(plan.nodePlans[0].kind).toBe("audio-transcriber");
    expect(plan.estimatedMaxTokens).toBe(1024);
  });

  it("composes a multi-node plan with all kinds", () => {
    const spec: MeshSpec = {
      nodes: [
        { nodeId: "v1", kind: "video-monitor" },
        { nodeId: "a1", kind: "audio-transcriber" },
        { nodeId: "s1", kind: "screenshot-analyzer" },
        { nodeId: "d1", kind: "document-extractor" },
        { nodeId: "f1", kind: "freeform-synthesizer" },
      ],
    };
    const inputs: MeshInputs = {
      perNode: {
        v1: [{ kind: "video", videoUrl: "https://x.com/v.mp4" }],
        a1: [{ kind: "audio", audioUrl: "https://x.com/a.mp3" }],
        s1: [{ kind: "image", imageUrl: "https://x.com/s.png" }],
        d1: [{ kind: "image", imageUrl: "https://x.com/d.pdf.png" }],
        f1: [{ kind: "text", text: "What did the speaker say?" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans.length).toBe(5);
    expect(plan.estimatedMaxTokens).toBe(5 * 1024);
  });

  it("plan is deterministic — sort by nodeId", () => {
    const spec: MeshSpec = {
      nodes: [
        { nodeId: "z-last", kind: "freeform-synthesizer" },
        { nodeId: "a-first", kind: "audio-transcriber" },
      ],
    };
    const inputs: MeshInputs = {
      perNode: {
        "z-last": [{ kind: "text", text: "x" }],
        "a-first": [{ kind: "audio", audioUrl: "u" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].nodeId).toBe("a-first");
    expect(plan.nodePlans[1].nodeId).toBe("z-last");
  });
});

describe("composePerceptionMesh — input handling", () => {
  it("global context is prefixed to every node's request", () => {
    const spec: MeshSpec = {
      nodes: [
        { nodeId: "n1", kind: "audio-transcriber" },
        { nodeId: "n2", kind: "video-monitor" },
      ],
    };
    const inputs: MeshInputs = {
      context: "BOARD MEETING — confidential",
      perNode: {
        n1: [{ kind: "audio", audioUrl: "u" }],
        n2: [{ kind: "video", videoUrl: "v" }],
      },
    };
    const plan = composePerceptionMesh(spec, inputs);
    for (const np of plan.nodePlans) {
      const userContent = np.request.messages[1].content;
      expect(Array.isArray(userContent)).toBe(true);
      const firstPart = (userContent as Array<{ type: string; text?: string }>)[0];
      expect(firstPart.type).toBe("text");
      expect(firstPart.text).toContain("BOARD MEETING");
    }
  });

  it("document-extractor auto-enables json response_format", () => {
    const spec: MeshSpec = {
      nodes: [{ nodeId: "doc1", kind: "document-extractor" }],
    };
    const inputs: MeshInputs = {
      perNode: { doc1: [{ kind: "image", imageUrl: "https://x.com/i.png" }] },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].request.response_format).toEqual({
      type: "json_object",
    });
  });

  it("freeform node defaults to text response_format (not JSON)", () => {
    const spec: MeshSpec = {
      nodes: [{ nodeId: "f1", kind: "freeform-synthesizer" }],
    };
    const inputs: MeshInputs = {
      perNode: { f1: [{ kind: "text", text: "hi" }] },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].request.response_format).toBeUndefined();
  });

  it("system prompt addendum appended to default", () => {
    const spec: MeshSpec = {
      nodes: [
        {
          nodeId: "a1",
          kind: "audio-transcriber",
          systemPromptAddendum: "watch for compliance keywords",
        },
      ],
    };
    const inputs: MeshInputs = {
      perNode: { a1: [{ kind: "audio", audioUrl: "u" }] },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].systemPrompt).toContain("Additional instructions");
    expect(plan.nodePlans[0].systemPrompt).toContain("compliance keywords");
  });

  it("system prompt override replaces the default entirely", () => {
    const spec: MeshSpec = {
      nodes: [
        {
          nodeId: "a1",
          kind: "audio-transcriber",
          systemPromptOverride: "ENTIRELY CUSTOM PROMPT",
        },
      ],
    };
    const inputs: MeshInputs = {
      perNode: { a1: [{ kind: "audio", audioUrl: "u" }] },
    };
    const plan = composePerceptionMesh(spec, inputs);
    expect(plan.nodePlans[0].systemPrompt).toBe("ENTIRELY CUSTOM PROMPT");
  });
});

describe("composePerceptionMesh — defensive errors", () => {
  it("throws when spec has no nodes", () => {
    expect(() =>
      composePerceptionMesh({ nodes: [] }, { perNode: {} }),
    ).toThrow();
  });

  it("throws when a node has no inputs", () => {
    expect(() =>
      composePerceptionMesh(
        { nodes: [{ nodeId: "n1", kind: "audio-transcriber" }] },
        { perNode: {} },
      ),
    ).toThrow(/no inputs/);
  });
});

describe("correlateAcrossNodes — keyword-overlap", () => {
  const outputs: MeshNodeOutput[] = [
    {
      nodeId: "video1",
      kind: "video-monitor",
      text: "the CEO discussed Q3 earnings outlook",
    },
    {
      nodeId: "audio1",
      kind: "audio-transcriber",
      text: "let me share the earnings forecast",
    },
    {
      nodeId: "screen1",
      kind: "screenshot-analyzer",
      text: "slide says: Roadmap H2",
    },
  ];

  it("fires when keyword appears in 2+ node texts (case-insensitive)", () => {
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "earnings-watch",
        kind: "keyword-overlap",
        keywords: ["earnings"],
        severity: "warn",
      },
    ]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["audio1", "video1"]);
    expect(sigs[0].severity).toBe("warn");
  });

  it("does NOT fire when only 1 node matches", () => {
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "single-match",
        kind: "keyword-overlap",
        keywords: ["roadmap"],
      },
    ]);
    expect(sigs.length).toBe(0);
  });

  it("emits one signal per matching keyword", () => {
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "multi-match",
        kind: "keyword-overlap",
        keywords: ["earnings", "forecast"],
      },
    ]);
    // "earnings" appears in 2 nodes; "forecast" appears in only audio1 → 0
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedTokens).toEqual(["earnings"]);
  });
});

describe("correlateAcrossNodes — entity-overlap", () => {
  it("matches case-insensitively across nodes' entity lists", () => {
    const outputs: MeshNodeOutput[] = [
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
    const rule: CorrelationRule = {
      name: "company-watch",
      kind: "entity-overlap",
      entityNames: ["Acme Corp"],
    };
    const sigs = correlateAcrossNodes(outputs, [rule]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["a1", "v1"]);
  });
});

describe("correlateAcrossNodes — time-proximity", () => {
  it("fires when 2 nodes' observations are within window", () => {
    const outputs: MeshNodeOutput[] = [
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
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "near-real-time",
        kind: "time-proximity",
        proximitySeconds: 60,
      },
    ]);
    // Only n1+n2 are within 60s. n1+n3 and n2+n3 are well beyond.
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["n1", "n2"]);
  });

  it("ignores nodes without observedAt", () => {
    const outputs: MeshNodeOutput[] = [
      {
        nodeId: "n1",
        kind: "video-monitor",
        text: "x",
        observedAt: "2026-04-29T12:00:00.000Z",
      },
      { nodeId: "n2", kind: "audio-transcriber", text: "y" },
    ];
    const sigs = correlateAcrossNodes(outputs, [
      { name: "rule", kind: "time-proximity", proximitySeconds: 60 },
    ]);
    expect(sigs.length).toBe(0);
  });
});

describe("correlateAcrossNodes — json-field-match", () => {
  it("groups nodes whose JSON output agrees at a given path", () => {
    const outputs: MeshNodeOutput[] = [
      {
        nodeId: "doc1",
        kind: "document-extractor",
        text: JSON.stringify({ invoice: { id: "INV-001" } }),
        isJsonOutput: true,
      },
      {
        nodeId: "doc2",
        kind: "document-extractor",
        text: JSON.stringify({ invoice: { id: "INV-001" } }),
        isJsonOutput: true,
      },
      {
        nodeId: "doc3",
        kind: "document-extractor",
        text: JSON.stringify({ invoice: { id: "INV-002" } }),
        isJsonOutput: true,
      },
    ];
    const sigs = correlateAcrossNodes(outputs, [
      {
        name: "duplicate-invoice",
        kind: "json-field-match",
        jsonField: "invoice.id",
        severity: "alert",
      },
    ]);
    expect(sigs.length).toBe(1);
    expect(sigs[0].matchedNodeIds.sort()).toEqual(["doc1", "doc2"]);
    expect(sigs[0].severity).toBe("alert");
  });

  it("skips nodes whose isJsonOutput is false", () => {
    const outputs: MeshNodeOutput[] = [
      {
        nodeId: "doc1",
        kind: "document-extractor",
        text: '{"id": "X"}',
        isJsonOutput: false,
      },
      {
        nodeId: "doc2",
        kind: "document-extractor",
        text: '{"id": "X"}',
        isJsonOutput: true,
      },
    ];
    const sigs = correlateAcrossNodes(outputs, [
      { name: "rule", kind: "json-field-match", jsonField: "id" },
    ]);
    expect(sigs.length).toBe(0);
  });
});

describe("correlateAcrossNodes — severity ordering", () => {
  const outputs: MeshNodeOutput[] = [
    { nodeId: "n1", kind: "video-monitor", text: "alpha bravo" },
    { nodeId: "n2", kind: "audio-transcriber", text: "alpha bravo" },
  ];
  const rules: CorrelationRule[] = [
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
    {
      name: "warn-rule",
      kind: "keyword-overlap",
      keywords: ["alpha"],
      severity: "warn",
    },
  ];

  it("alert > warn > info", () => {
    const sigs = correlateAcrossNodes(outputs, rules);
    expect(sigs[0].severity).toBe("alert");
    expect(sigs[sigs.length - 1].severity).toBe("info");
  });
});

describe("BOARDROOM_WATCH_MESH — pre-built sane default", () => {
  it("has 3 nodes covering video + audio + screenshot", () => {
    expect(BOARDROOM_WATCH_MESH.nodes.length).toBe(3);
    const kinds = BOARDROOM_WATCH_MESH.nodes.map((n) => n.kind);
    expect(kinds).toContain("video-monitor");
    expect(kinds).toContain("audio-transcriber");
    expect(kinds).toContain("screenshot-analyzer");
  });

  it("includes earnings-leak compliance rule", () => {
    expect(
      BOARDROOM_COMPLIANCE_RULES.some(
        (r) => r.name === "earnings-leak-watch",
      ),
    ).toBe(true);
  });
});

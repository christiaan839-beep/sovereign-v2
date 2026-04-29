/**
 * R110 — Nemotron Omni Client unit tests.
 *
 * Coverage:
 *   - partToWire — every kind round-trips to the right wire shape
 *   - buildOmniMessages assembles system + user with content array
 *   - buildOmniRequest — maxTokens / temperature defaults
 *   - buildOmniRequest — tools serialization + tool_choice=auto
 *   - buildOmniRequest — response_format=json when requested
 *   - getOmniModelSlug respects env override
 *   - validatePerceptionInput catches every malformed shape
 *   - parseOmniResponse returns outcome with text + tool calls + JSON detection
 *   - parseOmniResponse refuses malformed bodies with typed reason
 *   - defaultSystemPromptFor returns prompts for every PerceptionTask
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  partToWire,
  buildOmniMessages,
  buildOmniRequest,
  getOmniModelSlug,
  validatePerceptionInput,
  parseOmniResponse,
  defaultSystemPromptFor,
  type PerceptionInputPart,
  type PerceptionRequestInput,
  type PerceptionTask,
} from "@/lib/perception/nemotron-omni-client";

describe("partToWire — every modality maps to OpenAI-compatible shape", () => {
  it("text → type:text", () => {
    expect(partToWire({ kind: "text", text: "hello" })).toEqual({
      type: "text",
      text: "hello",
    });
  });
  it("image with URL → image_url with detail=auto by default", () => {
    expect(
      partToWire({ kind: "image", imageUrl: "https://x.com/a.png" }),
    ).toEqual({
      type: "image_url",
      image_url: { url: "https://x.com/a.png", detail: "auto" },
    });
  });
  it("image with explicit detail=high preserved", () => {
    expect(
      partToWire({
        kind: "image",
        imageUrl: "https://x.com/a.png",
        detail: "high",
      }),
    ).toEqual({
      type: "image_url",
      image_url: { url: "https://x.com/a.png", detail: "high" },
    });
  });
  it("image-base64 → data:URL", () => {
    expect(
      partToWire({
        kind: "image-base64",
        mimeType: "image/png",
        base64: "iVBORw0KG",
      }),
    ).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,iVBORw0KG" },
    });
  });
  it("audio with URL → audio_url", () => {
    expect(
      partToWire({ kind: "audio", audioUrl: "https://x.com/a.mp3" }),
    ).toEqual({
      type: "audio_url",
      audio_url: { url: "https://x.com/a.mp3" },
    });
  });
  it("audio-base64 → data:URL", () => {
    expect(
      partToWire({
        kind: "audio-base64",
        mimeType: "audio/wav",
        base64: "UklGRg",
      }),
    ).toEqual({
      type: "audio_url",
      audio_url: { url: "data:audio/wav;base64,UklGRg" },
    });
  });
  it("video → video_url", () => {
    expect(
      partToWire({ kind: "video", videoUrl: "https://x.com/v.mp4" }),
    ).toEqual({
      type: "video_url",
      video_url: { url: "https://x.com/v.mp4" },
    });
  });
});

describe("buildOmniMessages — system + user shape", () => {
  it("system goes first as a string content", () => {
    const msgs = buildOmniMessages({
      system: "you are an agent",
      parts: [{ kind: "text", text: "hi" }],
    });
    expect(msgs[0]).toEqual({ role: "system", content: "you are an agent" });
  });
  it("user content is an array of parts", () => {
    const msgs = buildOmniMessages({
      system: "x",
      parts: [
        { kind: "text", text: "summarise" },
        { kind: "video", videoUrl: "https://example.com/v.mp4" },
      ],
    });
    expect(msgs[1].role).toBe("user");
    expect(Array.isArray(msgs[1].content)).toBe(true);
    expect((msgs[1].content as unknown[]).length).toBe(2);
  });
});

describe("buildOmniRequest — defaults and customization", () => {
  const baseInput: PerceptionRequestInput = {
    system: "test",
    parts: [{ kind: "text", text: "hi" }],
  };

  it("temperature defaults to 0.2", () => {
    expect(buildOmniRequest(baseInput).temperature).toBe(0.2);
  });
  it("max_tokens defaults to 1024", () => {
    expect(buildOmniRequest(baseInput).max_tokens).toBe(1024);
  });
  it("temperature override propagates", () => {
    expect(
      buildOmniRequest({ ...baseInput, temperature: 0 }).temperature,
    ).toBe(0);
  });
  it("tools serialize into OpenAI function format", () => {
    const req = buildOmniRequest({
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
    expect(req.tools).toBeDefined();
    expect(req.tools?.[0]).toMatchObject({
      type: "function",
      function: {
        name: "lookup_user",
        description: "Look up a user",
      },
    });
    expect(req.tool_choice).toBe("auto");
  });
  it("response_format=json when requested", () => {
    const req = buildOmniRequest({ ...baseInput, responseFormat: "json" });
    expect(req.response_format).toEqual({ type: "json_object" });
  });
  it("response_format omitted by default", () => {
    expect(buildOmniRequest(baseInput).response_format).toBeUndefined();
  });
  it("model slug comes from getOmniModelSlug()", () => {
    expect(buildOmniRequest(baseInput).model).toBe(getOmniModelSlug());
  });
});

describe("getOmniModelSlug — env override + default", () => {
  const originalEnv = process.env.NEMOTRON_OMNI_MODEL_SLUG;

  beforeEach(() => {
    delete process.env.NEMOTRON_OMNI_MODEL_SLUG;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEMOTRON_OMNI_MODEL_SLUG;
    else process.env.NEMOTRON_OMNI_MODEL_SLUG = originalEnv;
  });

  it("defaults to NVIDIA's published Nemotron Omni slug", () => {
    expect(getOmniModelSlug()).toBe("nvidia/nemotron-3-nano-omni-30b-a3b");
  });
  it("respects env override (customer points at custom NIM endpoint)", () => {
    process.env.NEMOTRON_OMNI_MODEL_SLUG = "myorg/custom-omni-v1";
    expect(getOmniModelSlug()).toBe("myorg/custom-omni-v1");
  });
});

describe("validatePerceptionInput — defensive validation", () => {
  const okInput: PerceptionRequestInput = {
    system: "be useful",
    parts: [{ kind: "text", text: "hi" }],
  };

  it("accepts a valid input", () => {
    expect(validatePerceptionInput(okInput).ok).toBe(true);
  });

  it("rejects missing system prompt", () => {
    const v = validatePerceptionInput({ ...okInput, system: "" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("system_prompt_required");
  });

  it("rejects no parts", () => {
    const v = validatePerceptionInput({ ...okInput, parts: [] });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("no_parts");
  });

  it("rejects unsupported image MIME", () => {
    const v = validatePerceptionInput({
      system: "x",
      parts: [
        {
          kind: "image-base64",
          mimeType: "image/bmp",
          base64: "abc",
        } as PerceptionInputPart,
      ],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("unsupported_image_mime");
  });

  it("rejects unsupported audio MIME", () => {
    const v = validatePerceptionInput({
      system: "x",
      parts: [
        {
          kind: "audio-base64",
          mimeType: "audio/aiff",
          base64: "abc",
        } as PerceptionInputPart,
      ],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("unsupported_audio_mime");
  });

  it("rejects oversized image data URL (defends against memory amplification)", () => {
    // Force base64 size > 25 MB bytes-equivalent.
    const huge = "A".repeat(34 * 1024 * 1024);
    const v = validatePerceptionInput({
      system: "x",
      parts: [{ kind: "image-base64", mimeType: "image/png", base64: huge }],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("image_data_url_too_large");
  });

  it("rejects max_tokens out of range", () => {
    const v = validatePerceptionInput({ ...okInput, maxTokens: 0 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("max_tokens_out_of_range");
    const v2 = validatePerceptionInput({ ...okInput, maxTokens: 99_999 });
    expect(v2.ok).toBe(false);
    if (!v2.ok) expect(v2.reason).toBe("max_tokens_out_of_range");
  });
});

describe("parseOmniResponse — outcome shape", () => {
  it("returns text outcome on a basic completion", () => {
    const r = parseOmniResponse({
      choices: [
        {
          message: { role: "assistant", content: "the speaker discussed AI" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome.text).toBe("the speaker discussed AI");
      expect(r.outcome.usage?.totalTokens).toBe(13);
      expect(r.outcome.toolCalls).toEqual([]);
      expect(r.outcome.isJsonOutput).toBe(false);
    }
  });

  it("parses tool calls with JSON arguments", () => {
    const r = parseOmniResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tc_1",
                type: "function",
                function: {
                  name: "lookup_user",
                  arguments: JSON.stringify({ id: "u_42" }),
                },
              },
            ],
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome.toolCalls.length).toBe(1);
      expect(r.outcome.toolCalls[0].name).toBe("lookup_user");
      expect(r.outcome.toolCalls[0].arguments).toEqual({ id: "u_42" });
    }
  });

  it("returns empty args when tool_call args are malformed JSON (defensive)", () => {
    const r = parseOmniResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tc_2",
                type: "function",
                function: { name: "x", arguments: "{not json" },
              },
            ],
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome.toolCalls[0].arguments).toEqual({});
    }
  });

  it("detects JSON output when content parses as JSON", () => {
    const r = parseOmniResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({ topic: "AI", confidence: 0.9 }),
          },
        },
      ],
    });
    if (r.ok) expect(r.outcome.isJsonOutput).toBe(true);
  });

  it("rejects malformed body with typed reason", () => {
    expect(parseOmniResponse(null).ok).toBe(false);
    expect(parseOmniResponse({}).ok).toBe(false);
    const empty = parseOmniResponse({ choices: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe("no_choices");
  });

  it("rejects choice without message", () => {
    const r = parseOmniResponse({
      choices: [{ finish_reason: "stop" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_message");
  });
});

describe("defaultSystemPromptFor — every PerceptionTask covered", () => {
  const tasks: PerceptionTask[] = [
    "video-summarize",
    "audio-transcribe",
    "audio-summarize",
    "image-describe",
    "screenshot-analyze",
    "document-extract",
    "freeform",
  ];

  for (const t of tasks) {
    it(`returns a non-empty prompt for ${t}`, () => {
      const p = defaultSystemPromptFor(t);
      expect(p.length).toBeGreaterThan(20);
    });
  }

  it("document-extract prompt instructs JSON output", () => {
    expect(defaultSystemPromptFor("document-extract")).toContain("JSON");
  });

  it("screenshot-analyze prompt is computer-use ready", () => {
    expect(defaultSystemPromptFor("screenshot-analyze")).toContain(
      "screenshot",
    );
  });
});

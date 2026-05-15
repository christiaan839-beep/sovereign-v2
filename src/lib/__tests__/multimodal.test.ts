/**
 * Tests for src/lib/multimodal.ts — Cook 40 input normalization.
 *
 * Contracts under test:
 *
 *   - ALLOWED_MIME gating: only listed types pass.
 *   - SIZE_LIMITS enforced per modality.
 *   - MAX_PARTS caps the total number of parts.
 *   - Empty inputs / empty payloads / empty-after-sanitize are rejected.
 *   - Text parts are sanitized (zero-width + control chars stripped).
 *   - Stable citation ids (`part-1`, `part-2`, …).
 *   - Manifest renderer is deterministic.
 */

import { describe, it, expect } from "vitest";
import {
  normalize,
  sanitizeText,
  renderInputManifest,
  ALLOWED_MIME,
  SIZE_LIMITS,
  MAX_PARTS,
  type RawPart,
} from "../multimodal";

const bytes = (n: number) => new Uint8Array(n).fill(1);

describe("sanitizeText", () => {
  it("strips zero-width chars + control bytes", () => {
    // ​ = zero-width space;   NBSP intentionally PRESERVED
    // (it's printable).  BEL is stripped.
    const raw = "hello​ world";
    expect(sanitizeText(raw)).toBe("hello world");
  });

  it("preserves newlines and tabs", () => {
    expect(sanitizeText("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeText("   hi   ")).toBe("hi");
  });

  it("returns empty string for all-control input", () => {
    expect(sanitizeText("​‌‍")).toBe("");
  });
});

describe("normalize — happy path", () => {
  it("accepts an image, returns a typed part with stable id", () => {
    const result = normalize([
      { mime: "image/png", payload: bytes(100), filename: "shot.png" },
    ]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].modality).toBe("image");
      expect(result.parts[0].id).toBe("part-1");
      expect(result.parts[0].size).toBe(100);
    }
  });

  it("accepts a PDF, audio, and text in one call", () => {
    const result = normalize([
      { mime: "image/png", payload: bytes(100) },
      { mime: "application/pdf", payload: bytes(500) },
      { mime: "audio/mp4", payload: bytes(1000) },
      { mime: "text/plain", payload: "summarize this" },
    ]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.parts.map((p) => p.modality)).toEqual([
        "image",
        "pdf",
        "audio",
        "text",
      ]);
      expect(result.parts.map((p) => p.id)).toEqual([
        "part-1",
        "part-2",
        "part-3",
        "part-4",
      ]);
    }
  });

  it("normalizes MIME by stripping charset params + lower-casing", () => {
    const result = normalize([
      { mime: "Image/PNG; charset=binary", payload: bytes(10) },
    ]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.parts[0].mime).toBe("image/png");
    }
  });

  it("sanitizes text payloads before assigning size", () => {
    const result = normalize([{ mime: "text/plain", payload: "hi​ there" }]);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.parts[0].payload).toBe("hi there");
    }
  });
});

describe("normalize — rejection paths", () => {
  it("rejects an empty input list", () => {
    const result = normalize([]);
    expect(result.kind).toBe("rejected");
  });

  it("rejects too many parts", () => {
    const tooMany: RawPart[] = Array(MAX_PARTS + 1).fill({
      mime: "text/plain",
      payload: "hi",
    });
    const result = normalize(tooMany);
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reasons[0]).toMatch(/Too many parts/);
    }
  });

  it("rejects an unsupported MIME with a structured reason", () => {
    const result = normalize([
      { mime: "application/x-shockwave-flash", payload: bytes(10) },
    ]);
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reasons[0]).toMatch(/unsupported MIME/);
    }
  });

  it("rejects oversize parts per their modality cap", () => {
    const result = normalize([
      { mime: "image/png", payload: bytes(SIZE_LIMITS.image + 1) },
    ]);
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reasons[0]).toMatch(/image too large/);
    }
  });

  it("rejects empty payloads (zero-byte uploads)", () => {
    const result = normalize([{ mime: "image/png", payload: bytes(0) }]);
    expect(result.kind).toBe("rejected");
  });

  it("rejects text that becomes empty after sanitization", () => {
    const result = normalize([{ mime: "text/plain", payload: "​‌‍" }]);
    expect(result.kind).toBe("rejected");
  });

  it("collects MULTIPLE reasons when several parts fail", () => {
    const result = normalize([
      { mime: "image/png", payload: bytes(10) }, // ok
      { mime: "image/bmp", payload: bytes(10) }, // unsupported
      { mime: "audio/mp4", payload: bytes(SIZE_LIMITS.audio + 1) }, // oversize
    ]);
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reasons.length).toBe(2);
    }
  });
});

describe("renderInputManifest", () => {
  it("emits one line per part with id + mime + size", () => {
    const result = normalize([
      { mime: "image/png", payload: bytes(2000), filename: "shot.png" },
      { mime: "text/plain", payload: "hi there" },
    ]);
    if (result.kind !== "ok") throw new Error("expected ok");
    const manifest = renderInputManifest(result.parts);
    expect(manifest).toContain("─── INPUT ───");
    expect(manifest).toContain("[part-1]");
    expect(manifest).toContain("image/png");
    expect(manifest).toContain("shot.png");
    expect(manifest).toContain("[part-2]");
    expect(manifest).toContain("text/plain");
    expect(manifest).toContain("hi there");
  });

  it("renders a placeholder for empty parts", () => {
    expect(renderInputManifest([])).toContain("(no parts)");
  });

  it("clamps the text preview to 200 chars + ellipsis", () => {
    const long = "x".repeat(500);
    const result = normalize([{ mime: "text/plain", payload: long }]);
    if (result.kind !== "ok") throw new Error("expected ok");
    const manifest = renderInputManifest(result.parts);
    expect(manifest).toContain("xxx…");
  });
});

describe("ALLOWED_MIME registry", () => {
  it("covers the four core modalities", () => {
    const modalities = new Set(ALLOWED_MIME.values());
    expect(modalities.has("image")).toBe(true);
    expect(modalities.has("pdf")).toBe(true);
    expect(modalities.has("audio")).toBe(true);
    expect(modalities.has("text")).toBe(true);
  });
});

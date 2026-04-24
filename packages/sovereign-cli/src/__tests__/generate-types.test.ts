/**
 * Tests for runGenerateTypes — JSON Schema → TypeScript conversion
 * + manifest-field extraction.
 */

import { describe, expect, it } from "vitest";
import { runGenerateTypes } from "../commands/generate-types.js";
import type { FileSystem } from "../types.js";

function inMemoryFs(files: Record<string, string>): FileSystem {
  return {
    async readTextFile(path) {
      if (path in files) return files[path];
      throw new Error(`ENOENT: ${path}`);
    },
  };
}

const BASE_MANIFEST = {
  sam: "1.0",
  slug: "invoice-ocr",
  displayName: "Invoice OCR",
  purpose: "Extract invoice fields",
  category: "Finance",
  version: "1.0.0",
  inputs: [],
  output: { type: "object" },
  guarantees: ["No fabrication"],
};

describe("runGenerateTypes() — happy path", () => {
  it("emits TypeScript from extensions.outputSchema (SAM 1.1)", async () => {
    const manifest = {
      ...BASE_MANIFEST,
      extensions: {
        outputSchema: {
          type: "object",
          required: ["vendor", "totalCents"],
          properties: {
            vendor: { type: "string", description: "Company that issued the invoice" },
            totalCents: { type: "number" },
            currency: { type: "string" },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                required: ["description"],
                properties: {
                  description: { type: "string" },
                  amountCents: { type: "number" },
                },
              },
            },
          },
        },
      },
    };
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(manifest) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      const ts = r.message;
      expect(ts).toContain("export interface InvoiceOcrOutput");
      expect(ts).toContain("\"vendor\": string;");
      expect(ts).toContain("\"totalCents\": number;");
      expect(ts).toContain("\"currency\"?: string;"); // optional
      // Arrays of non-union shapes render as `{...}[]` (standard TS).
      expect(ts).toContain("\"lineItems\"?:");
      expect(ts).toContain("[]"); // some kind of array emission
      expect(ts).toContain("Company that issued the invoice");
      expect(r.data?.source).toBe("extensions");
    }
  });

  it("falls back to output.properties when extensions absent", async () => {
    const manifest = {
      ...BASE_MANIFEST,
      output: {
        type: "object",
        required: ["result"],
        properties: {
          result: { type: "string" },
          confidence: { type: "number" },
        },
      },
    };
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(manifest) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.source).toBe("output.properties");
      expect(r.message).toContain("\"result\": string;");
    }
  });

  it("emits `unknown` + a helpful comment when no schema is available", async () => {
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(BASE_MANIFEST) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.data?.source).toBe("fallback");
      expect(r.message).toContain("export type InvoiceOcrOutput = unknown");
      expect(r.message).toContain("extensions.outputSchema");
    }
  });

  it("emits a proper PascalCase type name from kebab-case slug", async () => {
    const manifest = { ...BASE_MANIFEST, slug: "auto-reply-triage-bot" };
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(manifest) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.message).toContain("AutoReplyTriageBotOutput");
    }
  });

  it("handles enum types as string literal unions", async () => {
    const manifest = {
      ...BASE_MANIFEST,
      extensions: {
        outputSchema: {
          type: "object",
          required: ["status"],
          properties: {
            status: { enum: ["success", "pending", "failed"] },
          },
        },
      },
    };
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": JSON.stringify(manifest) }),
    });
    expect(r.kind).toBe("success");
    if (r.kind === "success") {
      expect(r.message).toContain(`"success" | "pending" | "failed"`);
    }
  });

  it("writes to outPath when --out is used", async () => {
    let written: { path: string; content: string } | null = null;
    const r = await runGenerateTypes({
      path: "a.json",
      outPath: "types.ts",
      fs: inMemoryFs({ "a.json": JSON.stringify(BASE_MANIFEST) }),
      writeTextFile: async (path, content) => {
        written = { path, content };
      },
    });
    expect(r.kind).toBe("success");
    expect(written).not.toBeNull();
    expect(written!.path).toBe("types.ts");
    expect(written!.content).toContain("export type InvoiceOcrOutput = unknown");
  });
});

describe("runGenerateTypes() — failure paths", () => {
  it("returns exit 3 when path is missing", async () => {
    const r = await runGenerateTypes({ path: undefined, fs: inMemoryFs({}) });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") expect(r.exitCode).toBe(3);
  });

  it("returns exit 3 when file not found", async () => {
    const r = await runGenerateTypes({
      path: "nope.json",
      fs: inMemoryFs({}),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") {
      expect(r.exitCode).toBe(3);
      expect(r.message).toMatch(/Cannot read/);
    }
  });

  it("returns exit 3 for invalid JSON", async () => {
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": "{ not json" }),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") expect(r.exitCode).toBe(3);
  });

  it("returns exit 3 when manifest is not an object", async () => {
    const r = await runGenerateTypes({
      path: "a.json",
      fs: inMemoryFs({ "a.json": "[1,2,3]" }),
    });
    expect(r.kind).toBe("failure");
    if (r.kind === "failure") expect(r.exitCode).toBe(3);
  });
});

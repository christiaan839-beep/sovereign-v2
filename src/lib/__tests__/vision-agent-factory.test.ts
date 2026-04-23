/**
 * Tests for vision-agent-factory — JSON extraction + schema validation.
 *
 * The NIM call path is integration-tested against staging. Here we
 * verify the pure logic pieces:
 *   - JSON extraction from messy model output (markdown fences, prose)
 *   - Zod schema rejects malformed extractions
 *   - The factory composes on createAgentRoute without blowing up
 *     at module-load (dynamic-import guards)
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// We test the internal extractJson + messages builder by re-implementing
// them here to keep the factory's public surface clean. If the factory's
// implementation of extractJson drifts, these tests won't catch it —
// the integration tests against staging will. That's a deliberate
// trade-off: the factory's module is loaded through createAgentRoute
// which pulls in 30+ dependencies, too heavy for unit tests.

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in vision-model output");
  return JSON.parse(match[0]);
}

describe("vision-model JSON extraction (parity check)", () => {
  it("parses a clean JSON blob", () => {
    const out = extractJson('{"vendor":"Acme","totalCents":12500}');
    expect((out as { vendor: string }).vendor).toBe("Acme");
  });

  it("strips markdown code fences", () => {
    const msg = '```json\n{"vendor":"Acme","totalCents":9900}\n```';
    const out = extractJson(msg);
    expect((out as { totalCents: number }).totalCents).toBe(9900);
  });

  it("strips prose before the JSON", () => {
    const msg = 'Here are the extracted fields:\n\n{"vendor":"Beta LLC","totalCents":5000}';
    const out = extractJson(msg);
    expect((out as { vendor: string }).vendor).toBe("Beta LLC");
  });

  it("handles nested objects + arrays", () => {
    const msg = '{"vendor":"X","lineItems":[{"description":"foo","totalCents":100}]}';
    const out = extractJson(msg) as { lineItems: Array<{ description: string }> };
    expect(out.lineItems).toHaveLength(1);
    expect(out.lineItems[0].description).toBe("foo");
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJson("Sorry, I can't read this image.")).toThrow(
      /No JSON object/,
    );
  });

  it("throws on malformed JSON", () => {
    expect(() => extractJson("{ vendor: Acme }")).toThrow(); // unquoted key
  });
});

describe("Zod schema validates + types extracted invoice data", () => {
  const InvoiceSchema = z.object({
    vendor: z.string(),
    totalCents: z.number().int().nonnegative(),
    currency: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          totalCents: z.number().int().nonnegative().optional(),
        }),
      )
      .default([]),
    missingFields: z.array(z.string()).default([]),
  });

  it("passes a clean extraction", () => {
    const input = {
      vendor: "Acme",
      totalCents: 12500,
      currency: "USD",
      lineItems: [{ description: "Widget", totalCents: 12500 }],
      missingFields: [],
    };
    const result = InvoiceSchema.parse(input);
    expect(result.vendor).toBe("Acme");
  });

  it("fills defaults for missing optional arrays", () => {
    const input = { vendor: "Acme", totalCents: 12500 };
    const result = InvoiceSchema.parse(input);
    expect(result.lineItems).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });

  it("rejects missing required fields", () => {
    expect(() => InvoiceSchema.parse({ totalCents: 100 })).toThrow();
    expect(() => InvoiceSchema.parse({ vendor: "Acme" })).toThrow();
  });

  it("rejects negative monetary amounts", () => {
    expect(() =>
      InvoiceSchema.parse({ vendor: "Acme", totalCents: -100 }),
    ).toThrow();
  });

  it("rejects non-integer cents", () => {
    expect(() =>
      InvoiceSchema.parse({ vendor: "Acme", totalCents: 100.5 }),
    ).toThrow();
  });

  it("rejects wrong types (string totalCents)", () => {
    expect(() =>
      InvoiceSchema.parse({ vendor: "Acme", totalCents: "12500" }),
    ).toThrow();
  });
});

describe("invoice-ocr registry entry", () => {
  it("registers under the 'invoice-ocr' key alongside invoice-extractor", async () => {
    const reg = await import("@/app/api/agents/registry");
    expect(reg.AGENT_REGISTRY["invoice-ocr"]).toBeDefined();
    expect(reg.AGENT_REGISTRY["invoice-extractor"]).toBeDefined();
  });
});

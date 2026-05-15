/**
 * Tests for src/lib/prompt-templates.ts — Cook 110.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  deleteTemplate,
  extractPlaceholders,
  getTemplate,
  putTemplate,
  renderTemplate,
  type TenantTemplate,
} from "../prompt-templates";

function base(): TenantTemplate {
  return {
    id: "tpl-1",
    tenantId: "t-1",
    agentSlug: "lead-blitz",
    body: "You are an agent for ${brand}. Tone: ${tone}.",
    requires: ["brand", "tone"],
    updatedAt: Date.now(),
  };
}

beforeEach(() => {
  _resetForTests();
});

describe("extractPlaceholders", () => {
  it("returns deduped placeholder names", () => {
    expect(extractPlaceholders("Hi ${name}, welcome ${name}!")).toEqual([
      "name",
    ]);
  });

  it("returns [] when no placeholders", () => {
    expect(extractPlaceholders("plain text")).toEqual([]);
  });

  it("ignores invalid placeholder forms", () => {
    expect(extractPlaceholders("${nested.path} or ${with brackets}")).toEqual(
      [],
    );
  });
});

describe("putTemplate", () => {
  it("stores valid templates", () => {
    putTemplate(base());
    expect(getTemplate("t-1", "lead-blitz")?.id).toBe("tpl-1");
  });

  it("rejects missing tenantId / agentSlug", () => {
    expect(() => putTemplate({ ...base(), tenantId: "" })).toThrow();
    expect(() => putTemplate({ ...base(), agentSlug: "" })).toThrow();
  });

  it("rejects oversize bodies", () => {
    expect(() =>
      putTemplate({ ...base(), body: "x".repeat(50000), requires: [] }),
    ).toThrow();
  });

  it("rejects requires[] containing names not in the body", () => {
    expect(() =>
      putTemplate({ ...base(), requires: ["brand", "tone", "ghost"] }),
    ).toThrow();
  });
});

describe("renderTemplate", () => {
  it("substitutes ${name} placeholders", () => {
    const tpl = base();
    putTemplate(tpl);
    const r = renderTemplate({
      template: tpl,
      variables: { brand: "Acme", tone: "calm" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rendered).toBe("You are an agent for Acme. Tone: calm.");
      expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("returns missing-variable when required var is absent", () => {
    const tpl = base();
    const r = renderTemplate({
      template: tpl,
      variables: { brand: "Acme" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("missing-variable");
      expect(r.missing).toEqual(["tone"]);
    }
  });

  it("hash is deterministic for the same inputs", () => {
    const tpl = base();
    const a = renderTemplate({
      template: tpl,
      variables: { brand: "Acme", tone: "calm" },
    });
    const b = renderTemplate({
      template: tpl,
      variables: { brand: "Acme", tone: "calm" },
    });
    if (a.ok && b.ok) expect(a.hash).toBe(b.hash);
  });

  it("never evaluates code in variable values", () => {
    const tpl = base();
    const r = renderTemplate({
      template: tpl,
      variables: { brand: "${admin}", tone: "calm" },
    });
    // ${admin} should appear LITERAL in the output — no recursive eval.
    if (r.ok) {
      expect(r.rendered).toBe("You are an agent for ${admin}. Tone: calm.");
    }
  });
});

describe("deleteTemplate", () => {
  it("returns true on success, false on missing", () => {
    putTemplate(base());
    expect(deleteTemplate("t-1", "lead-blitz")).toBe(true);
    expect(deleteTemplate("t-1", "lead-blitz")).toBe(false);
  });
});

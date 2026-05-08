/**
 * Tests for src/lib/playbooks.ts — Playbook Engine
 *
 * Covers PLAYBOOKS array validation, resolvePlaybookSteps() template resolution,
 * getPlaybook() lookup, getPlaybooksByCategory() filtering, and PLAYBOOK_CATEGORIES
 * representation.
 */
import { describe, it, expect } from "vitest";

import {
  PLAYBOOKS,
  PLAYBOOK_CATEGORIES,
  resolvePlaybookSteps,
  getPlaybook,
  getPlaybooksByCategory,
} from "@/lib/playbooks";
import type { Playbook } from "@/lib/playbooks";

// Known agents that exist in the platform
const KNOWN_AGENTS = [
  "leads",
  "email-sequence",
  "site-assassin",
  "seo-dominator",
  "smart-router",
  "blog-gen",
  "case-study",
  "proposal-generator",
  "brand-voice",
  "funnel-xray",
  "competitor-scan",
  "omni-search",
  "client-report",
  "contract-analyzer",
  "ad-report",
  "agency-packet",
];

// ── PLAYBOOKS Array Validation ──

describe("PLAYBOOKS array validation", () => {
  it("contains at least one playbook", () => {
    expect(PLAYBOOKS.length).toBeGreaterThan(0);
  });

  it("all playbooks have unique IDs", () => {
    const ids = PLAYBOOKS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe.each(PLAYBOOKS.map((p) => [p.id, p] as const))(
    "playbook '%s'",
    (_id, playbook) => {
      it("has all required fields", () => {
        expect(playbook.id).toBeTruthy();
        expect(typeof playbook.id).toBe("string");

        expect(playbook.name).toBeTruthy();
        expect(typeof playbook.name).toBe("string");

        expect(playbook.tagline).toBeTruthy();
        expect(typeof playbook.tagline).toBe("string");

        expect(playbook.description).toBeTruthy();
        expect(typeof playbook.description).toBe("string");

        expect(playbook.icon).toBeTruthy();
        expect(typeof playbook.icon).toBe("string");

        expect(playbook.color).toBeTruthy();
        expect(typeof playbook.color).toBe("string");

        expect(["growth", "content", "intelligence", "operations"]).toContain(
          playbook.category,
        );

        expect(Array.isArray(playbook.fields)).toBe(true);
        expect(playbook.fields.length).toBeGreaterThan(0);

        expect(Array.isArray(playbook.steps)).toBe(true);
        expect(playbook.steps.length).toBeGreaterThan(0);

        expect(playbook.estimatedTime).toBeTruthy();
        expect(typeof playbook.estimatedTime).toBe("string");

        expect(typeof playbook.agentCount).toBe("number");
        expect(playbook.agentCount).toBeGreaterThan(0);
      });

      it("agentCount matches steps.length", () => {
        expect(playbook.agentCount).toBe(playbook.steps.length);
      });

      it("all step agents are valid known agents", () => {
        for (const step of playbook.steps) {
          expect(KNOWN_AGENTS).toContain(step.agent);
        }
      });

      it("all steps have a reason", () => {
        for (const step of playbook.steps) {
          expect(step.reason).toBeTruthy();
          expect(typeof step.reason).toBe("string");
        }
      });

      it("all steps have params", () => {
        for (const step of playbook.steps) {
          expect(step.params).toBeDefined();
          expect(typeof step.params).toBe("object");
        }
      });

      it("all fields have required properties", () => {
        for (const field of playbook.fields) {
          expect(field.key).toBeTruthy();
          expect(field.label).toBeTruthy();
          expect(["text", "url", "select", "textarea"]).toContain(field.type);
          expect(typeof field.placeholder).toBe("string");
          expect(typeof field.required).toBe("boolean");
        }
      });

      it("select fields have options defined", () => {
        for (const field of playbook.fields) {
          if (field.type === "select") {
            expect(Array.isArray(field.options)).toBe(true);
            expect(field.options!.length).toBeGreaterThan(0);
          }
        }
      });
    },
  );
});

// ── resolvePlaybookSteps() ──

describe("resolvePlaybookSteps", () => {
  it("replaces {{field}} placeholders with user input", () => {
    const playbook = getPlaybook("lead-blitz")!;
    const steps = resolvePlaybookSteps(playbook, {
      niche: "SaaS companies",
      location: "Texas",
      product: "AI-powered CRM",
    });

    expect(steps[0].params.niche).toBe("SaaS companies");
    expect(steps[0].params.location).toBe("Texas");
    expect(steps[1].params.product).toBe("AI-powered CRM");
    expect(steps[1].params.audience).toBe("SaaS companies in Texas");
  });

  it("handles missing optional fields by replacing with empty string", () => {
    const playbook = getPlaybook("competitor-takedown")!;
    const steps = resolvePlaybookSteps(playbook, {
      url: "competitor.com",
      // your_url is optional and omitted
    });

    expect(steps[0].params.url).toBe("competitor.com");
  });

  it("replaces keys with empty string when provided as empty", () => {
    const playbook = getPlaybook("content-machine")!;
    const steps = resolvePlaybookSteps(playbook, {
      topic: "AI lead generation",
      tone: "Professional",
      keywords: "",
    });

    expect(steps[0].params.topic).toBe("AI lead generation");
    expect(steps[0].params.tone).toBe("Professional");
    expect(steps[0].params.keywords).toBe("");
  });

  it("leaves placeholders intact when keys are absent from userInput", () => {
    const playbook = getPlaybook("content-machine")!;
    const steps = resolvePlaybookSteps(playbook, {
      topic: "AI lead generation",
      tone: "Professional",
      // keywords not provided at all
    });

    expect(steps[0].params.topic).toBe("AI lead generation");
    expect(steps[0].params.tone).toBe("Professional");
    expect(steps[0].params.keywords).toBe("{{keywords}}");
  });

  it("preserves {{step_N}} templates (resolved at execution time)", () => {
    const playbook = getPlaybook("lead-blitz")!;
    const steps = resolvePlaybookSteps(playbook, {
      niche: "SaaS companies",
      location: "Texas",
      product: "AI-powered CRM",
    });

    // step_1 template should remain unresolved
    expect(steps[1].params.context).toBe("{{step_1}}");
  });

  it("preserves {{step_N}} in multi-step playbooks", () => {
    const playbook = getPlaybook("competitor-takedown")!;
    const steps = resolvePlaybookSteps(playbook, {
      url: "competitor.com",
      your_url: "mysite.com",
    });

    // Step 2 references step_1
    expect(steps[1].params.context).toBe("{{step_1}}");
    // Step 3 references both step_1 and step_2
    expect(steps[2].params.prompt).toContain("{{step_1}}");
    expect(steps[2].params.prompt).toContain("{{step_2}}");
  });

  it("returns the correct number of steps", () => {
    const playbook = getPlaybook("ghost-fleet")!;
    const steps = resolvePlaybookSteps(playbook, {
      niche: "VP of Sales",
      location: "United States",
      product: "Lead gen tool",
      tone: "Professional",
    });

    expect(steps.length).toBe(playbook.steps.length);
    expect(steps.length).toBe(3);
  });

  it("does not mutate the original playbook steps", () => {
    const playbook = getPlaybook("lead-blitz")!;
    const originalParams = JSON.parse(JSON.stringify(playbook.steps[0].params));

    resolvePlaybookSteps(playbook, {
      niche: "Dentists",
      location: "London",
      product: "Booking software",
    });

    expect(playbook.steps[0].params).toEqual(originalParams);
  });

  it("handles empty user input by replacing all placeholders with empty strings", () => {
    const playbook = getPlaybook("lead-blitz")!;
    const steps = resolvePlaybookSteps(playbook, {});

    expect(steps[0].params.niche).toBe("{{niche}}");
    expect(steps[0].params.location).toBe("{{location}}");
  });

  it("handles multiple field references in a single param value", () => {
    const playbook = getPlaybook("lead-blitz")!;
    const steps = resolvePlaybookSteps(playbook, {
      niche: "fintech",
      location: "NYC",
      product: "CRM",
    });

    // audience param is "{{niche}} in {{location}}"
    expect(steps[1].params.audience).toBe("fintech in NYC");
  });
});

// ── getPlaybook() ──

describe("getPlaybook", () => {
  it("returns the correct playbook by ID", () => {
    const playbook = getPlaybook("lead-blitz");
    expect(playbook).toBeDefined();
    expect(playbook!.id).toBe("lead-blitz");
    expect(playbook!.name).toBe("Lead Blitz");
  });

  it("returns each playbook by its ID", () => {
    for (const p of PLAYBOOKS) {
      const found = getPlaybook(p.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(p.id);
    }
  });

  it("returns undefined for a non-existent ID", () => {
    expect(getPlaybook("does-not-exist")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getPlaybook("")).toBeUndefined();
  });
});

// ── getPlaybooksByCategory() ──

describe("getPlaybooksByCategory", () => {
  it("returns only playbooks matching the 'growth' category", () => {
    const results = getPlaybooksByCategory("growth");
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.category).toBe("growth");
    }
  });

  it("returns only playbooks matching the 'content' category", () => {
    const results = getPlaybooksByCategory("content");
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.category).toBe("content");
    }
  });

  it("returns only playbooks matching the 'intelligence' category", () => {
    const results = getPlaybooksByCategory("intelligence");
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.category).toBe("intelligence");
    }
  });

  it("returns only playbooks matching the 'operations' category", () => {
    const results = getPlaybooksByCategory("operations");
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.category).toBe("operations");
    }
  });

  it("returns empty array for an invalid category", () => {
    const results = getPlaybooksByCategory(
      "nonexistent" as Playbook["category"],
    );
    expect(results).toEqual([]);
  });

  it("total playbooks across all categories equals PLAYBOOKS.length", () => {
    const categories: Playbook["category"][] = [
      "growth",
      "content",
      "intelligence",
      "operations",
    ];
    const total = categories.reduce(
      (sum, cat) => sum + getPlaybooksByCategory(cat).length,
      0,
    );
    expect(total).toBe(PLAYBOOKS.length);
  });
});

// ── PLAYBOOK_CATEGORIES ──

describe("PLAYBOOK_CATEGORIES", () => {
  it("has entries for all four categories", () => {
    const categoryIds = PLAYBOOK_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain("growth");
    expect(categoryIds).toContain("content");
    expect(categoryIds).toContain("intelligence");
    expect(categoryIds).toContain("operations");
  });

  it("each category has label and icon", () => {
    for (const cat of PLAYBOOK_CATEGORIES) {
      expect(cat.label).toBeTruthy();
      expect(typeof cat.label).toBe("string");
      expect(cat.icon).toBeTruthy();
      expect(typeof cat.icon).toBe("string");
    }
  });

  it("all categories are represented by at least one playbook", () => {
    for (const cat of PLAYBOOK_CATEGORIES) {
      const playbooks = PLAYBOOKS.filter((p) => p.category === cat.id);
      expect(playbooks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("no playbook uses a category not defined in PLAYBOOK_CATEGORIES", () => {
    const validCategories = PLAYBOOK_CATEGORIES.map((c) => c.id);
    for (const p of PLAYBOOKS) {
      expect(validCategories).toContain(p.category);
    }
  });
});

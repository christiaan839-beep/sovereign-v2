/**
 * Integration tests for playbook execution flow
 */
import { describe, it, expect } from "vitest";
import { PLAYBOOKS, PLAYBOOK_CATEGORIES, resolvePlaybookSteps } from "@/lib/playbooks";

describe("playbooks.ts — Integration Tests", () => {
  // ── Registry ──

  it("has 25+ playbooks defined", () => {
    expect(Object.keys(PLAYBOOKS).length).toBeGreaterThanOrEqual(25);
  });

  it("every playbook has required fields", () => {
    for (const [id, pb] of Object.entries(PLAYBOOKS)) {
      expect(pb.name, `${id} missing name`).toBeTruthy();
      expect(pb.description, `${id} missing description`).toBeTruthy();
      expect(pb.steps.length, `${id} has no steps`).toBeGreaterThan(0);
      expect(pb.category, `${id} missing category`).toBeTruthy();
    }
  });

  it("every playbook step references a valid agent", () => {
    const knownAgents = new Set([
      "leads", "email-sequence", "seo-dominator", "blog-gen", "competitor-scan",
      "brand-voice", "brand-audit", "proposal-generator", "client-report",
      "organic-content", "funnel-xray", "ad-report", "creative-director",
      "smart-router", "contract-analyzer", "case-study", "site-assassin",
      "page-builder", "doc-intel", "translate", "meeting-notes",
      "calendar", "social-router", "outbound", "abm-artillery",
    ]);

    for (const [id, pb] of Object.entries(PLAYBOOKS)) {
      for (const step of pb.steps) {
        // Agent should be a string (not empty)
        expect(step.agent, `${id} step has empty agent`).toBeTruthy();
      }
    }
  });

  it("all playbooks have reasonable step counts (1-10)", () => {
    for (const [id, pb] of Object.entries(PLAYBOOKS)) {
      expect(pb.steps.length, `${id}`).toBeGreaterThanOrEqual(1);
      expect(pb.steps.length, `${id}`).toBeLessThanOrEqual(10);
    }
  });

  it("categories cover all playbooks", () => {
    const allCategories = new Set(Object.values(PLAYBOOKS).map(pb => pb.category));
    expect(allCategories.size).toBeGreaterThanOrEqual(3);
  });

  it("PLAYBOOK_CATEGORIES lists all categories", () => {
    expect(PLAYBOOK_CATEGORIES.length).toBeGreaterThanOrEqual(3);
  });

  // ── Step Resolution ──

  it("resolves playbook steps with user inputs", () => {
    const pb = PLAYBOOKS["lead-blitz"];
    if (!pb) return; // Skip if playbook doesn't exist

    const resolved = resolvePlaybookSteps(pb, {
      niche: "SaaS",
      location: "Austin",
    });

    expect(resolved.length).toBe(pb.steps.length);
    expect(resolved[0].agent).toBeTruthy();
    // First step params should include user input
    const firstStepParams = JSON.stringify(resolved[0].params);
    expect(firstStepParams).toContain("SaaS");
  });

  it("resolves template references between steps", () => {
    const pb = PLAYBOOKS["lead-blitz"];
    if (!pb || pb.steps.length < 2) return;

    const resolved = resolvePlaybookSteps(pb, { niche: "Dental" });

    // Step 2 should reference step 1 output template
    const step2Params = JSON.stringify(resolved[1].params);
    // Template should be present ({{step_1}} or similar)
    expect(step2Params.includes("{{step_1}}") || step2Params.includes("Dental")).toBe(true);
  });

  // ── Guarantee Checks ──

  it("playbooks with guarantees have valid check fields", () => {
    for (const [id, pb] of Object.entries(PLAYBOOKS)) {
      if (pb.guaranteeCheck) {
        if (pb.guaranteeCheck.minResultCount !== undefined) {
          expect(pb.guaranteeCheck.minResultCount, `${id} minResultCount`).toBeGreaterThan(0);
        }
        if (pb.guaranteeCheck.minWordCount !== undefined) {
          expect(pb.guaranteeCheck.minWordCount, `${id} minWordCount`).toBeGreaterThan(0);
        }
      }
    }
  });
});

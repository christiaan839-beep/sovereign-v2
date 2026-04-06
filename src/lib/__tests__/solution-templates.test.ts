import { describe, it, expect } from "vitest";
import { SOLUTION_TEMPLATES, getSolution, getSolutionsByCategory } from "@/lib/solution-templates";

describe("solution-templates.ts — One-Click Workflows", () => {
  it("has 5 solution templates", () => { expect(SOLUTION_TEMPLATES.length).toBe(5); });

  it("every template has required fields", () => {
    for (const sol of SOLUTION_TEMPLATES) {
      expect(sol.id).toBeTruthy();
      expect(sol.name).toBeTruthy();
      expect(sol.description.length).toBeGreaterThan(10);
      expect(sol.deliverables.length).toBeGreaterThan(0);
      expect(sol.agents.length).toBeGreaterThan(0);
      expect(sol.playbookId).toBeTruthy();
    }
  });

  it("getSolution returns by ID", () => {
    expect(getSolution("lead-pipeline")?.name).toBe("Lead Pipeline");
    expect(getSolution("content-engine")?.name).toBe("Content Engine");
    expect(getSolution("nonexistent")).toBeUndefined();
  });

  it("getSolutionsByCategory returns correct results", () => {
    const growth = getSolutionsByCategory("growth");
    expect(growth.length).toBeGreaterThan(0);
    expect(growth.every(s => s.category === "growth")).toBe(true);
  });

  it("lead-pipeline has correct agents", () => {
    const sol = getSolution("lead-pipeline");
    expect(sol?.agents).toContain("leads");
    expect(sol?.agents).toContain("email-sequence");
  });

  it("all templates have estimated time", () => {
    for (const sol of SOLUTION_TEMPLATES) {
      expect(sol.estimatedTime).toBeTruthy();
    }
  });

  it("all templates have follow-up actions", () => {
    for (const sol of SOLUTION_TEMPLATES) {
      expect(sol.followUps.length).toBeGreaterThan(0);
    }
  });
});

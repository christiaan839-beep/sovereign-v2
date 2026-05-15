/**
 * Tests for src/lib/compliance-mappings.ts — Cook 49.
 *
 *   - CONTROLS covers all three frameworks.
 *   - buildScorecard returns correct counts + coverage fraction.
 *   - Extra controls merge into the scorecard.
 *   - renderControlLine emits status + satisfied-by.
 *   - Every implemented control names at least one Sovereign capability.
 */

import { describe, it, expect } from "vitest";
import {
  CONTROLS,
  buildScorecard,
  renderControlLine,
  type Control,
} from "../compliance-mappings";

describe("CONTROLS — completeness", () => {
  it("covers all three frameworks", () => {
    const frameworks = new Set(CONTROLS.map((c) => c.framework));
    expect(frameworks.has("eu-ai-act-annex-iv")).toBe(true);
    expect(frameworks.has("nist-ai-rmf")).toBe(true);
    expect(frameworks.has("iso-42001")).toBe(true);
  });

  it("every implemented control names at least one Sovereign capability", () => {
    for (const c of CONTROLS) {
      if (c.status === "implemented") {
        expect(c.satisfiedBy.length).toBeGreaterThan(0);
      }
    }
  });

  it("control ids are unique", () => {
    const ids = CONTROLS.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe("buildScorecard", () => {
  it("returns correct totals per framework", () => {
    const eu = buildScorecard("eu-ai-act-annex-iv");
    expect(eu.total).toBe(
      CONTROLS.filter((c) => c.framework === "eu-ai-act-annex-iv").length,
    );
    expect(eu.implemented + eu.partial + eu.planned).toBe(eu.total);
  });

  it("coverageFraction is implemented + 0.5*partial / total", () => {
    const sc = buildScorecard("eu-ai-act-annex-iv", [
      {
        id: "X-1",
        framework: "eu-ai-act-annex-iv",
        title: "x",
        description: "x",
        satisfiedBy: [],
        status: "planned",
      },
    ]);
    const expected = (sc.implemented + sc.partial * 0.5) / sc.total;
    expect(sc.coverageFraction).toBeCloseTo(expected, 5);
  });

  it("merges extra controls into the scorecard", () => {
    const extra: Control = {
      id: "CUSTOM-1",
      framework: "iso-42001",
      title: "Custom",
      description: "Custom control",
      satisfiedBy: ["audit-log"],
      status: "implemented",
    };
    const sc = buildScorecard("iso-42001", [extra]);
    expect(sc.controls.some((c) => c.id === "CUSTOM-1")).toBe(true);
  });

  it("filters extra controls to the requested framework only", () => {
    const sc = buildScorecard("iso-42001", [
      {
        id: "OTHER-1",
        framework: "eu-ai-act-annex-iv",
        title: "Other",
        description: "Other",
        satisfiedBy: [],
        status: "implemented",
      },
    ]);
    expect(sc.controls.some((c) => c.id === "OTHER-1")).toBe(false);
  });
});

describe("renderControlLine", () => {
  it("renders the implemented status marker", () => {
    const line = renderControlLine({
      id: "T-1",
      framework: "iso-42001",
      title: "Test",
      description: "x",
      satisfiedBy: ["red-team"],
      status: "implemented",
    });
    expect(line).toContain("[✓]");
    expect(line).toContain("T-1");
    expect(line).toContain("Test");
    expect(line).toContain("red-team");
  });

  it("renders partial + planned markers distinctly", () => {
    expect(
      renderControlLine({
        id: "P-1",
        framework: "iso-42001",
        title: "x",
        description: "x",
        satisfiedBy: [],
        status: "partial",
      }),
    ).toContain("[~]");
    expect(
      renderControlLine({
        id: "Q-1",
        framework: "iso-42001",
        title: "x",
        description: "x",
        satisfiedBy: [],
        status: "planned",
      }),
    ).toContain("[ ]");
  });
});

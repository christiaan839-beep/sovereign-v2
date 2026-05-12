/**
 * Tests for src/lib/expert-critic.ts — domain-aware final-pass review.
 *
 * The critic is the elite-tier safety net that catches outputs which
 * pass every other gate but would fail domain-expert scrutiny. These
 * tests lock the parsing behaviour, the defensive-default failure
 * modes, and the rubric library so a future refactor can't regress
 * the "never silently accept" contract.
 *
 * The pure helpers (`buildCriticPrompt`, `extractJsonObject`,
 * `normalizeVerdict`) are exercised directly. `expertReview` mocks
 * the AI router via `vi.mock("../ai")`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RUBRICS,
  buildCriticPrompt,
  extractJsonObject,
  normalizeVerdict,
  expertReview,
} from "../expert-critic";

vi.mock("../ai", () => ({
  ai: vi.fn(),
}));

import { ai } from "../ai";

const aiMock = vi.mocked(ai);

beforeEach(() => {
  aiMock.mockReset();
});

describe("RUBRICS library", () => {
  it("ships the four baseline rubrics required by Cooks 31/32/34", () => {
    expect(RUBRICS["pharma-protocol-deviation"]).toBeDefined();
    expect(RUBRICS["climate-scope-calculation"]).toBeDefined();
    expect(RUBRICS["aec-submittal-review"]).toBeDefined();
    expect(RUBRICS["generic-audit-ready"]).toBeDefined();
  });

  it("aec-submittal-review rubric enforces spec-section + reviewer + RFI bars", () => {
    // Locking the AEC-specific must-pass criteria so a future
    // 'simplification' can't accidentally remove the spec-section
    // citation requirement (the single most common failure mode in
    // construction submittal review).
    const rubric = RUBRICS["aec-submittal-review"];
    expect(rubric.expertSystem).toContain("submittal");
    expect(rubric.mustPass.some((c) => /spec section/i.test(c))).toBe(true);
    expect(rubric.mustPass.some((c) => /reviewer team/i.test(c))).toBe(true);
    expect(rubric.mustPass.some((c) => /RFI/i.test(c))).toBe(true);
  });

  it("every rubric has a non-empty expertSystem + at least 3 must-pass criteria", () => {
    // Locking the minimum bar: a rubric with fewer than 3 must-pass
    // criteria is too soft to call 'expert review'. Adding new rubrics
    // means hitting at least this floor.
    for (const rubric of Object.values(RUBRICS)) {
      expect(rubric.expertSystem.length).toBeGreaterThan(50);
      expect(rubric.mustPass.length).toBeGreaterThanOrEqual(3);
      expect(rubric.id).toBeTruthy();
      expect(rubric.label).toBeTruthy();
    }
  });

  it("every rubric id is unique", () => {
    const ids = Object.values(RUBRICS).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every rubric id matches its registry key (prevents typo drift)", () => {
    for (const [key, rubric] of Object.entries(RUBRICS)) {
      expect(rubric.id).toBe(key);
    }
  });
});

describe("buildCriticPrompt", () => {
  const rubric = RUBRICS["generic-audit-ready"];

  it("includes the candidate answer between the documented delimiters", () => {
    const prompt = buildCriticPrompt("The capital of France is Paris.", rubric);
    expect(prompt).toContain("<<<CANDIDATE");
    expect(prompt).toContain("CANDIDATE>>>");
    expect(prompt).toContain("The capital of France is Paris.");
  });

  it("enumerates every must-pass criterion verbatim", () => {
    const prompt = buildCriticPrompt("answer", rubric);
    for (const criterion of rubric.mustPass) {
      expect(prompt).toContain(criterion);
    }
  });

  it("instructs the model to return a single JSON object with no preamble", () => {
    const prompt = buildCriticPrompt("answer", rubric);
    expect(prompt).toContain("JSON object");
    expect(prompt).toContain("no preamble");
    expect(prompt).toContain("no markdown fences");
  });

  it("declares the schema fields the verdict must contain", () => {
    const prompt = buildCriticPrompt("answer", rubric);
    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"findings"');
    expect(prompt).toContain('"revisionPrompt"');
    expect(prompt).toContain('"severity"');
  });
});

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"pass":true,"findings":[]}')).toEqual({
      pass: true,
      findings: [],
    });
  });

  it("strips ```json``` code fences before parsing", () => {
    const raw = '```json\n{"pass":false}\n```';
    expect(extractJsonObject(raw)).toEqual({ pass: false });
  });

  it("handles model preambles before the JSON", () => {
    const raw =
      'Here is my evaluation:\n\n{"pass":true,"findings":[],"revisionPrompt":""}';
    expect(extractJsonObject(raw)).toEqual({
      pass: true,
      findings: [],
      revisionPrompt: "",
    });
  });

  it("parses nested objects without confusing the brace counter", () => {
    const raw =
      '{"pass":false,"findings":[{"severity":"major","detail":"x","suggestion":"y","category":"z"}]}';
    const parsed = extractJsonObject(raw) as {
      findings: Array<Record<string, string>>;
    };
    expect(parsed.findings[0].severity).toBe("major");
  });

  it("returns null when no JSON object is present", () => {
    expect(extractJsonObject("no json here, sorry")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });

  it("returns null when the first { … } span is malformed", () => {
    // The function tries to parse the first balanced span. If it fails,
    // it currently returns null without trying later spans. Test the
    // contract explicitly so a future "be more forgiving" change is a
    // conscious choice, not an accident.
    expect(extractJsonObject('{"pass":not-valid-json}')).toBeNull();
  });
});

describe("normalizeVerdict", () => {
  it("returns a clean verdict for a well-formed pass", () => {
    const verdict = normalizeVerdict(
      { pass: true, findings: [], revisionPrompt: "" },
      "generic-audit-ready",
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.worstSeverity).toBeNull();
    expect(verdict.findings).toEqual([]);
    expect(verdict.revisionPrompt).toBe("");
    expect(verdict.rubricId).toBe("generic-audit-ready");
  });

  it("sorts findings by severity descending (blocker first)", () => {
    const verdict = normalizeVerdict(
      {
        pass: false,
        findings: [
          { severity: "info", category: "a", detail: "", suggestion: "" },
          { severity: "blocker", category: "b", detail: "", suggestion: "" },
          { severity: "minor", category: "c", detail: "", suggestion: "" },
          { severity: "major", category: "d", detail: "", suggestion: "" },
        ],
      },
      "generic-audit-ready",
    );
    expect(verdict.findings.map((f) => f.severity)).toEqual([
      "blocker",
      "major",
      "minor",
      "info",
    ]);
    expect(verdict.worstSeverity).toBe("blocker");
  });

  it("overrides a dishonest model pass=true when blockers are present", () => {
    // Critical contract: the model can claim "pass" but if it lists
    // a blocker, the normalizer treats the verdict as failed. Stops
    // the model from gaslighting its way through the gate.
    const verdict = normalizeVerdict(
      {
        pass: true,
        findings: [
          {
            severity: "blocker",
            category: "config",
            detail: "Missing required citation",
            suggestion: "Add the source",
          },
        ],
      },
      "generic-audit-ready",
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.worstSeverity).toBe("blocker");
  });

  it("overrides pass=true when only major findings are present", () => {
    const verdict = normalizeVerdict(
      {
        pass: true,
        findings: [
          {
            severity: "major",
            category: "ambiguous",
            detail: "Attribution unclear",
            suggestion: "Cite the source",
          },
        ],
      },
      "generic-audit-ready",
    );
    expect(verdict.pass).toBe(false);
  });

  it("allows pass=true when only minor/info findings are present", () => {
    // Minor and info findings are non-blocking by policy. A model that
    // says pass=true with only nits should ship.
    const verdict = normalizeVerdict(
      {
        pass: true,
        findings: [
          { severity: "minor", category: "a", detail: "", suggestion: "" },
          { severity: "info", category: "b", detail: "", suggestion: "" },
        ],
      },
      "generic-audit-ready",
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.worstSeverity).toBe("minor");
  });

  it("drops findings with invalid severity values", () => {
    const verdict = normalizeVerdict(
      {
        pass: true,
        findings: [
          { severity: "critical", category: "a", detail: "", suggestion: "" }, // not in enum
          { severity: "minor", category: "b", detail: "", suggestion: "" },
        ],
      },
      "generic-audit-ready",
    );
    expect(verdict.findings.length).toBe(1);
    expect(verdict.findings[0].severity).toBe("minor");
  });

  it("fills missing finding fields with safe defaults", () => {
    const verdict = normalizeVerdict(
      {
        pass: false,
        findings: [{ severity: "blocker" }], // no category / detail / suggestion
      },
      "generic-audit-ready",
    );
    expect(verdict.findings[0]).toEqual({
      severity: "blocker",
      category: "uncategorized",
      detail: "",
      suggestion: "",
    });
  });

  it("defaults to pass=false when parsed input is empty or malformed", () => {
    // The "fail safe" default — a missing pass field must NEVER be
    // interpreted as a pass.
    const verdict = normalizeVerdict({}, "generic-audit-ready");
    expect(verdict.pass).toBe(false);
  });

  it("handles a null parsed input gracefully", () => {
    const verdict = normalizeVerdict(null, "generic-audit-ready");
    expect(verdict.pass).toBe(false);
    expect(verdict.findings).toEqual([]);
  });
});

describe("expertReview (integration)", () => {
  it("returns a clean pass verdict for a well-formed critic response", async () => {
    aiMock.mockResolvedValueOnce(
      '{"pass":true,"findings":[],"revisionPrompt":""}',
    );

    const verdict = await expertReview(
      "Clean answer with citations.",
      "generic-audit-ready",
    );

    expect(verdict.pass).toBe(true);
    expect(verdict.findings).toEqual([]);
    expect(verdict.rubricId).toBe("generic-audit-ready");
  });

  it("loads the rubric's expertSystem as the critic's system prompt", async () => {
    aiMock.mockResolvedValueOnce('{"pass":true,"findings":[]}');

    await expertReview("answer", "pharma-protocol-deviation");

    expect(aiMock).toHaveBeenCalledTimes(1);
    const call = aiMock.mock.calls[0];
    const options = call[1];
    expect(options?.system).toBe(
      RUBRICS["pharma-protocol-deviation"].expertSystem,
    );
  });

  it("returns a defensive blocker when the critic response is unparseable", async () => {
    aiMock.mockResolvedValueOnce("looks ok lol");

    const verdict = await expertReview("answer", "generic-audit-ready");

    expect(verdict.pass).toBe(false);
    expect(verdict.worstSeverity).toBe("blocker");
    expect(verdict.findings[0].category).toBe("critic-parse");
  });

  it("returns a defensive blocker when the AI call throws", async () => {
    aiMock.mockRejectedValueOnce(new Error("upstream-5xx"));

    const verdict = await expertReview("answer", "generic-audit-ready");

    expect(verdict.pass).toBe(false);
    expect(verdict.worstSeverity).toBe("blocker");
    expect(verdict.findings[0].category).toBe("critic-unavailable");
  });

  it("refuses an unknown rubric id with a blocker rather than silently passing", async () => {
    const verdict = await expertReview("answer", "this-rubric-does-not-exist");

    expect(verdict.pass).toBe(false);
    expect(verdict.worstSeverity).toBe("blocker");
    expect(verdict.findings[0].category).toBe("config");
    expect(aiMock).not.toHaveBeenCalled(); // never wastes a model call
  });

  it("accepts an inline ExpertRubric (not just a registered id)", async () => {
    aiMock.mockResolvedValueOnce('{"pass":true,"findings":[]}');

    const inline = {
      id: "test-inline",
      label: "Test Inline Rubric",
      expertSystem: "You are a test critic.",
      mustPass: ["A", "B", "C"],
      niceToHave: [],
    };

    const verdict = await expertReview("answer", inline);

    expect(verdict.pass).toBe(true);
    expect(verdict.rubricId).toBe("test-inline");
  });

  it("propagates a real critic verdict end-to-end", async () => {
    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        pass: false,
        findings: [
          {
            severity: "major",
            category: "missing-factor",
            detail: "No emission factor source cited.",
            suggestion: "Cite IPCC AR6 or EPA eGRID for the activity.",
          },
        ],
        revisionPrompt:
          "Add a citation for the emission factor and the GWP basis.",
      }),
    );

    const verdict = await expertReview(
      "Our Scope 2 emissions are 50,000 tCO2e.",
      "climate-scope-calculation",
    );

    expect(verdict.pass).toBe(false);
    expect(verdict.worstSeverity).toBe("major");
    expect(verdict.findings[0].category).toBe("missing-factor");
    expect(verdict.revisionPrompt).toContain("emission factor");
  });
});

import { describe, it, expect } from "vitest";
import {
  buildAgentResume,
  serializeAgentResume,
  listAuthoredResumes,
  type AgentResume,
} from "../agent-resume";

describe("agent-resume — .agent.md generator", () => {
  it("builds a resume for a known agent with authored body", () => {
    const resume = buildAgentResume("leads");
    expect(resume).not.toBeNull();
    expect(resume?.meta.slug).toBe("leads");
    expect(resume?.body.title).toBe("Leads");
    expect(resume?.body.inputs?.length).toBeGreaterThan(0);
  });

  it("builds a skeleton resume for a registered but un-authored agent", () => {
    // smart-router is registered but has no RESUME_BODIES entry
    const resume = buildAgentResume("smart-router");
    expect(resume).not.toBeNull();
    expect(resume?.body.title).toBe("Smart Router");
    expect(resume?.body.summary).toMatch(/No human-authored summary yet/);
  });

  it("returns null for unknown slugs", () => {
    expect(buildAgentResume("this-agent-does-not-exist-xyz")).toBeNull();
  });

  it("serializes front-matter + markdown deterministically", () => {
    const resume: AgentResume = {
      meta: { slug: "test", tier: 2, models: ["nemotron-ultra"] },
      body: {
        title: "Test",
        summary: "A test agent.",
        inputs: [{ field: "text", type: "string", required: true, example: '"hello"' }],
        outputs: { type: "json", example: '{ "ok": true }' },
      },
    };

    const md = serializeAgentResume(resume);

    // front-matter boundaries
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toMatch(/\nslug: test\n/);
    expect(md).toMatch(/\ntier: 2\n/);
    expect(md).toMatch(/\nmodels: \[nemotron-ultra\]\n/);

    // markdown body
    expect(md).toMatch(/# Test/);
    expect(md).toMatch(/A test agent\./);
    expect(md).toMatch(/## Inputs/);
    expect(md).toMatch(/\| `text` \| `string` \| yes \|/);
    expect(md).toMatch(/## Outputs/);
    expect(md).toMatch(/```json\n\{ "ok": true \}\n```/);
  });

  it("omits optional meta fields cleanly", () => {
    const resume: AgentResume = {
      meta: { slug: "minimal", tier: 1 },
      body: { title: "Minimal", summary: "No extras." },
    };
    const md = serializeAgentResume(resume);
    expect(md).not.toMatch(/models:/);
    expect(md).not.toMatch(/latency_p50_ms/);
    expect(md).not.toMatch(/quality_score/);
  });

  it("escapes zero-input agents without empty tables", () => {
    const resume: AgentResume = {
      meta: { slug: "noinput", tier: 1 },
      body: { title: "No Input", summary: "Takes nothing." },
    };
    const md = serializeAgentResume(resume);
    expect(md).not.toMatch(/\| field \| type \|/);
  });

  it("listAuthoredResumes returns stable alphabetical order", () => {
    const slugs = listAuthoredResumes();
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs).toContain("leads");
    expect(slugs).toContain("slack-notify");
  });

  it("tier is derived from action-tiers mapping", () => {
    // slack-notify is registered as tier-2 in action-tiers.ts
    const slack = buildAgentResume("slack-notify");
    expect(slack?.meta.tier).toBe(2);
    // smart-router defaults to tier-1 (autonomous)
    const router = buildAgentResume("smart-router");
    expect(router?.meta.tier).toBe(1);
  });
});

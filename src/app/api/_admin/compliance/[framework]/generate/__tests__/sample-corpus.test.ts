/**
 * The compliance-binder endpoint must not hand anyone a document that looks
 * like evidence and is not.
 *
 * This route always builds its report from a synthetic receipt corpus —
 * reading the tenant's own receipts is not wired up yet. Two things had gone
 * wrong with that, and each made the other worse:
 *
 *   1. The corpus' pack ids were invented ("nist-ai-rmf-govern",
 *      "iso42001-aims", "soc2-cc6-iam", "fairness-eval", ...). None of them
 *      names a pack in the Guardian registry, so they could only ever match
 *      through the exporters' catch-all prefixes.
 *   2. Nothing in the response said the receipts were synthetic. A user could
 *      download a SOC 2 binder reporting full coverage and attach it to a
 *      customer questionnaire.
 *
 * Together those produced a finished-looking binder, made of nothing, with no
 * marker. This file holds both halves shut.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

import { POST } from "../route.js";
import { ALL_PACKS } from "@sovereign-matrix/verifiable-receipts";

const PACK_IDS = new Set(ALL_PACKS.map((p) => p.id));

/** Find `packsExercised` wherever the annex-iv report puts it. */
function collectPacksExercised(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectPacksExercised);
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    const here = Array.isArray(rec["packsExercised"])
      ? (rec["packsExercised"] as string[])
      : [];
    return [...here, ...Object.values(rec).flatMap(collectPacksExercised)];
  }
  return [];
}

function post(framework: string, scope: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/_admin/compliance/soc2/generate", {
      method: "POST",
      body: JSON.stringify({ scope }),
    }),
    { params: Promise.resolve({ framework }) },
  );
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ userId: "user_test" });
});

describe("compliance generate — the corpus is made of real packs", () => {
  it("every pack the sample corpus carries exists in the registry", async () => {
    // annex-iv is the exporter that lists the packs it saw, so the corpus can
    // be read back out of a rendered document rather than out of the route's
    // own array — this fails if the corpus changes anywhere.
    const res = await post("annex-iv");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: string };
    const report = JSON.parse(body.json) as Record<string, unknown>;
    const packs = collectPacksExercised(report);
    expect(packs.length).toBeGreaterThan(0);
    const invented = packs.filter((p) => !PACK_IDS.has(p));
    expect(
      invented,
      `the sample corpus names packs the Guardian registry cannot produce: ${invented.join(", ")}`,
    ).toEqual([]);
  });

  it("the registry check can fail", () => {
    // Guards the guard: PACK_IDS is populated and does not accept anything.
    expect(PACK_IDS.size).toBeGreaterThan(20);
    expect(PACK_IDS.has("owasp-agentic-top10-2026")).toBe(true);
    expect(PACK_IDS.has("soc2-cc6-iam")).toBe(false);
    expect(PACK_IDS.has("fairness-eval")).toBe(false);
  });
});

describe("compliance generate — sample output is stamped as sample output", () => {
  const FRAMEWORKS = [
    "annex-iv",
    "iso-42001",
    "nist-ai-rmf",
    "soc2",
    "gdpr-dpia",
    "hipaa",
    "iso-23894",
    "eu-cra",
    "ai-constitution",
  ];

  it.each(FRAMEWORKS)("%s marks the document as not evidence", async (fw) => {
    const res = await post(fw);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      markdown: string;
      json: string;
      sampleData: boolean;
    };
    expect(body.sampleData).toBe(true);
    // The banner has to be the first thing in the document — a reader who
    // stops at the title must still see it, and it must survive the download,
    // which writes body.markdown verbatim to a file.
    expect(body.markdown.startsWith("> **SAMPLE DOCUMENT — NOT EVIDENCE.**")).toBe(true);
    expect(body.markdown).toContain("Do not submit this to an auditor");
    // And the machine-readable half, for anything that consumes the JSON.
    expect(JSON.parse(body.json).sampleData).toBe(true);
  });

  it("401s before building anything when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await post("soc2");
    expect(res.status).toBe(401);
  });
});

/**
 * Wave 112 — methodology-verifier.ts contract tests.
 *
 * Pins the runtime guarantees of the CRAAP / SIFT / FINER scorers and
 * the top-level orchestrator. The NIM client is mocked so each test
 * controls the model response deterministically.
 *
 * Properties under test:
 *  - Happy-path: well-formed JSON → structured scores with overall
 *    computed as the equal-weighted mean of dimensions.
 *  - Tolerant parsing: ```json fences, leading prose, trailing prose
 *    all yield a parsed result.
 *  - Degraded fallback: malformed JSON, network errors, empty input
 *    all produce { degraded: true } without throwing.
 *  - Clamping: scores outside [0,1] are pulled back to the range.
 *  - Empty-input guards: short-circuit before issuing a NIM call.
 *  - Orchestrator: parallel run, overall aggregation, kill-switch
 *    checkpoint, fail-open semantics.
 *  - Kill-switch: when budgetCheckpoint throws, no scorer is invoked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { nimChatMock, budgetCheckpointMock } = vi.hoisted(() => ({
  nimChatMock: vi.fn(),
  budgetCheckpointMock: vi.fn(),
}));

vi.mock("@/lib/nvidia", () => ({
  nimChat: nimChatMock,
}));

vi.mock("@/lib/execution-budget", () => ({
  checkpoint: budgetCheckpointMock,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

async function fresh() {
  vi.resetModules();
  return await import("@/lib/methodology-verifier");
}

const CRAAP_WELL_FORMED = JSON.stringify({
  currency: { score: 0.9, rationale: "uses 2025 figures" },
  relevance: { score: 0.8, rationale: "directly answers the question" },
  authority: { score: 0.6, rationale: "author is credentialed" },
  accuracy: { score: 0.75, rationale: "cites primary sources" },
  purpose: { score: 0.95, rationale: "informational, no commercial bias" },
});

const FINER_WELL_FORMED = JSON.stringify({
  feasible: { score: 0.7, rationale: "n=200 obtainable in 6 mo" },
  interesting: { score: 0.85, rationale: "fills clear field gap" },
  novel: { score: 0.9, rationale: "no prior trial in this population" },
  ethical: { score: 0.95, rationale: "IRB-clearable protocol" },
  relevant: { score: 0.6, rationale: "modest policy impact" },
});

const SIFT_WELL_FORMED = JSON.stringify({
  claims: [
    {
      claim: "GDP grew 3.2% in 2024",
      status: "verified",
      confidence: 0.9,
      laterals: ["Cross-check on BEA", "World Bank dataset"],
    },
    {
      claim: "Unemployment hit 2.1% in Q3 2024",
      status: "unverified",
      confidence: 0.4,
      laterals: ["BLS release"],
    },
  ],
});

beforeEach(() => {
  nimChatMock.mockReset();
  budgetCheckpointMock.mockReset();
  budgetCheckpointMock.mockResolvedValue(undefined);
});

describe("methodology-verifier — CRAAP scorer", () => {
  it("returns 5-dimension scores with overall = mean when response is well-formed", async () => {
    nimChatMock.mockResolvedValueOnce(CRAAP_WELL_FORMED);
    const { craap } = await fresh();
    const r = await craap("Claude is widely used for enterprise AI in 2025.");
    expect(r.degraded).toBe(false);
    expect(r.currency.score).toBe(0.9);
    expect(r.relevance.score).toBe(0.8);
    expect(r.authority.score).toBe(0.6);
    expect(r.accuracy.score).toBe(0.75);
    expect(r.purpose.score).toBe(0.95);
    // Mean of 0.9 + 0.8 + 0.6 + 0.75 + 0.95 = 0.8
    expect(r.overall).toBeCloseTo(0.8, 5);
  });

  it("parses JSON wrapped in ```json fences", async () => {
    nimChatMock.mockResolvedValueOnce(
      "```json\n" + CRAAP_WELL_FORMED + "\n```",
    );
    const { craap } = await fresh();
    const r = await craap("test claim");
    expect(r.degraded).toBe(false);
    expect(r.currency.score).toBe(0.9);
  });

  it("parses JSON preceded by a one-line preamble", async () => {
    nimChatMock.mockResolvedValueOnce(
      "Here is the analysis:\n" + CRAAP_WELL_FORMED,
    );
    const { craap } = await fresh();
    const r = await craap("test claim");
    expect(r.degraded).toBe(false);
  });

  it("clamps out-of-range scores back to [0, 1]", async () => {
    nimChatMock.mockResolvedValueOnce(
      JSON.stringify({
        currency: { score: 2.5, rationale: "x" },
        relevance: { score: -0.3, rationale: "x" },
        authority: { score: 1.0, rationale: "x" },
        accuracy: { score: 0.5, rationale: "x" },
        purpose: { score: 0.5, rationale: "x" },
      }),
    );
    const { craap } = await fresh();
    const r = await craap("test claim");
    expect(r.currency.score).toBe(1.0);
    expect(r.relevance.score).toBe(0.0);
  });

  it("returns degraded result on malformed JSON", async () => {
    nimChatMock.mockResolvedValueOnce("not even close to JSON");
    const { craap } = await fresh();
    const r = await craap("test claim");
    expect(r.degraded).toBe(true);
    expect(r.overall).toBe(0.5);
  });

  it("returns degraded result on NIM network error (does NOT throw)", async () => {
    nimChatMock.mockRejectedValueOnce(new Error("NIM 503"));
    const { craap } = await fresh();
    const r = await craap("test claim");
    expect(r.degraded).toBe(true);
  });

  it("short-circuits on empty input WITHOUT calling NIM", async () => {
    const { craap } = await fresh();
    const r = await craap("");
    expect(r.degraded).toBe(true);
    expect(r.overall).toBe(0);
    expect(nimChatMock).not.toHaveBeenCalled();
  });

  it("includes the provided context in the user prompt for the RELEVANCE dimension", async () => {
    nimChatMock.mockResolvedValueOnce(CRAAP_WELL_FORMED);
    const { craap } = await fresh();
    await craap("the claim", "Was the 2024 GDP growth rate above 3%?");
    const messages = nimChatMock.mock.calls[0][1];
    const userMsg = messages.find(
      (m: { role: string; content: string }) => m.role === "user",
    );
    expect(userMsg.content).toContain("CONTEXT");
    expect(userMsg.content).toContain("Was the 2024 GDP growth rate");
  });
});

describe("methodology-verifier — SIFT scorer", () => {
  it("returns the claim ledger and computes verifiedRatio", async () => {
    nimChatMock.mockResolvedValueOnce(SIFT_WELL_FORMED);
    const { sift } = await fresh();
    const r = await sift(
      "GDP grew 3.2% in 2024. Unemployment hit 2.1% in Q3 2024.",
    );
    expect(r.degraded).toBe(false);
    expect(r.claims).toHaveLength(2);
    expect(r.claims[0].claim).toBe("GDP grew 3.2% in 2024");
    expect(r.claims[0].status).toBe("verified");
    // 1 of 2 verified
    expect(r.verifiedRatio).toBe(0.5);
  });

  it("caps the claim list at MAX_CLAIMS_PER_SIFT", async () => {
    const manyClaims = JSON.stringify({
      claims: new Array(20).fill(0).map((_, i) => ({
        claim: `claim ${i}`,
        status: "unverified",
        confidence: 0.5,
        laterals: [],
      })),
    });
    nimChatMock.mockResolvedValueOnce(manyClaims);
    const { sift } = await fresh();
    const r = await sift("text");
    expect(r.claims.length).toBeLessThanOrEqual(6);
  });

  it("normalises an unknown status string to 'unverified'", async () => {
    nimChatMock.mockResolvedValueOnce(
      JSON.stringify({
        claims: [
          {
            claim: "x",
            status: "rocketfuel",
            confidence: 0.5,
            laterals: [],
          },
        ],
      }),
    );
    const { sift } = await fresh();
    const r = await sift("text");
    expect(r.claims[0].status).toBe("unverified");
  });

  it("filters out malformed claim entries (missing/empty claim field)", async () => {
    nimChatMock.mockResolvedValueOnce(
      JSON.stringify({
        claims: [
          { claim: "valid", status: "verified", confidence: 0.9, laterals: [] },
          { status: "verified", confidence: 0.9 }, // no claim field
          { claim: "", status: "verified" }, // empty claim
          { claim: "second valid", status: "unverified", confidence: 0.5 },
        ],
      }),
    );
    const { sift } = await fresh();
    const r = await sift("text");
    expect(r.claims).toHaveLength(2);
  });

  it("returns degraded={claims:[], verifiedRatio:0} when claims is not an array", async () => {
    nimChatMock.mockResolvedValueOnce(
      JSON.stringify({ claims: "not an array" }),
    );
    const { sift } = await fresh();
    const r = await sift("text");
    expect(r.claims).toEqual([]);
    expect(r.degraded).toBe(true);
  });

  it("short-circuits on empty input WITHOUT calling NIM", async () => {
    const { sift } = await fresh();
    const r = await sift("");
    expect(r.degraded).toBe(true);
    expect(nimChatMock).not.toHaveBeenCalled();
  });

  it("returns degraded on NIM error", async () => {
    nimChatMock.mockRejectedValueOnce(new Error("timeout"));
    const { sift } = await fresh();
    const r = await sift("text");
    expect(r.degraded).toBe(true);
  });

  it("returns verifiedRatio=0 when the model emits an empty claims list", async () => {
    nimChatMock.mockResolvedValueOnce(JSON.stringify({ claims: [] }));
    const { sift } = await fresh();
    const r = await sift("text with no checkable claims");
    expect(r.claims).toEqual([]);
    expect(r.verifiedRatio).toBe(0);
    expect(r.degraded).toBe(false);
  });
});

describe("methodology-verifier — FINER scorer", () => {
  it("returns 5-dimension scores with overall = mean", async () => {
    nimChatMock.mockResolvedValueOnce(FINER_WELL_FORMED);
    const { finer } = await fresh();
    const r = await finer("Does intervention X reduce outcome Y in n=200?");
    expect(r.degraded).toBe(false);
    // (0.7 + 0.85 + 0.9 + 0.95 + 0.6) / 5 = 0.8
    expect(r.overall).toBeCloseTo(0.8, 5);
    expect(r.feasible.score).toBe(0.7);
    expect(r.ethical.rationale).toContain("IRB");
  });

  it("returns degraded on empty question", async () => {
    const { finer } = await fresh();
    const r = await finer("");
    expect(r.degraded).toBe(true);
    expect(nimChatMock).not.toHaveBeenCalled();
  });

  it("returns degraded on malformed model output", async () => {
    nimChatMock.mockResolvedValueOnce("not json");
    const { finer } = await fresh();
    const r = await finer("question?");
    expect(r.degraded).toBe(true);
  });
});

describe("methodology-verifier — orchestrator", () => {
  it("runs CRAAP + SIFT by default; overall = mean of non-degraded sub-scores", async () => {
    nimChatMock
      .mockResolvedValueOnce(CRAAP_WELL_FORMED)
      .mockResolvedValueOnce(SIFT_WELL_FORMED);
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text under audit");
    expect(r.craap).toBeDefined();
    expect(r.sift).toBeDefined();
    expect(r.finer).toBeUndefined();
    expect(r.degraded).toBe(false);
    // CRAAP overall 0.8, SIFT verifiedRatio 0.5 → mean 0.65
    expect(r.overall).toBeCloseTo(0.65, 5);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("runs FINER when researchQuestion is provided", async () => {
    nimChatMock
      .mockResolvedValueOnce(CRAAP_WELL_FORMED)
      .mockResolvedValueOnce(SIFT_WELL_FORMED)
      .mockResolvedValueOnce(FINER_WELL_FORMED);
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text under audit", {
      researchQuestion: "Does X cause Y?",
    });
    expect(r.finer).toBeDefined();
    // (0.8 + 0.5 + 0.8) / 3 ≈ 0.7
    expect(r.overall).toBeCloseTo(0.7, 5);
  });

  it("can skip CRAAP via options.craap=false", async () => {
    nimChatMock.mockResolvedValueOnce(SIFT_WELL_FORMED);
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text", { craap: false });
    expect(r.craap).toBeUndefined();
    expect(r.sift).toBeDefined();
    expect(nimChatMock).toHaveBeenCalledTimes(1);
  });

  it("can skip SIFT via options.sift=false", async () => {
    nimChatMock.mockResolvedValueOnce(CRAAP_WELL_FORMED);
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text", { sift: false });
    expect(r.sift).toBeUndefined();
    expect(r.craap).toBeDefined();
    expect(nimChatMock).toHaveBeenCalledTimes(1);
  });

  it("flags degraded=true when ANY requested sub-scorer fails", async () => {
    nimChatMock
      .mockResolvedValueOnce(CRAAP_WELL_FORMED)
      .mockRejectedValueOnce(new Error("SIFT down"));
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text");
    expect(r.degraded).toBe(true);
    // CRAAP still contributes to overall
    expect(r.overall).toBeCloseTo(0.8, 5);
  });

  it("fails closed under kill-switch — no scorer is invoked when budgetCheckpoint throws", async () => {
    budgetCheckpointMock.mockRejectedValueOnce(
      new Error("kill switch tripped"),
    );
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text");
    expect(r.degraded).toBe(true);
    expect(r.overall).toBe(0.5);
    expect(nimChatMock).not.toHaveBeenCalled();
  });

  it("returns overall=0.5 + degraded=true when EVERY sub-scorer fails", async () => {
    nimChatMock
      .mockRejectedValueOnce(new Error("CRAAP down"))
      .mockRejectedValueOnce(new Error("SIFT down"));
    const { methodologyVerify } = await fresh();
    const r = await methodologyVerify("text");
    expect(r.degraded).toBe(true);
    expect(r.overall).toBe(0.5);
  });

  it("runs scorers in parallel (single Promise.all dispatch)", async () => {
    // Resolve both with controllable timing — they must both START
    // before either resolves. We assert this by counting calls at
    // the moment the first one resolves.
    let craapStarted = false;
    let siftStarted = false;
    nimChatMock.mockImplementationOnce(async () => {
      craapStarted = true;
      // Wait a microtask for SIFT to also have been dispatched.
      await new Promise((r) => setTimeout(r, 0));
      expect(siftStarted).toBe(true);
      return CRAAP_WELL_FORMED;
    });
    nimChatMock.mockImplementationOnce(async () => {
      siftStarted = true;
      return SIFT_WELL_FORMED;
    });
    const { methodologyVerify } = await fresh();
    await methodologyVerify("text");
    expect(craapStarted).toBe(true);
    expect(siftStarted).toBe(true);
  });
});

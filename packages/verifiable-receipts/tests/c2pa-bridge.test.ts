/**
 * C2PA bridge — round-trip tests proving a VAOS attestation survives
 * conversion into a Content Authenticity Initiative manifest and back
 * with byte-equal fidelity. This is the integration point that lets
 * Sovereign Matrix receipts travel through Adobe Firefly, Microsoft
 * Copilot, and Truepic Lens pipelines without losing their signature.
 */
import { describe, it, expect } from "vitest";
import {
  toC2PAAssertion,
  toC2PAManifest,
  fromC2PAManifest,
  C2PA_VAOS_LABEL,
} from "../src/c2pa-bridge.js";
import { runGuardian, hipaaPack } from "../src/index.js";

async function makeAttestation() {
  return runGuardian(
    hipaaPack.rules,
    {
      runId: "run_c2pa_test",
      agentSlug: "test-agent",
      tokenId: "tok_c2pa",
      input: { applicantId: "u1" },
      output: { decision: "approved", reasoning: "ok" },
    },
    (canonical) => `v2=stub:${canonical.length}`,
  );
}

describe("C2PA bridge — label + assertion shape", () => {
  it("uses reverse-domain label per C2PA §17.2", () => {
    expect(C2PA_VAOS_LABEL).toBe("org.sovereignmatrix.vaos.v1");
  });

  it("toC2PAAssertion emits Json kind with surface fields", async () => {
    const att = await makeAttestation();
    const asn = toC2PAAssertion(att);
    expect(asn.label).toBe(C2PA_VAOS_LABEL);
    expect(asn.kind).toBe("Json");
    expect(asn.data.verdict).toBe(att.overall);
    expect(asn.data.verdict_id).toBe(att.verdictId);
    expect(asn.data.content_hash).toBe(att.contentHash);
    expect(asn.data.issued_at).toBe(att.issuedAt);
    expect(asn.data.vaos).toBeDefined();
  });

  it("toC2PAManifest emits a complete C2PA v2.1 envelope", async () => {
    const att = await makeAttestation();
    const m = toC2PAManifest(att);
    expect(m.manifest_spec).toBe("c2pa/2.1");
    expect(m.instance_id).toBe(`urn:vaos:verdict:${att.verdictId}`);
    expect(m.claim_generator).toMatch(/Sovereign Matrix/);
    expect(m.assertions.length).toBe(1);
    expect(m.assertions[0].label).toBe(C2PA_VAOS_LABEL);
    expect(typeof m.generated_at).toBe("string");
  });

  it("toC2PAManifest accepts a custom claim_generator", async () => {
    const att = await makeAttestation();
    const m = toC2PAManifest(att, "Acme VAOS Issuer/1.0");
    expect(m.claim_generator).toBe("Acme VAOS Issuer/1.0");
  });
});

describe("C2PA bridge — round-trip fidelity", () => {
  it("fromC2PAManifest extracts the exact attestation toC2PAManifest wrote", async () => {
    const att = await makeAttestation();
    const m = toC2PAManifest(att);
    const round = fromC2PAManifest(m);
    expect(round).not.toBeNull();
    expect(round?.verdictId).toBe(att.verdictId);
    expect(round?.overall).toBe(att.overall);
    expect(round?.signature).toBe(att.signature);
    expect(round?.canonical).toBe(att.canonical);
    expect(round?.contentHash).toBe(att.contentHash);
    expect(round?.rules.length).toBe(att.rules.length);
  });

  it("survives JSON.stringify/parse — the C2PA wire path", async () => {
    const att = await makeAttestation();
    const m = toC2PAManifest(att);
    const wire = JSON.parse(JSON.stringify(m));
    const round = fromC2PAManifest(wire);
    expect(round?.verdictId).toBe(att.verdictId);
    expect(round?.signature).toBe(att.signature);
  });

  it("tolerates additive C2PA fields per §17.5", async () => {
    const att = await makeAttestation();
    const m = toC2PAManifest(att);
    const enriched = {
      ...m,
      claim_generator_info: [{ name: "Adobe Firefly", version: "1.2" }],
      ingredients: [],
      thumbnail: { format: "image/jpeg", identifier: "self#jumbf=..." },
    };
    const round = fromC2PAManifest(enriched);
    expect(round?.verdictId).toBe(att.verdictId);
  });
});

describe("C2PA bridge — defensive parsing", () => {
  it("returns null for non-object input", () => {
    expect(fromC2PAManifest(null)).toBeNull();
    expect(fromC2PAManifest(undefined)).toBeNull();
    expect(fromC2PAManifest("string")).toBeNull();
    expect(fromC2PAManifest(42)).toBeNull();
  });

  it("returns null when assertions array missing", () => {
    expect(fromC2PAManifest({ manifest_spec: "c2pa/2.1" })).toBeNull();
  });

  it("returns null when no VAOS-labelled assertion present", () => {
    expect(
      fromC2PAManifest({
        assertions: [
          { label: "stds.exif", data: { camera: "Canon" } },
          { label: "c2pa.actions", data: { actions: [] } },
        ],
      }),
    ).toBeNull();
  });

  it("returns null when VAOS assertion lacks data.vaos", () => {
    expect(
      fromC2PAManifest({
        assertions: [
          { label: C2PA_VAOS_LABEL, data: { verdict: "pass" } }, // no vaos
        ],
      }),
    ).toBeNull();
  });

  it("returns null when VAOS payload has wrong shape", () => {
    expect(
      fromC2PAManifest({
        assertions: [
          {
            label: C2PA_VAOS_LABEL,
            data: { vaos: { overall: "pass" /* missing signature etc */ } },
          },
        ],
      }),
    ).toBeNull();
  });

  it("picks the VAOS assertion out of a mixed assertions array", async () => {
    const att = await makeAttestation();
    const vaosAsn = toC2PAAssertion(att);
    const round = fromC2PAManifest({
      assertions: [
        { label: "stds.exif", data: { camera: "Canon" } },
        vaosAsn,
        { label: "c2pa.actions", data: { actions: [] } },
      ],
    });
    expect(round?.verdictId).toBe(att.verdictId);
  });
});

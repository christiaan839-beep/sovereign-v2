/**
 * Tests for src/lib/opentimestamps — OTS notarization client.
 *
 * Network calls are stubbed via a fetch mock so the suite is offline-
 * deterministic. Properties pinned:
 *   - digestForReceipt produces 32 hex bytes (SHA-256)
 *   - notarizeReceipt POSTs the digest as 32-byte octet-stream body
 *   - notarizeReceipt round-robins across calendars on failure
 *   - notarizeReceipt returns ok:false (never throws) on all-fail
 *   - First-success-wins: subsequent calendars not hit after one returns OK
 *   - refreshAttestation upgrades pending → bitcoin-confirmed when bytes grow
 *   - refreshAttestation returns the original on network failure
 *   - 0-calendar config returns ok:false with explanation
 */

import { describe, it, expect, vi } from "vitest";
import {
  digestForReceipt,
  notarizeReceipt,
  refreshAttestation,
} from "@/lib/opentimestamps";

const SIGNATURE =
  "v1=deadbeef0000000000000000000000000000000000000000000000000000beef";

describe("digestForReceipt", () => {
  it("produces a 64-char lowercase-hex SHA-256", () => {
    const d = digestForReceipt(SIGNATURE);
    expect(d).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(digestForReceipt(SIGNATURE)).toBe(digestForReceipt(SIGNATURE));
  });

  it("changes when the input changes by one character", () => {
    expect(digestForReceipt("v1=deadbeef")).not.toBe(
      digestForReceipt("v1=deadbeefa"),
    );
  });
});

describe("notarizeReceipt", () => {
  it("POSTs a 32-byte octet-stream body to /digest", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    const res = await notarizeReceipt(SIGNATURE, {
      calendars: ["https://cal.example.com"],
      fetch: fetchMock as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://cal.example.com/digest");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as Buffer;
    expect(body.length).toBe(32); // SHA-256 = 32 bytes
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/octet-stream",
    });
  });

  it("returns ok:true with attestation containing base64-encoded raw bytes", async () => {
    const otsBytes = new Uint8Array([0x4f, 0x70, 0x65, 0x6e]); // "Open"
    const fetchMock = vi.fn(
      async () => new Response(otsBytes, { status: 200 }),
    );
    const res = await notarizeReceipt(SIGNATURE, {
      calendars: ["https://cal.example.com"],
      fetch: fetchMock as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.attestation?.attestationBase64).toBe(
      Buffer.from(otsBytes).toString("base64"),
    );
    expect(res.attestation?.calendar).toBe("https://cal.example.com");
    expect(res.attestation?.status).toBe("pending");
    expect(res.attestation?.digest).toBe(digestForReceipt(SIGNATURE));
  });

  it("falls through to the next calendar on first failure", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) return new Response("nope", { status: 503 });
      return new Response(new Uint8Array([1, 2]), { status: 200 });
    });
    const res = await notarizeReceipt(SIGNATURE, {
      calendars: [
        "https://cal-a.example.com",
        "https://cal-b.example.com",
        "https://cal-c.example.com",
      ],
      fetch: fetchMock as typeof fetch,
    });
    expect(res.ok).toBe(true);
    // First-success-wins: 2 calls (1st failed, 2nd succeeded)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns ok:false (does not throw) when all calendars fail", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 503 }));
    const res = await notarizeReceipt(SIGNATURE, {
      calendars: ["https://cal-a.example.com", "https://cal-b.example.com"],
      fetch: fetchMock as typeof fetch,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns ok:false (does not throw) when fetch itself rejects", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await notarizeReceipt(SIGNATURE, {
      calendars: ["https://cal.example.com"],
      fetch: fetchMock as typeof fetch,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ECONNREFUSED/);
  });

  it("returns ok:false with no calendars configured", async () => {
    const res = await notarizeReceipt(SIGNATURE, { calendars: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no calendar/i);
  });
});

describe("refreshAttestation", () => {
  it("upgrades to bitcoin-confirmed when bytes grow significantly", async () => {
    const original = {
      digest: "a".repeat(64),
      calendar: "https://cal.example.com",
      attestationBase64: Buffer.from(new Uint8Array([1, 2])).toString("base64"),
      receivedAt: "2026-05-10T00:00:00Z",
      status: "pending" as const,
    };
    // Bigger response (>100 bytes) → treated as upgraded
    const upgraded = new Uint8Array(150).fill(0xab);
    const fetchMock = vi.fn(
      async () => new Response(upgraded, { status: 200 }),
    );
    const result = await refreshAttestation(original, {
      fetch: fetchMock as typeof fetch,
    });
    expect(result.status).toBe("bitcoin-confirmed");
    expect(result.attestationBase64).toBe(
      Buffer.from(upgraded).toString("base64"),
    );
  });

  it("keeps status pending when bytes are unchanged", async () => {
    const original = {
      digest: "a".repeat(64),
      calendar: "https://cal.example.com",
      attestationBase64: Buffer.from(new Uint8Array([1, 2])).toString("base64"),
      receivedAt: "2026-05-10T00:00:00Z",
      status: "pending" as const,
    };
    const sameBytes = new Uint8Array([1, 2]);
    const fetchMock = vi.fn(
      async () => new Response(sameBytes, { status: 200 }),
    );
    const result = await refreshAttestation(original, {
      fetch: fetchMock as typeof fetch,
    });
    expect(result.status).toBe("pending");
  });

  it("returns original on network failure", async () => {
    const original = {
      digest: "a".repeat(64),
      calendar: "https://cal.example.com",
      attestationBase64: "AQI=",
      receivedAt: "2026-05-10T00:00:00Z",
      status: "pending" as const,
    };
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await refreshAttestation(original, {
      fetch: fetchMock as typeof fetch,
    });
    expect(result).toBe(original);
  });
});

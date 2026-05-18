/**
 * SOVEREIGN MATRIX — Audit-log Bitcoin anchor (audit-2026-05 elite).
 *
 * Composes Cook 179 (hash-chained audit logs) with the OpenTimestamps
 * public calendars to produce a daily Bitcoin-anchored attestation of
 * the audit-log chain head.
 *
 * Threat model addressed:
 *   - Operator deletes / rewrites the audit log after the fact.
 *     The OTS proof binds the chain head's SHA-256 to a Bitcoin block.
 *     Once the block confirms, the head — and every row it transitively
 *     depends on — is unforgeable: rewriting any row breaks the chain;
 *     replacing the chain head breaks the OTS proof; replacing the OTS
 *     proof requires re-mining Bitcoin from the block the calendars
 *     aggregated into.
 *
 * Protocol shape:
 *   1. Compute SHA-256 over the latest `chainDigest(rows)` (Cook 179).
 *   2. POST it to the configured OTS calendar URLs in parallel.
 *      Each calendar returns an opaque proof blob (the "pending proof")
 *      that includes Merkle-path commitments and a callback URL the
 *      calendar will use once the aggregated root hits the chain.
 *   3. Persist {hexDigest, calendarProofs[], submittedAt} so a verifier
 *      can later upgrade the pending proofs to fully-confirmed proofs.
 *
 * This module is the orchestrator. The actual HTTP submit is injected
 * (`OtsClient.submit`) so tests don't talk to the public network — and
 * so an operator who runs an in-house calendar can swap it in.
 *
 * Pairs with /api/cron/audit-log-anchor (run daily on Vercel cron) and
 * /api/auditor/anchor (public read-side verifier).
 */

import { createHash } from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit-log-anchor");

/** Public OpenTimestamps calendars. Reference list. */
export const DEFAULT_OTS_CALENDARS = [
  "https://alice.btc.calendar.opentimestamps.org",
  "https://bob.btc.calendar.opentimestamps.org",
  "https://finney.calendar.eternitywall.com",
] as const;

/** Calendar client — submit a 32-byte digest, get a pending OTS proof. */
export interface OtsClient {
  /** Stable identifier — usually the host of the calendar URL. */
  name: string;
  /**
   * Submit a hex-encoded SHA-256 digest to the calendar. Returns the
   * opaque pending-proof blob (base64) that aggregates the digest into
   * the calendar's Merkle tree.
   */
  submit: (sha256Hex: string) => Promise<string>;
}

export interface AnchorAttestation {
  /** Hex SHA-256 of the audit-log chain head (the input to anchoring). */
  digest: string;
  /** Per-calendar proof blobs (base64). May be partial if some failed. */
  proofs: Array<{
    calendar: string;
    proof: string;
    submittedAt: string;
  }>;
  /** Calendars that rejected the submission. */
  failures: Array<{ calendar: string; reason: string }>;
  /** Iso timestamp the anchor batch was issued. */
  attestedAt: string;
  /** True iff at least one calendar accepted (best-effort quorum). */
  ok: boolean;
}

/**
 * Anchor a chain head into Bitcoin via the OpenTimestamps calendars.
 *
 * Caller hands in:
 *   - `chainHead`: the value returned by `chainDigest(rows)` from
 *     src/lib/audit-log-integrity.ts. Must be 64-char hex.
 *   - `clients`: a list of `OtsClient` implementations. When empty,
 *     returns `ok: false` with no proofs.
 *
 * Fan-out is parallel — slow/failing calendars never block the rest.
 * Returns a structured `AnchorAttestation` the caller can persist.
 */
export async function anchorChainHead(
  chainHead: string,
  clients: OtsClient[],
): Promise<AnchorAttestation> {
  if (!/^[0-9a-f]{64}$/i.test(chainHead)) {
    throw new Error("anchorChainHead: chainHead must be 64-char hex");
  }
  const attestedAt = new Date().toISOString();
  if (clients.length === 0) {
    return {
      digest: chainHead,
      proofs: [],
      failures: [],
      attestedAt,
      ok: false,
    };
  }

  const results = await Promise.all(
    clients.map(async (c) => {
      try {
        const proof = await c.submit(chainHead);
        return { ok: true as const, calendar: c.name, proof };
      } catch (err) {
        return {
          ok: false as const,
          calendar: c.name,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const proofs: AnchorAttestation["proofs"] = [];
  const failures: AnchorAttestation["failures"] = [];
  for (const r of results) {
    if (r.ok) {
      proofs.push({
        calendar: r.calendar,
        proof: r.proof,
        submittedAt: attestedAt,
      });
    } else {
      failures.push({ calendar: r.calendar, reason: r.reason });
    }
  }

  if (failures.length > 0) {
    log.warn("Some OTS calendars rejected the audit-log anchor", {
      failures: failures.map((f) => f.calendar),
      ok: proofs.length > 0,
    });
  }

  return {
    digest: chainHead,
    proofs,
    failures,
    attestedAt,
    ok: proofs.length > 0,
  };
}

/**
 * Default OTS client implementation — POSTs the 32-byte digest to a
 * standard public calendar endpoint. The calendar protocol is documented
 * at https://github.com/opentimestamps/python-opentimestamps; this is the
 * minimal wire shape every public calendar speaks.
 *
 * Caller supplies a `fetchImpl` for hermetic testing. Defaults to the
 * platform fetch.
 */
export function makeOtsCalendarClient(
  calendarUrl: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): OtsClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  return {
    name: calendarUrl,
    submit: async (sha256Hex: string): Promise<string> => {
      const bytes = Buffer.from(sha256Hex, "hex");
      if (bytes.length !== 32) {
        throw new Error(`OTS digest must be 32 bytes (got ${bytes.length})`);
      }
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(
          `${calendarUrl.replace(/\/$/, "")}/digest`,
          {
            method: "POST",
            signal: ctl.signal,
            headers: {
              "content-type": "application/vnd.opentimestamps.v1",
              accept: "application/vnd.opentimestamps.v1",
            },
            body: bytes,
          },
        );
        if (!res.ok) {
          throw new Error(`calendar HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        return Buffer.from(buf).toString("base64");
      } finally {
        clearTimeout(t);
      }
    },
  };
}

/**
 * Compute the SHA-256 of an arbitrary string. Useful when the caller
 * has the chain head string but wants a stable "anchor digest" — the
 * OTS calendars require exactly 32 bytes, so we hash again to normalize.
 */
export function digestForAnchor(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

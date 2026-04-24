/**
 * /platform/verify — public attestation verifier.
 *
 * Paste a signed invocation attestation (JSON), click Verify, see the
 * cryptographic verdict. The server is a thin HTTP wrapper around the
 * same verification library auditors run offline with the public key
 * at /api/platform/public-key.
 *
 * No auth required. Rate-limited 60/min/IP.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { VerifyClient } from "./VerifyClient";

export const metadata: Metadata = {
  title: "Verify attestation — Sovereign Matrix",
  description:
    "Paste a signed invocation attestation, get a cryptographic verdict. Third-party-verifiable proof that an agent produced an output for an input.",
};

export default function Page() {
  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-4xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/platform/trust"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Platform trust
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Attestation verifier
          </p>
          <h1
            className="ed-display text-5xl mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            Verify any invocation proof
          </h1>
          <p
            className="ed-body max-w-2xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Every agent invocation on Sovereign Matrix can be cryptographically
            attested. Paste the attestation JSON below to verify the signature —
            or run the same verification fully offline against our public key at{" "}
            <Link
              href="/api/platform/public-key"
              className="ed-mono text-sm underline hover:text-[var(--ed-copper)]"
            >
              /api/platform/public-key
            </Link>
            .
          </p>
        </header>

        <VerifyClient />

        {/* How-to block */}
        <section className="mt-14 pt-8" style={{ borderTop: "1px solid var(--ed-rule)" }}>
          <h2 className="ed-label mb-5">How verification works</h2>
          <ol className="space-y-3 ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
            <li className="flex gap-3">
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                01
              </span>
              <span>
                Every invocation response carries an{" "}
                <code className="ed-mono">attestation</code> object — a signed
                record of <code className="ed-mono">{"{ agentId, inputHash, outputHash, modelUsed, timestamp, slaVerdict }"}</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                02
              </span>
              <span>
                The signature is <code className="ed-mono">ed25519</code>, using
                the platform&rsquo;s private key.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                03
              </span>
              <span>
                The platform&rsquo;s public key is published at{" "}
                <code className="ed-mono">/api/platform/public-key</code>. Anyone
                can fetch it once and verify all future attestations offline.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                04
              </span>
              <span>
                Hashes (not plaintext) are signed — so you prove WHAT ran without
                needing to share the sensitive inputs/outputs.
              </span>
            </li>
          </ol>
        </section>

        <footer
          className="mt-10 pt-6 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/platform/trust"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Security + compliance posture →
          </Link>
          <Link
            href="/spec/agent-manifest"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            SAM v1.0 specification →
          </Link>
          <Link
            href="/api/platform/public-key"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Public key JSON →
          </Link>
        </footer>
      </div>
    </div>
  );
}

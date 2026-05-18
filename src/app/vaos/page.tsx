import type { Metadata } from "next";
import Link from "next/link";
import {
  Globe2,
  KeyRound,
  ScrollText,
  Mail,
  GitPullRequest,
  ArrowRight,
} from "lucide-react";
import { getIssuerRegistry } from "@/lib/vaos-issuers";

export const metadata: Metadata = {
  title: "VAOS Adoption Registry — Sovereign Matrix",
  description:
    "Public registry of issuers using the Verifiable Agent Output Specification (VAOS). The CA root store for AI agent receipts. CC0 public-domain spec; Apache-2.0 reference implementation.",
  openGraph: {
    title: "VAOS — Verifiable Agent Output Specification",
    description:
      "Who is signing AI agent receipts with VAOS today, plus how to adopt.",
  },
};

// ISR — issuer registry changes via PR + commit; hourly cache is plenty.
export const revalidate = 3600;

/**
 * /vaos — public adoption registry page.
 *
 * The network-effect surface. Lists every VAOS issuer + their
 * pubkey URLs + supported schemes. Anyone adopting the wire format
 * gets a listing here. Verifiers + procurement automation can pin
 * trust against this list (or the JSON sibling at
 * /.well-known/sovereign-receipts/issuers.json).
 */
export default function VaosPage() {
  const registry = getIssuerRegistry();
  const issuers = registry.issuers;

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          VAOS · ADOPTION REGISTRY · CC0 SPEC · APACHE-2.0 IMPL
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          The format,
          <br />
          <span className="text-[#B5532C]">in use.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-12">
          VAOS (Verifiable Agent Output Specification) is a public-domain wire
          format for cryptographically-signed AI agent receipts. This page is
          the live registry of issuers using it. Verifiers can pin trust against
          this list; new issuers can join via PR (see §3 below).
        </p>

        {/* The registry */}
        <section className="mb-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <Globe2 className="w-3 h-3" /> 01 · ACTIVE ISSUERS ({issuers.length}
            )
          </p>
          <div className="space-y-3">
            {issuers.map((issuer) => (
              <div
                key={issuer.id}
                className="p-5 border border-cyan-500/20 bg-cyan-500/[0.03] rounded-[3px]"
              >
                <div className="flex flex-wrap items-baseline gap-3 mb-2">
                  <span className="font-mono text-[14px] text-cyan-300">
                    {issuer.name}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase">
                    {issuer.country}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    since {issuer.activeSince}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[#E08558] tracking-[0.15em]">
                    {issuer.schemes.join(" · ")}
                  </span>
                </div>
                {issuer.note && (
                  <p className="text-[13px] text-neutral-300 leading-[1.55] mb-3">
                    {issuer.note}
                  </p>
                )}
                <dl className="space-y-1 text-[11px] font-mono">
                  <KvLine label="id" value={issuer.id} />
                  <KvLine label="home" value={issuer.homepage} link />
                  <KvLine
                    label="ed25519 pubkey"
                    value={issuer.ed25519PublicKeyUrl}
                    link
                  />
                  {issuer.mldsa65PublicKeyUrl && (
                    <KvLine
                      label="ml-dsa-65 pubkey"
                      value={issuer.mldsa65PublicKeyUrl}
                      link
                    />
                  )}
                  {issuer.transparencyLogUrl && (
                    <KvLine
                      label="transparency log"
                      value={issuer.transparencyLogUrl}
                      link
                    />
                  )}
                  <KvLine
                    label="security contact"
                    value={issuer.securityContact}
                  />
                </dl>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 mt-4 leading-[1.65]">
            Machine-readable JSON at{" "}
            <Link
              href="/.well-known/sovereign-receipts/issuers.json"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /.well-known/sovereign-receipts/issuers.json
            </Link>{" "}
            (open CORS · 5-min cache). Procurement automation reads from there.
          </p>
        </section>

        {/* The format */}
        <section className="mb-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <ScrollText className="w-3 h-3" /> 02 · THE WIRE FORMAT
          </p>
          <div className="space-y-2 text-[14px] text-neutral-400 leading-[1.7]">
            <p>
              <span className="font-mono text-[#E08558] mr-2">VAOS 1.0</span>
              HMAC-SHA256 receipts — closed-loop, shared-secret. Backwards-
              compatible carry from VAOS-original.
            </p>
            <p>
              <span className="font-mono text-[#E08558] mr-2">VAOS 2.0</span>
              Ed25519 (RFC 8032) receipts — public-key. Any verifier with the
              issuer&apos;s PEM can confirm any receipt.
            </p>
            <p>
              <span className="font-mono text-[#E08558] mr-2">VAOS 3.0</span>
              Ed25519 + ML-DSA-65 dual-sign (NIST FIPS 204) — post-quantum
              forward-secure. Receipts stay verifiable across the
              cryptographically-relevant quantum computer transition.
            </p>
          </div>
          <p className="text-[12px] text-neutral-500 leading-[1.65] mt-4">
            Specs (public domain, CC0):{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/docs/specs"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              docs/specs/
            </a>{" "}
            · IETF Internet-Draft:{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/draft-dewet-vaos-receipts-00.md"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              draft-dewet-vaos-receipts-00
            </a>
            .
          </p>
        </section>

        {/* How to adopt */}
        <section className="mb-12">
          <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
            <KeyRound className="w-3 h-3" /> 03 · HOW TO ADOPT
          </p>
          <ol className="space-y-3 text-[14px] text-neutral-400 leading-[1.7]">
            <li>
              <span className="font-mono text-[#E08558] mr-3">01</span>
              Generate an Ed25519 keypair. Store the secret in an HSM / KMS.
              Publish the public key at{" "}
              <code className="text-neutral-300 text-[12px]">
                /.well-known/sovereign-receipts/ed25519.pem
              </code>
              on your domain, with{" "}
              <code className="text-neutral-300 text-[12px]">
                Access-Control-Allow-Origin: *
              </code>
              .
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">02</span>
              Install the reference implementation:
              <pre className="bg-black/40 border border-white/[0.06] rounded-[3px] p-3 mt-2 overflow-x-auto text-[11px] text-cyan-300/90 font-mono">
                npm install @sovereign-matrix/verifiable-receipts
              </pre>
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">03</span>
              Wire{" "}
              <code className="text-neutral-300 text-[12px]">
                npx @sovereign-matrix/verifiable-receipts-sign
              </code>{" "}
              into your agent runtime — or use the in-process API from the same
              package.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">04</span>
              Open a PR adding your issuer entry to{" "}
              <code className="text-neutral-300 text-[12px]">
                src/lib/vaos-issuers.ts
              </code>
              . Include your domain, ed25519 pubkey URL, schemes you support,
              and a security contact.
            </li>
            <li>
              <span className="font-mono text-[#E08558] mr-3">05</span>
              (Optional, recommended) Stand up an inclusion-log + run the OSS
              witness CLI against ours so we co-witness each other&apos;s logs.
              Mutual verifiability scales the trust network.
            </li>
          </ol>
        </section>

        {/* Why a regulated buyer should ask for VAOS */}
        <section className="mb-12 p-5 border border-white/[0.06] bg-white/[0.015] rounded-[3px]">
          <p className="font-mono text-[10px] text-neutral-500 tracking-[0.2em] uppercase mb-3">
            For procurement reviewers
          </p>
          <p className="text-[13px] text-neutral-400 leading-[1.7] mb-3">
            If your AI vendor doesn&apos;t support VAOS, you cannot
            independently verify their audit claims. With VAOS adoption in your
            RFP template, every shortlisted vendor commits to a wire format you
            (or a third-party auditor) can verify without their cooperation.
          </p>
          <p className="text-[12px] text-neutral-500 leading-[1.65]">
            RFP language draft:{" "}
            <em className="not-italic text-neutral-300">
              &ldquo;Vendor MUST sign every AI agent output with VAOS 2.0 or
              higher, publish the verification key at the well-known URL, and
              provide a transparency-log endpoint compliant with RFC 6962-style
              inclusion + consistency proofs. Receipts retained past 5 years
              MUST use VAOS 3.0 dual-signing.&rdquo;
            </em>
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] pt-10">
          <h2 className="font-serif text-2xl text-white mb-3">
            Want your name on this list?
          </h2>
          <p className="text-[14px] text-neutral-400 leading-[1.65] mb-6 max-w-2xl">
            We&apos;ll review your PR within 48 hours. There&apos;s no cost, no
            certification fee, no membership. The only bar is that the published
            public key works and the issuer is reachable at the security contact
            email.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/src/lib/vaos-issuers.ts"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#B5532C] text-white text-[13px] font-mono tracking-[0.1em] rounded-[3px] hover:bg-[#C96234] transition-colors"
            >
              <GitPullRequest className="w-4 h-4" />
              Open a PR
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="mailto:spec@sovereignmatrix.agency?subject=VAOS%20adoption%20enquiry"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/15 text-neutral-300 hover:text-white hover:border-white/30 text-[13px] font-mono rounded-[3px] transition-colors"
            >
              <Mail className="w-4 h-4" />
              Ask first
            </a>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/spec"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /spec
            </Link>{" "}
            (the wire format),{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>{" "}
            (live STH),{" "}
            <Link
              href="/security/live"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /security/live
            </Link>{" "}
            (machine-readable evidence). Registry source:{" "}
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/src/lib/vaos-issuers.ts"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              src/lib/vaos-issuers.ts
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

function KvLine({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2">
      <dt className="text-neutral-500 tracking-[0.1em] uppercase">{label}</dt>
      <dd className="text-neutral-300 break-all">
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-cyan-300 transition-colors"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

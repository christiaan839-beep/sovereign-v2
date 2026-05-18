/**
 * /spec — Verifiable Agent Output Specification 1.0 landing page.
 *
 * The marketing surface for VAOS — the open standard the platform
 * just proposed. Three jobs:
 *   1. Explain what the spec is + why it exists in 30 seconds
 *   2. Let visitors download the spec + view the reference impl
 *   3. Make a credible "endorsing organizations" placeholder so we
 *      can fill it as endorsements arrive
 *
 * Server-rendered for SEO (the spec needs to rank for "verifiable AI
 * receipts," "AI agent audit standard," "POPIA AI compliance").
 */

import Link from "next/link";
import {
  Shield,
  FileText,
  Code2,
  Github,
  ArrowRight,
  CheckCircle2,
  Download,
  Lock,
  Globe,
} from "lucide-react";

export const metadata = {
  title: "VAOS 1.0 — Verifiable Agent Output Specification | Sovereign Matrix",
  description:
    "Open standard for cryptographically signed AI agent receipts. Public-domain spec, MIT-licensed reference implementation. Built for EU AI Act, POPIA, GDPR, and SOC2 audit-trail requirements.",
  openGraph: {
    title: "VAOS 1.0 — Verifiable Agent Output Specification",
    description:
      "The open standard for cryptographically signed AI agent receipts. CC0 spec, MIT verifier.",
    type: "article",
  },
};

export default function SpecPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Back link */}
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        {/* Hero */}
        <header className="mb-14">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-cyan-300">
            <Globe className="h-3 w-3" />
            Open Standard · CC0
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-7xl">
            VAOS 1.0
          </h1>
          <p className="mt-3 font-serif text-2xl text-neutral-300 md:text-3xl">
            Verifiable Agent Output Specification
          </p>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-neutral-400">
            An open, public-domain specification for cryptographically signed AI
            agent receipts. Any party — auditor, customer, regulator — can
            confirm what an agent did, with which inputs, against which safety
            checks,{" "}
            <em className="not-italic text-neutral-200">
              without trusting the platform that produced it.
            </em>
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/spec/vaos-1.0.md"
              download="vaos-1.0.md"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              <Download className="h-4 w-4" />
              Download spec (markdown)
            </a>
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/vaos-verifier"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/10"
            >
              <Github className="h-4 w-4" />
              Reference implementation (MIT)
            </a>
            <Link
              href="/verified"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-neutral-300 transition hover:bg-white/10"
            >
              See it live
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* VAOS family — versions live alongside 1.0 */}
          <div className="mt-10 rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
              The VAOS family
            </p>
            <ul className="space-y-2 text-[14px] text-neutral-300">
              <li className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-cyan-300">VAOS 1.0</span>
                <span className="text-neutral-500">·</span>
                <span>HMAC-SHA256 receipts — shared-secret verification.</span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-cyan-300">VAOS 2.0</span>
                <span className="text-neutral-500">·</span>
                <span>
                  Ed25519 receipts — public-key verifiable.{" "}
                  <a
                    href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/vaos-2.0.md"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40 hover:text-cyan-200"
                  >
                    Read the spec →
                  </a>
                </span>
              </li>
              <li className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[#E08558]">VAOS 3.0</span>
                <span className="text-neutral-500">·</span>
                <span>
                  Ed25519 + ML-DSA-65 dual-sign — post-quantum forward-secure
                  (FIPS 204).{" "}
                  <a
                    href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/specs/vaos-3.0.md"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-cyan-300 underline underline-offset-4 decoration-cyan-500/40 hover:text-cyan-200"
                  >
                    Read the spec →
                  </a>
                </span>
              </li>
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
              The reference implementation of v2 + v3 is the Apache-2.0 package{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-neutral-300">
                @sovereign-matrix/verifiable-receipts
              </code>
              . It ships a CLI verifier and a frozen{" "}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-neutral-300">
                SPEC.md
              </code>{" "}
              with every published version — so any auditor in 2040 can install
              the same version, fetch the public key, and independently
              re-derive the math.
            </p>
          </div>
        </header>

        {/* Why */}
        <section className="mb-14">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Why this exists
          </h2>
          <p className="mb-4 text-[17px] leading-relaxed text-neutral-300">
            Every enterprise blocking AI deployment cites the same reason:{" "}
            <em className="not-italic text-white">
              &ldquo;I can&apos;t prove what the model did, so I can&apos;t put
              it anywhere that matters.&rdquo;
            </em>{" "}
            Frontier labs make models smarter. Nobody&apos;s making agent
            outputs auditable. VAOS closes that gap with a single primitive:
            every output is signed by the issuing platform over a deterministic
            canonical projection of its inputs, model, safety checks, and
            outputs.
          </p>
          <p className="text-[17px] leading-relaxed text-neutral-400">
            A reader holding the receipt can recompute the canonical projection
            and verify the signature against the platform&apos;s public
            verification endpoint —{" "}
            <em className="not-italic text-neutral-200">
              without the platform sharing its signing key.
            </em>{" "}
            Same trust model as TLS / Let&apos;s Encrypt, applied to AI outputs.
          </p>
        </section>

        {/* Three pillars */}
        <section className="mb-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Pillar
            Icon={Lock}
            title="Tamper-evident"
            body="Ed25519 / ML-DSA-65 dual-sign over a byte-deterministic canonical projection. A single byte changed in input/output/safety = signature mismatch. HMAC-SHA256 supported as a legacy v1 path for closed-loop deployments."
          />
          <Pillar
            Icon={Globe}
            title="Cross-platform verifiable"
            body="Any party with the public verifier endpoint can confirm authenticity. No platform lock-in. Works across vendors."
          />
          <Pillar
            Icon={CheckCircle2}
            title="Compliance-ready"
            body="Built to satisfy EU AI Act Art. 12, POPIA s. 71, GDPR Art. 22 traceability requirements out of the box."
          />
        </section>

        {/* Quick start */}
        <section className="mb-14">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Verify any VAOS receipt in 3 lines
          </h2>
          <pre className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/60 p-5 font-mono text-[13px] leading-relaxed text-cyan-200">
            {`import { verifyRemote } from "@sovereign-matrix/vaos-verifier";

const receipt = await fetch(receiptUrl).then(r => r.json());
const { valid } = await verifyRemote(receipt, { baseUrl: issuerUrl });`}
          </pre>
          <p className="mt-3 text-xs text-neutral-500">
            Zero dependencies. Node 18+, browsers, edge runtimes, Deno. MIT
            license — drop into any project.
          </p>
        </section>

        {/* Spec at a glance */}
        <section className="mb-14 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
          <div className="border-b border-white/[0.06] px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-medium text-white">
              <FileText className="h-4 w-4 text-cyan-300" />
              Spec at a glance
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/[0.04]">
                <Row
                  k="Algorithm"
                  v="Ed25519 (RFC 8032) over canonical JSON. ML-DSA-65 (FIPS 204) dual-sign for v3. HMAC-SHA256 supported as legacy v1."
                />
                <Row
                  k="Signature envelope"
                  v={`v1=<hex-HMAC> | v2=<base64-Ed25519> | v3=<base64-Ed25519>.<base64-ML-DSA-65>`}
                />
                <Row
                  k="Canonicalization"
                  v="Top-level field order locked; nested object keys recursively sorted; arrays preserve element order"
                />
                <Row
                  k="Verification endpoint"
                  v="POST /api/verify (open CORS, no auth)"
                />
                <Row
                  k="Threat model"
                  v="Tamper detection · cross-origin verifiability · NOT non-repudiation (extension planned in v2)"
                />
                <Row k="License" v="CC0 1.0 (spec) · MIT (reference impl)" />
                <Row k="Status" v="Draft — open for comment" />
              </tbody>
            </table>
          </div>
        </section>

        {/* Endorsers */}
        <section className="mb-14">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Endorsing organizations
          </h2>
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.01] p-8 text-center text-sm text-neutral-500">
            <Shield className="mx-auto mb-3 h-5 w-5 text-neutral-600" />
            <p>
              VAOS 1.0 is currently in open-comment phase. Endorsements from
              compliance bodies, audit firms, and AI infrastructure vendors
              arrive here as they are signed.
            </p>
            <p className="mt-2">
              Interested in endorsing or implementing?{" "}
              <a
                href="mailto:spec@sovereignmatrix.agency"
                className="text-cyan-300 underline-offset-2 hover:underline"
              >
                spec@sovereignmatrix.agency
              </a>
            </p>
          </div>
        </section>

        {/* Implementations */}
        <section className="mb-14">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Reference implementations
          </h2>
          <div className="space-y-3">
            <ImplCard
              name="@sovereign-matrix/vaos-verifier"
              lang="TypeScript"
              license="MIT"
              status="REFERENCE"
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/vaos-verifier"
              note="Pure TS + Web Crypto. Node 18+, browsers, edge, Deno. Zero dependencies."
            />
            <ImplCard
              name="POST /api/verify"
              lang="HTTP"
              license="—"
              status="LIVE"
              href="/api/verify"
              note="Public verification endpoint hosted by Sovereign Matrix. Open CORS, no auth, rate-limited 60 req/min per IP."
            />
            <ImplCard
              name="GET /api/verify/badge.svg?id=<receipt-id>"
              lang="SVG"
              license="—"
              status="LIVE"
              href="/api/verify/badge.svg"
              note="Drop-in shields-style badge for READMEs. Live signature check on every request."
            />
            <ImplCard
              name="<SovereignBadge id='...' />"
              lang="React"
              license="MIT"
              status="REFERENCE"
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/src/sdk/react"
              note="Drop-in React component. SSR-safe. Light + dark themes."
            />
            <ImplCard
              name="npx @sovereign-matrix/agent-sdk verify <id>"
              lang="CLI"
              license="MIT"
              status="REFERENCE"
              href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/cli"
              note="One-command third-party verification. Pretty + --json modes. Proper exit codes for shell pipelines."
            />
          </div>
        </section>

        {/* Footer CTA */}
        <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] to-transparent p-8 text-center backdrop-blur-xl">
          <Code2 className="mx-auto mb-3 h-6 w-6 text-cyan-300" />
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Implementing VAOS in your platform?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400">
            We&apos;ll list you here, link your implementation, and
            cross-promote. The format becomes more valuable to everyone as more
            parties adopt it.
          </p>
          <a
            href="mailto:spec@sovereignmatrix.agency"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
          >
            spec@sovereignmatrix.agency
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>

        <p className="mt-12 text-center text-[11px] text-neutral-600">
          Specification published under CC0 1.0 (public domain). Implementations
          published under MIT.
        </p>
      </div>
    </div>
  );
}

function Pillar({
  Icon,
  title,
  body,
}: {
  Icon: typeof Shield;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl">
      <Icon className="mb-3 h-5 w-5 text-cyan-300" />
      <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-neutral-400">{body}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="px-6 py-3 align-top text-xs font-mono uppercase tracking-wider text-neutral-500 whitespace-nowrap">
        {k}
      </td>
      <td className="px-6 py-3 text-sm text-neutral-300">{v}</td>
    </tr>
  );
}

function ImplCard({
  name,
  lang,
  license,
  status,
  href,
  note,
}: {
  name: string;
  lang: string;
  license: string;
  status: "REFERENCE" | "LIVE";
  href: string;
  note: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-500/30 hover:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm text-white">{name}</code>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
          {lang}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
          {license}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
            status === "LIVE"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{note}</p>
    </a>
  );
}

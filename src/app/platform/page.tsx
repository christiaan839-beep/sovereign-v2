import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Platform · Sovereign Matrix — Agents as infrastructure, not a UI",
  description:
    "Build on Sovereign Matrix. 20-tool MCP package, open-source .agent.md spec, signed snapshot exports, 131 agents addressable by slug. For engineers who want AI agents as infrastructure.",
  alternates: { canonical: "https://sovereignmatrix.agency/platform" },
  openGraph: {
    title: "Sovereign Matrix — Platform for developers",
    description:
      "Agents, snapshots, benchmarks, and MCP distribution. All the primitives, none of the lock-in.",
    url: "https://sovereignmatrix.agency/platform",
    type: "website",
  },
};

/**
 * /platform — the DEVELOPER landing page.
 *
 * Strategic split from the operator homepage at /:
 *   - /         → Operators (SMB marketers running Lead Blitz).
 *                  Outcomes, not architecture. Pricing from $49.
 *   - /platform → Developers (MCP users, API callers, signed-snapshot
 *                  consumers). Primitives, not playbooks. Pricing
 *                  usage-based (future iteration); free API tier now.
 *
 * Why split: a single page tried to pitch both audiences and confused
 * each. Developers bounced off "25 playbooks, no code" messaging;
 * operators bounced off "signed snapshot + HMAC provenance."
 *
 * Both audiences share /trust, /trust/anthropic, /trust/defenders,
 * /benchmarks. Trust is trust regardless of who's buying.
 *
 * Visual: matches editorial system (bone-cream + copper + Instrument
 * Serif) so an operator clicking over from / doesn't feel like a
 * different company — same aesthetic, different message.
 */

export default function PlatformPage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      {/* ─── Editorial hero ─── */}
      <section className="max-w-5xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Platform · For engineers
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          Agents as <em className="text-[#B5532C] not-italic">infrastructure</em>,
          <br />
          not a UI.
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-3xl mb-8">
          Sovereign Matrix is a 131-agent platform addressable by slug
          — via REST, via MCP in Claude Code / Cline / Cursor, or via
          chained playbooks. Every run exports as a signed snapshot.
          Every provider cost is in our public benchmark leaderboard.
          The operator dashboard is optional. The primitives are the
          product.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="https://www.npmjs.com/package/@sovereignmatrix/mcp"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1712] text-[#F4EFE6] font-mono text-sm tracking-wide hover:bg-[#B5532C] transition-colors"
          >
            npm install @sovereignmatrix/mcp →
          </Link>
          <Link
            href="/developers/docs"
            className="inline-flex items-center px-6 py-3 border border-[#1A1712] text-[#1A1712] font-mono text-sm tracking-wide hover:bg-[#1A1712] hover:text-[#F4EFE6] transition-colors"
          >
            API docs →
          </Link>
        </div>
      </section>

      {/* ─── Primitives ─── */}
      <section className="mt-32 border-t border-[#D8CDB7] pt-12 max-w-5xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter I · Primitives
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-12">
          Four primitives. <em className="text-[#B5532C] not-italic">No lock-in.</em>
        </h2>

        <div className="grid md:grid-cols-2 gap-12">
          <Primitive
            number="01"
            title="MCP package"
            body="20 tools exposed as a Model Context Protocol server. Install once; agents appear in Claude Code / Cline / Cursor without a dashboard. Open-source, MIT-licensed."
            code="npm install -g @sovereignmatrix/mcp"
          />
          <Primitive
            number="02"
            title="REST API + 131 agents"
            body="Every agent addressable at /api/agents/<slug>. Zod-validated inputs, consistent response envelope, _meta.modelsConsulted so you always know which provider handled your request."
            code="POST /api/agents/leads"
          />
          <Primitive
            number="03"
            title="Signed snapshot export"
            body="Every run exports as a portable, SHA-256 checksummed, HMAC-signed JSON document. Any auditor verifies via /api/_replay/verify without a Sovereign account."
            code="GET /api/_replay/:id/snapshot"
          />
          <Primitive
            number="04"
            title=".agent.md resume spec"
            body="Every agent has a machine-readable resume at /api/agents/<slug>.agent.md. Open format, no authentication required. The discovery layer we published so other platforms can adopt."
            code="curl /api/agents/leads.agent.md"
          />
        </div>
      </section>

      {/* ─── Stance on transparency ─── */}
      <section className="mt-32 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter II · Transparency
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-8">
          You should know which models <em className="text-[#B5532C] not-italic">actually ran</em>.
        </h2>
        <div className="space-y-4 text-[15px] text-[#5C544A] leading-relaxed max-w-2xl mb-8">
          <p>
            Every agent response includes{" "}
            <code className="font-mono text-[13px] text-[#1A1712] px-1.5 py-0.5 bg-[#1A1712]/[0.04] rounded">
              _meta.modelsConsulted
            </code>{" "}
            and{" "}
            <code className="font-mono text-[13px] text-[#1A1712] px-1.5 py-0.5 bg-[#1A1712]/[0.04] rounded">
              _meta.providersConsulted
            </code>
            . No hidden routing. No &ldquo;powered by AI&rdquo;
            hand-waving.
          </p>
          <p>
            The public{" "}
            <Link href="/benchmarks" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
              /benchmarks
            </Link>{" "}
            leaderboard shows which providers actually get traffic
            in production, pulled hourly from the cost ledger. Not a
            PDF from last year.
          </p>
          <p>
            Claude sits in the consensus-critic position on every
            run. Evidence (not marketing copy):{" "}
            <Link href="/trust/anthropic" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
              /trust/anthropic
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ─── Security stance ─── */}
      <section className="mt-32 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter III · Security
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-8">
          We audit our own code. <em className="text-[#B5532C] not-italic">Then we publish what we find.</em>
        </h2>
        <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-2xl mb-6">
          On April 20, 2026 we ran a Claude-backed reviewer against
          our own v8 code. It found 8 real vulnerabilities, 2 of
          them critical. All fixed in 3 hours. Read the{" "}
          <Link href="/trust/defenders" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
            full case study
          </Link>{" "}
          with file-line references.
        </p>
        <p className="text-[15px] text-[#5C544A] leading-relaxed max-w-2xl mb-8">
          The same tooling is packaged as a reusable GitHub Action at{" "}
          <code className="font-mono text-[13px] text-[#1A1712] px-1.5 py-0.5 bg-[#1A1712]/[0.04] rounded">
            sovereign-matrix/sovereign-reviewer@v1
          </code>
          . Install in any repo for AI-powered PR review.
        </p>
      </section>

      {/* ─── CTA bar ─── */}
      <section className="mt-32 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Ship on Sovereign
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <CTACard
            title="Install the MCP"
            body="20 tools, zero signup, Claude Code / Cline / Cursor ready."
            cta="npm install"
            href="https://www.npmjs.com/package/@sovereignmatrix/mcp"
            external
          />
          <CTACard
            title="Read the API docs"
            body="Every agent, every parameter, every response shape. OpenAPI-compatible."
            cta="Read →"
            href="/developers/docs"
          />
          <CTACard
            title="Get a free API token"
            body="50 runs/month, no credit card. Talk to the founder for usage-based enterprise."
            cta="Sign up →"
            href="/signup"
          />
        </div>
      </section>

      {/* ─── Colophon ─── */}
      <footer className="mt-32 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          Looking for the operator pitch (SMB marketers, ops teams)?
          That&apos;s at{" "}
          <Link href="/" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
            the homepage
          </Link>
          . Same platform, different audience.
        </p>
        <p className="mt-3">
          Public repo:{" "}
          <Link
            href="https://github.com/christiaan839-beep/sovereign-v2"
            className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
          >
            github.com/christiaan839-beep/sovereign-v2
          </Link>
          . MIT on the MCP package; platform itself is not open-source
          but every commit is public.
        </p>
      </footer>
    </main>
  );
}

function Primitive({
  number,
  title,
  body,
  code,
}: {
  number: string;
  title: string;
  body: string;
  code: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-4 mb-3">
        <span className="font-mono text-sm text-[#8F8576] tabular-nums">{number}</span>
        <h3 className="font-serif text-2xl text-[#1A1712]">{title}</h3>
      </div>
      <p className="text-sm text-[#5C544A] leading-relaxed max-w-lg mb-4 ml-10">{body}</p>
      <code className="inline-block ml-10 px-3 py-1.5 bg-[#1A1712] text-[#B5532C] font-mono text-[12px] rounded">
        {code}
      </code>
    </div>
  );
}

function CTACard({
  title,
  body,
  cta,
  href,
  external,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block rounded-2xl border border-[#D8CDB7] bg-white/30 p-6 hover:border-[#B5532C] transition-colors"
    >
      <h4 className="font-serif text-xl text-[#1A1712] mb-2">{title}</h4>
      <p className="text-sm text-[#5C544A] leading-relaxed mb-4">{body}</p>
      <span className="font-mono text-[13px] text-[#B5532C] tracking-wide">
        {cta}
      </span>
    </Link>
  );
}

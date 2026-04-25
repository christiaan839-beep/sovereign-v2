import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Defender's ledger · Sovereign Matrix",
  description:
    "Published evidence that we use AI to audit our own code, find vulnerabilities, and ship fixes within hours. No slogans — commit hashes.",
  alternates: { canonical: "https://sovereignmatrix.agency/trust/defenders" },
  openGraph: {
    title: "Defender's ledger — Sovereign Matrix",
    description:
      "Published security case studies. Every vulnerability found, fixed, and verifiable on GitHub.",
    url: "https://sovereignmatrix.agency/trust/defenders",
    type: "website",
  },
};

/**
 * /trust/defenders — public case-study ledger.
 *
 * The thesis (from Anthropic's framing of the defenders' advantage):
 * LLMs good enough at code are, as a side effect, good at finding
 * and fixing vulnerabilities in that code. A vendor that runs
 * AI-powered audits against its own commits + publishes the
 * findings is doing what Anthropic just did with OpenBSD and Linux,
 * at the scale of a single B2B SaaS.
 *
 * This page is the index — each case study is a full writeup in
 * `docs/SECURITY_CASE_STUDY_*.md`, linked here. Every claim has a
 * commit hash so a prospect can verify without our cooperation.
 */

const CASE_STUDIES = [
  {
    id: "v8-enterprise-readiness",
    date: "April 20, 2026",
    title: "8 vulnerabilities found in v8 enterprise-readiness sprint",
    summary:
      "Claude-powered security-reviewer audited our v8 commits 2 hours after shipping. Found 2 critical + 5 high-severity issues. All fixed within 3 hours total.",
    findings: {
      critical: 2,
      high: 5,
      low: 1,
    },
    fixCommit: "a9a4bee0",
    repoCommitUrl:
      "https://github.com/christiaan839-beep/sovereign-v2/commit/a9a4bee0",
    caseStudyUrl:
      "https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/SECURITY_CASE_STUDY_V8.md",
    topFindings: [
      "orgMembers missing UNIQUE constraints → cross-tenant data leak",
      "Admin self-modification → privilege escalation / co-founder griefing",
      "CSV formula injection in audit export → RCE in admin spreadsheets",
      "Payment idempotency driver-agnostic fix → no double-refunds",
    ],
  },
];

export default function DefendersPage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      {/* ─── Editorial header ─── */}
      <div className="max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Trust · The Defender&apos;s Ledger
        </p>
        <h1 className="font-serif text-5xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
          We audit our own code.
          <br />
          <em className="text-[#B5532C] not-italic">We publish what we find.</em>
        </h1>
        <p className="text-lg text-[#5C544A] leading-relaxed max-w-2xl">
          Most SaaS vendors don&apos;t talk about vulnerabilities they
          fixed internally. The incentive is silence. We think the
          incentive is wrong. If we&apos;re going to run AI against
          real customer workloads, we owe you evidence that we&apos;re
          using that same AI to audit our own attack surface — and
          that we ship the fixes faster than attackers find them.
        </p>
      </div>

      {/* ─── The thesis ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter I · The Defender&apos;s Advantage
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-8">
          A model good enough to write code
          <br />
          is, as a side effect,{" "}
          <em className="text-[#B5532C] not-italic">good enough to find bugs in it.</em>
        </h2>
        <div className="space-y-4 text-[15px] text-[#5C544A] leading-relaxed max-w-2xl">
          <p>
            Anthropic has publicly documented cases where their internal
            models found a 27-year-old bug in OpenBSD and a series of
            Linux privilege-escalation vulnerabilities. All of those
            were responsibly disclosed, patched, and deployed to the
            millions of servers running that software — before anyone
            had a chance to exploit them.
          </p>
          <p>
            That pattern — AI finds, humans decide, maintainers patch —
            scales down to a single B2B SaaS. Every time we ship a
            feature at Sovereign Matrix, the 5-minute investment of
            re-running a Claude-backed <code className="text-[#1A1712] font-mono text-[13px] px-1.5 py-0.5 bg-[#1A1712]/[0.04] rounded">security-reviewer</code>{" "}
            finds things our standard test suite missed. Some of them
            are customer-trust-breaking critical.
          </p>
          <p>
            The ledger below is every case we&apos;ve published. Each
            one links to the finding, the fix commit, and the elapsed
            time between the two.
          </p>
        </div>
      </section>

      {/* ─── Case studies ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-6">
          Chapter II · Published Case Studies
        </p>

        <div className="space-y-16">
          {CASE_STUDIES.map((cs) => (
            <article key={cs.id} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-8 top-3 w-3 h-3 rounded-full bg-[#B5532C] hidden md:block" />

              <div className="flex items-baseline gap-6 mb-3">
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#8F8576]">
                  {cs.date}
                </p>
                <a
                  href={cs.repoCommitUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-[10px] font-mono tracking-[0.14em] uppercase text-[#B5532C] hover:text-[#1A1712] transition-colors"
                >
                  fix commit: {cs.fixCommit} →
                </a>
              </div>

              <h3 className="font-serif text-2xl lg:text-3xl leading-snug mb-4">
                {cs.title}
              </h3>

              <p className="text-[15px] text-[#5C544A] leading-relaxed mb-6 max-w-2xl">
                {cs.summary}
              </p>

              {/* Severity breakdown */}
              <div className="flex gap-8 mb-6 text-sm">
                <div>
                  <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[#8F8576]">Critical</span>
                  <span className="block font-serif text-2xl text-[#B5532C]">{cs.findings.critical}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[#8F8576]">High</span>
                  <span className="block font-serif text-2xl text-[#1A1712]">{cs.findings.high}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-mono uppercase tracking-[0.16em] text-[#8F8576]">Low</span>
                  <span className="block font-serif text-2xl text-[#1A1712]">{cs.findings.low}</span>
                </div>
              </div>

              {/* Top findings bullet list */}
              <ul className="space-y-2 text-sm text-[#5C544A] max-w-2xl ml-0 mb-6">
                {cs.topFindings.map((f, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[#B5532C] shrink-0">—</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={cs.caseStudyUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A1712] border-b border-[#B5532C] pb-0.5 hover:text-[#B5532C] transition-colors"
              >
                Read the full case study →
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Commitment block ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter III · Our Commitments
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl leading-tight mb-10">
          What we commit to, regardless of pricing pressure.
        </h2>

        <ul className="space-y-6">
          <Commitment
            label="security-reviewer runs on every PR touching /api/_* routes."
            detail="Findings block merge. If the model misses something, the human reviewer catches it; if the human misses something, the model catches it."
          />
          <Commitment
            label="Quarterly full-codebase audit, published here."
            detail={
              <>
                Same format as the v8 case study: every finding with a
                line reference, every fix with a commit hash, every
                claim verifiable from the public GitHub repo.
              </>
            }
          />
          <Commitment
            label="Responsible disclosure — and credit to researchers."
            detail={
              <>
                See{" "}
                <a href="/.well-known/security.txt" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
                  /.well-known/security.txt
                </a>
                . 24-hour acknowledgement, 90-day coordinated disclosure,
                public credit for researchers who want it.
              </>
            }
          />
          <Commitment
            label="We share findings with peer platforms when the shape generalizes."
            detail={
              <>
                If we find a vulnerability pattern that could plausibly
                affect another B2B SaaS (CSV formula injection across
                exports is a good example), we tell them. Software ate
                the world; defenders share notes. We don&apos;t gatekeep
                security research for competitive advantage.
              </>
            }
          />
          <Commitment
            label="Every agent run a customer pays for can be exported."
            detail={
              <>
                A cryptographically-checksummed{" "}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint, intentional <a> for JSON download */}
                <a href="/api/_replay/verify" className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]">
                  snapshot
                </a>{" "}
                of the full input, model selection, safety checks, and
                output — verifiable by any auditor without a Sovereign
                account. No black boxes.
              </>
            }
          />
        </ul>
      </section>

      {/* ─── CTA strip ─── */}
      <section className="mt-24 border-t border-[#D8CDB7] pt-12 max-w-4xl">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#8F8576] mb-4">
          Chapter IV · If You&apos;re a Defender Too
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[15px] text-[#5C544A]">
          <div>
            <h3 className="font-serif text-xl text-[#1A1712] mb-2">
              Researcher or security team
            </h3>
            <p className="leading-relaxed mb-3">
              Found something? Email{" "}
              <a
                href="mailto:security@sovereignmatrix.agency"
                className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
              >
                security@sovereignmatrix.agency
              </a>
              . We respond within 24 business hours. Details in{" "}
              <a
                href="/.well-known/security.txt"
                className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
              >
                security.txt
              </a>
              .
            </p>
          </div>

          <div>
            <h3 className="font-serif text-xl text-[#1A1712] mb-2">
              Developer — want the same tooling?
            </h3>
            <p className="leading-relaxed mb-3">
              Our <code className="text-[#1A1712] font-mono text-[13px] px-1.5 py-0.5 bg-[#1A1712]/[0.04] rounded">sovereign_code_review</code>{" "}
              MCP tool runs the same security-reviewer pattern against
              any code you paste.{" "}
              <a
                href="https://www.npmjs.com/package/@sovereignmatrix/mcp"
                className="underline decoration-[#B5532C]/40 hover:decoration-[#B5532C]"
              >
                npm install @sovereignmatrix/mcp
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ─── Colophon ─── */}
      <footer className="mt-32 pt-12 border-t border-[#D8CDB7] max-w-4xl text-[11px] font-mono text-[#8F8576] leading-loose">
        <p>
          Case studies are updated quarterly. Each entry&apos;s claims
          are verifiable without our cooperation via the linked commit.
          Last updated: April 20, 2026.
        </p>
        <p className="mt-3">
          Sovereign Matrix operates independently. Not formally
          affiliated with Anthropic. The &ldquo;defender&apos;s
          advantage&rdquo; framing is theirs; the evidence above is
          ours.
        </p>
      </footer>
    </main>
  );
}

function Commitment({
  label,
  detail,
}: {
  label: string;
  detail: string | React.ReactNode;
}) {
  return (
    <li>
      <p className="font-serif text-lg text-[#1A1712] mb-1">
        <em className="text-[#B5532C] not-italic">—</em> {label}
      </p>
      <p className="text-sm text-[#5C544A] leading-relaxed max-w-xl ml-6">
        {detail}
      </p>
    </li>
  );
}

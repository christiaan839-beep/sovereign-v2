import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Code2,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /careers — Hiring + open roles (Cook 155).
 *
 * Public roles page. The first hire is a GTM partner — that role
 * post here is the asset the founder shares to legitimize the
 * "looking for cofounder/GTM hire" narrative investors want to
 * hear during fundraise.
 */

export const metadata: Metadata = {
  title: "Careers · Sovereign Matrix",
  description:
    "Help build the cryptographic verification layer for every AI agent decision. We're hiring our first GTM partner — and the next ten engineers.",
  alternates: { canonical: "/careers" },
};

interface Role {
  title: string;
  team: "GTM" | "Engineering" | "Compliance" | "Operations";
  type: "Full-time" | "Fractional" | "Contract";
  location: string;
  status: "Open" | "Hiring soon";
  blurb: string;
  responsibilities: string[];
  applyUrl: string;
}

const ROLES: Role[] = [
  {
    title: "Founding GTM Partner",
    team: "GTM",
    type: "Full-time",
    location: "Remote · global",
    status: "Open",
    blurb:
      "Help me close the first 5 design-partner pilots. You bring the rolodex into Big-4 sustainability, regional bank model risk, or pharma quality — I ship the platform underneath. Equity-heavy comp + fixed cash floor.",
    responsibilities: [
      "Drive the first 3-5 paid design partners across CSRD / SR 11-7 / Part 11 verticals",
      "Build the founding sales motion (deck, demo flow, procurement-team objection handling)",
      "Identify and warm-introduce 3 Big-4 alliance partners (Workiva, PwC, EY)",
      "Own the conversion from /investors data room → signed term sheet, working alongside the founder",
    ],
    applyUrl:
      "mailto:founder@sovereignmatrix.agency?subject=GTM%20Partner%20at%20Sovereign%20Matrix",
  },
  {
    title: "Founding Compliance Engineer",
    team: "Compliance",
    type: "Fractional",
    location: "Remote · global",
    status: "Hiring soon",
    blurb:
      "You ran SOC 2 / GDPR / 21 CFR Part 11 at a regulated company. Help us bridge from controls-on-paper (docs/SECURITY.md, docs/GDPR-PROCESSOR.md) to controls-in-production with the audit-bundle subscription + receipt fabric.",
    responsibilities: [
      "Drive the SOC 2 Type 2 external audit engagement",
      "Map each regulatory pack (CSRD, SR 11-7, NERC CIP, Part 11, FedRAMP) to formal control evidence",
      "Lead customer-facing security questionnaire responses",
      "Architect the auditor-replay experience end-to-end with the engineering team",
    ],
    applyUrl:
      "mailto:founder@sovereignmatrix.agency?subject=Compliance%20Engineer%20at%20Sovereign%20Matrix",
  },
  {
    title: "Senior Cryptographer / Protocol Engineer",
    team: "Engineering",
    type: "Full-time",
    location: "Remote · global",
    status: "Hiring soon",
    blurb:
      "Take the current crypto stack (HMAC + Ed25519 + Merkle + receipt-ratchet + anon-credential + ZK pass-rate) to the next layer — formal verification, BBS+ signatures, post-quantum migration path.",
    responsibilities: [
      "Move the anon-credential primitive from HMAC-shape to true BBS+ on a pairing curve (BLS12-381)",
      "Design + ship a formally-verified canonical-projection function (Lean 4 / Coq)",
      "Lead the post-quantum migration roadmap (CRYSTALS-Kyber + Dilithium)",
      "Engage with academic + industry working groups on AI-agent receipt standards",
    ],
    applyUrl:
      "mailto:founder@sovereignmatrix.agency?subject=Cryptographer%20at%20Sovereign%20Matrix",
  },
  {
    title: "Forward-Deployed Engineer (CSRD)",
    team: "Engineering",
    type: "Contract",
    location: "Remote · EU-preferred",
    status: "Hiring soon",
    blurb:
      "Embed with the first Big-4 sustainability practice. Build their CSRD wave-1 implementation on Sovereign while we both learn what the second customer needs.",
    responsibilities: [
      "Sit alongside the Big-4 engagement partner; ship the first ESRS disclosure pack live",
      "Translate auditor feedback into product issues with engineering",
      "Help the founder turn the first-customer learnings into the second-customer GTM motion",
    ],
    applyUrl:
      "mailto:founder@sovereignmatrix.agency?subject=Forward-Deployed%20Engineer%20at%20Sovereign%20Matrix",
  },
];

const PRINCIPLES = [
  "Cryptographic primitives over marketing language",
  "Auditor-verifiable receipts > screenshots in a slide deck",
  "Tenant-isolation by construction, not by convention",
  "Ship one regulator-grade primitive a week",
  "Solo-founder energy + small-team velocity > big-team politics",
  "Customer's auditor is also our user",
];

const TEAM_ICON = {
  GTM: Megaphone,
  Engineering: Code2,
  Compliance: ShieldCheck,
  Operations: Briefcase,
};

const STATUS_COLOR = {
  Open: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "Hiring soon": "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export default function CareersPage() {
  const openRoles = ROLES.filter((r) => r.status === "Open");

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
            </Link>
            <Link
              href="/about"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href="/demo/verify-receipt"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Verify demo
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Careers
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Help build the verification layer{" "}
          <span className="text-cyan-400">underneath every AI decision.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          {openRoles.length === 1
            ? "One role open today."
            : `${openRoles.length} roles open today.`}{" "}
          Solo-founder + a tight founding team. We&rsquo;re looking for the
          first 2-3 people who&rsquo;d rather ship one signed pilot than rewrite
          a slide deck.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#open-roles"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            See open roles
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href="/investors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Investor data room
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          How we work
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {PRINCIPLES.map((p, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-start gap-3"
            >
              <Users className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-sm text-neutral-300 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="open-roles" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Roles
        </h2>
        <div className="space-y-4">
          {ROLES.map((r) => {
            const Icon = TEAM_ICON[r.team];
            return (
              <div
                key={r.title}
                className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-cyan-400 mt-1 shrink-0" />
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {r.title}
                      </h3>
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
                        {r.team} · {r.type} · {r.location}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                  {r.blurb}
                </p>
                <ul className="space-y-1.5 mb-5">
                  {r.responsibilities.map((re, i) => (
                    <li
                      key={i}
                      className="text-xs text-neutral-400 leading-relaxed pl-4 border-l border-cyan-500/20"
                    >
                      {re}
                    </li>
                  ))}
                </ul>
                {r.status === "Open" ? (
                  <a
                    href={r.applyUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-colors"
                  >
                    Apply via email
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <a
                    href={r.applyUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-neutral-300 text-xs hover:border-white/20 hover:text-white transition-colors"
                  >
                    Introduce yourself
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Don&rsquo;t see your role?
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Send the founder a 100-word note + a thing you&rsquo;ve shipped
            (Github, paper, podcast, anything). We&rsquo;re building the team
            opportunistically — strong narrative on what you&rsquo;d own beats a
            perfect job match.
          </p>
          <a
            href="mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Careers%20-%20I%20want%20to%20help"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Pitch the founder
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/about" className="hover:text-neutral-300">
            About
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}

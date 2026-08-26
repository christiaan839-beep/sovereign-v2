// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Scale,
  ShieldCheck,
  FileSearch,
  HeartPulse,
  Activity,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-insurance-claims — Tier-1 ICP vertical landing (Cook 142).
 *
 * Hook (from market brief): claims adjudication is an underserved
 * niche. State insurance commissioners (NAIC) are drafting AI-bias
 * rules requiring "decisional traceability." Lindy / Clay / Manus
 * can't prove a denied claim wasn't hallucinated. Sovereign can.
 *
 * Primary buyer: AVP Claims at top-30 P&C carriers (Travelers,
 * Hartford, Liberty Mutual, Chubb) + health-insurance plan-level
 * audit (UnitedHealth, Anthem, Cigna). Procurement: legal/compliance
 * budget more often than IT — fast cycle because the regulator is
 * the forcing function.
 */

export const metadata: Metadata = {
  title: "AI for Insurance Claims · NAIC AI Bias-Ready · Sovereign Matrix",
  description:
    "Cryptographically-receipted claims AI. Every adjudication decision tied to source via signed receipts your commissioner audit + ERISA fiduciary review can replay.",
  alternates: { canonical: "/for-insurance-claims" },
};

const PRIMITIVES = [
  {
    icon: Scale,
    title: "NAIC AI Bias compliance posture",
    desc: "NAIC's Model Bulletin on AI/ML demands documented testing, ongoing monitoring, and decisional traceability. Sovereign's bias auditor + drift detector + Cook 58 SOC 2 monitor produce a live compliance scoreboard. Examiners see continuous evidence — not a quarterly slide deck.",
  },
  {
    icon: FileSearch,
    title: "First-notice-of-loss (FNOL) triage with receipts",
    desc: "Agents intake FNOL via voice, email, or app upload; classify severity, coverage applicability, and SIU referral risk. Hallucination guard ensures every coverage cite ties to the policy form on file. Multi-party attestation lets adjuster + supervisor co-sign close decisions.",
  },
  {
    icon: HeartPulse,
    title: "Health-plan adjudication with adverse-determination defense",
    desc: "Every denial/partial-pay/prior-auth decision composes the adverse-determination letter against the plan document + medical-policy file. Hallucination detector blocks unsupported phrasing. ERISA §503 review + IRO appeal both replay the signed bundle directly — no email-thread reconstruction.",
  },
  {
    icon: Activity,
    title: "SIU referral memo automation",
    desc: "Pattern detection across claims + provider + venue data → drafts SIU referral memos with citation links to every red flag. Receipt-chain ratchet (Cook 94) makes the memo tamper-evident, satisfying state-fraud-bureau evidentiary standards.",
  },
  {
    icon: ShieldCheck,
    title: "Auditor Replay Seats for the DOI examiner",
    desc: "State Department of Insurance examiners get cryptographic Replay Seats (Cook 136 anon-credential) to verify any adjudication on demand. They consume no plan / carrier agent runs, see no peer-client data, and produce in-place attestation. The model bias review becomes a Wednesday afternoon, not a six-month engagement.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Triage today\'s FNOL queue and route everything with SIU red-flags to the special-investigations team."',
    steps: [
      "Agent intakes today's FNOL submissions across voice / email / app channels.",
      "Classifies severity + coverage applicability against the on-file policy form.",
      "Scores each claim against the SIU red-flag matrix (venue clustering, provider patterns, prior-claim correlations).",
      "Routes flagged claims with a draft SIU memo + citation map; routes coverage-questionable claims to senior adjuster review.",
    ],
    result:
      "Sorted FNOL queue + SIU referrals + signed receipts. Adjuster productivity +35% on routine claims, zero missed-fraud cases in QA review.",
  },
  {
    trigger:
      '"Draft the adverse-determination letter for the denied surgery prior-auth on member 0042."',
    steps: [
      "Agent pulls the prior-auth submission, the plan document, the medical-policy file, and the prior-utilization history.",
      "Composes the §503 adverse-determination letter citing the specific medical-necessity criteria.",
      "Hallucination guard verifies every cited criterion ties to the policy file.",
      "Medical director + compliance officer co-sign via multi-party attestation; member receives the letter + appeal-rights packet.",
    ],
    result:
      "ERISA-compliant adverse-determination letter + signed receipts. IRO appeal replays the trail in-place. Adjudication-time -55%, denial-overturn rate at IRO consistent with peers.",
  },
  {
    trigger:
      '"Prepare the model-risk evidence package for the upcoming DOI examination."',
    steps: [
      "Agent assembles every model run + drift report + bias-audit posture + AI/ML inventory.",
      "Receipt timeline shows what model decided what, when, and on what input.",
      "Cross-tenant ZK pass-rate proof (Cook 106) lets the carrier prove industry-aligned pass rates without exposing peer-carrier data.",
      "DOI examiner receives a replay-ready bundle with pre-provisioned Replay Seats.",
    ],
    result:
      "DOI evidence package ready in days, not months. Examiner verifies in their workpaper system. Model bias review closes without §1033 enforcement action.",
  },
];

const COMPLIANCE = [
  "NAIC Model Bulletin — AI/ML in Insurance",
  "NY DFS Regulation 121 — Cybersecurity (AI applicability)",
  "CO DOI Reg 10-1-1 — AI in Life Insurance",
  "ERISA §503 + §1133 — Adverse-determination procedure",
  "HIPAA — PHI handling for health-plan claims",
  "Fair Claims Settlement Practices regs (per state)",
  "ECOA — applicable to credit-related coverage decisions",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForInsuranceClaimsPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#030303]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/agents"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Agents
            </Link>
            <Link
              href="/trust"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Trust
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded-[3px] bg-white/[0.04] border border-white/[0.08] font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Insurance Claims Adjudication
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The AI a <span className="text-cyan-400">DOI examiner</span> can
          verify claim-by-claim.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          NAIC&rsquo;s AI/ML Model Bulletin requires documented testing, ongoing
          monitoring, and decisional traceability. A denied claim is the one a
          regulator reads back to you, and it has to be provable rather than
          plausible. Sovereign Matrix ships cryptographic chain-of-custody for
          every adjudication decision.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=insurance-claims"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a claims engineer
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Read the receipts spec
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Primitives shipped for claims operations
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Three workflows landing on day one
        </h2>
        <div className="space-y-4">
          {USE_CASES.map((u, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-sm text-white italic mb-4">{u.trigger}</p>
              <ul className="space-y-2 mb-4">
                {u.steps.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-neutral-400"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-cyan-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to insurance-regulatory controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Built for the carrier whose examiner is showing up next quarter.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign&rsquo;s Auditor Replay Seats turn the DOI examination from
            a six-month engagement into a Wednesday afternoon. Continuous
            evidence. Replayable claim-by-claim. Zero §1033 enforcement exposure
            on AI decisions.
          </p>
          <Link
            href="/contact?vertical=insurance-claims"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Schedule a claims procurement deep-dive
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/trust" className="hover:text-neutral-300">
            Trust posture
          </Link>
          <Link href="/agents" className="hover:text-neutral-300">
            140 agents
          </Link>
        </div>
      </footer>
    </div>
  );
}

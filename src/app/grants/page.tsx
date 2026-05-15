import Link from "next/link";
import { ArrowRight, Banknote, Award, Cloud, Clock } from "lucide-react";
import type { Metadata } from "next";

/**
 * /grants — Non-dilutive funding directory (Cook 148).
 *
 * Single page that lists every grant, accelerator, credit program,
 * and bridge-funding source the founder can apply to in the next
 * 48 hours. Sorted by speed-to-cash so the highest-leverage row
 * comes first. Each row links directly to the application.
 *
 * The page is internal-facing — public so the founder can also
 * share it with other technical founders in the same regulated-AI
 * space (and converts to a referral channel later).
 */

export const metadata: Metadata = {
  title: "Non-Dilutive Funding · Grants, Credits, Bridges · Sovereign Matrix",
  description:
    "Every grant, accelerator, credit program, and bridge funding source for a regulated-AI startup. Sorted by speed-to-cash.",
  alternates: { canonical: "/grants" },
};

type Speed = "this-week" | "this-month" | "this-quarter";

interface GrantRow {
  name: string;
  amount: string;
  speed: Speed;
  type:
    | "grant"
    | "accelerator"
    | "credits"
    | "bridge"
    | "revenue"
    | "competition";
  why: string;
  applyUrl: string;
}

const ROWS: GrantRow[] = [
  // ── This week ─────────────────────────────────────────────────────────
  {
    name: "AI Grant (Nat Friedman + Daniel Gross)",
    amount: "$250K",
    speed: "this-week",
    type: "grant",
    why: "2-week decision. No equity. Specifically funds infra + verification plays.",
    applyUrl: "https://aigrant.com",
  },
  {
    name: "Microsoft for Startups Founders Hub",
    amount: "$150K Azure + Office365",
    speed: "this-week",
    type: "credits",
    why: "Automatic acceptance for technical founders. 30-minute application.",
    applyUrl: "https://startups.microsoft.com",
  },
  {
    name: "AWS Activate Portfolio",
    amount: "Up to $100K credits",
    speed: "this-week",
    type: "credits",
    why: "Cuts compute costs to zero for 12 months.",
    applyUrl: "https://aws.amazon.com/activate",
  },
  {
    name: "Google for Startups Cloud Program",
    amount: "Up to $200K credits",
    speed: "this-week",
    type: "credits",
    why: "Multi-cloud strategy = leverage when pitching enterprise procurement.",
    applyUrl: "https://cloud.google.com/startup",
  },
  {
    name: "Anthropic Builder Credits",
    amount: "$1K–$10K",
    speed: "this-week",
    type: "credits",
    why: "You already use Claude. Email the API team — fast turnaround.",
    applyUrl: "https://anthropic.com/contact-sales",
  },
  {
    name: "Vercel for Open Source",
    amount: "Free Pro tier",
    speed: "this-week",
    type: "credits",
    why: "Saves $240/month on hosting. Application is 5 minutes.",
    applyUrl: "https://vercel.com/sponsorships",
  },

  // ── This month ────────────────────────────────────────────────────────
  {
    name: "Pioneer.app",
    amount: "$100K SAFE",
    speed: "this-month",
    type: "accelerator",
    why: "Weekly tournament — fastest accelerator cycle. Optimized for solo founders.",
    applyUrl: "https://pioneer.app",
  },
  {
    name: "EmergentVentures (Mercatus Center)",
    amount: "$25K–$100K",
    speed: "this-month",
    type: "grant",
    why: "No-equity grant for ambitious projects. 4–8 week decision.",
    applyUrl: "https://www.mercatus.org/emergent-ventures",
  },
  {
    name: "Y Combinator (rolling)",
    amount: "$500K SAFE",
    speed: "this-month",
    type: "accelerator",
    why: "The partner network + Vanta/Anthropic alumni intros. Application is in docs/yc-application.md.",
    applyUrl: "https://ycombinator.com/apply",
  },
  {
    name: "Techstars",
    amount: "$120K + program",
    speed: "this-month",
    type: "accelerator",
    why: "Compliance-focused tracks (London, NY, Boston). 13-week program.",
    applyUrl: "https://techstars.com/apply",
  },
  {
    name: "On Deck Founders Fellowship",
    amount: "Network + $25K",
    speed: "this-month",
    type: "accelerator",
    why: "Solo-founder-friendly. Strong cohort.",
    applyUrl: "https://beondeck.com/founders",
  },

  // ── Federal / EU / non-dilutive ──────────────────────────────────────
  {
    name: "DARPA SBIR Phase I (USAI / ANSR)",
    amount: "$250K Phase I → $1.7M Phase II",
    speed: "this-quarter",
    type: "grant",
    why: "Federal non-dilutive. Validates the AI-verification thesis. Phase II is sole-source authority for follow-on contracts.",
    applyUrl: "https://www.sbir.gov",
  },
  {
    name: "IARPA SCISRS",
    amount: "$250K–$2M",
    speed: "this-quarter",
    type: "grant",
    why: "Formal verification of AI systems — direct thesis match.",
    applyUrl: "https://iarpa.gov",
  },
  {
    name: "NSF SBIR Track G (AI/ML Safety)",
    amount: "$275K Phase I",
    speed: "this-quarter",
    type: "grant",
    why: "Federal non-dilutive. Faster review than DARPA.",
    applyUrl: "https://seedfund.nsf.gov",
  },
  {
    name: "EU Horizon Europe",
    amount: "Up to €2M",
    speed: "this-quarter",
    type: "grant",
    why: "AI governance + audit grants. EU-specific but funds non-EU companies through partnerships.",
    applyUrl: "https://ec.europa.eu/info/funding-tenders",
  },
  {
    name: "In-Q-Tel",
    amount: "$1M+ strategic",
    speed: "this-quarter",
    type: "grant",
    why: "CIA strategic. Makes equity investments AND sole-source contracts.",
    applyUrl: "https://iqt.org",
  },

  // ── Revenue / consulting ─────────────────────────────────────────────
  {
    name: "Consulting at $300/hr",
    amount: "$30K = 100 hours",
    speed: "this-month",
    type: "revenue",
    why: "Leverage the IP. Post on LinkedIn: 'Taking 4 consulting slots for AI verification in regulated industries.' Convert in 2–3 weeks.",
    applyUrl: "/contact?intent=consulting",
  },
  {
    name: "First Auditor Replay Seat sale",
    amount: "$50K ACV",
    speed: "this-quarter",
    type: "revenue",
    why: "DM 30 named buyers from docs/INVESTOR_OUTREACH.md. One signed pilot covers 4+ months runway.",
    applyUrl: "/contact?intent=replay-seat",
  },
  {
    name: "Starter packs (small SKUs)",
    amount: "$99–$999/sale",
    speed: "this-week",
    type: "revenue",
    why: "Cryptographic verification kit, regulatory pack templates, advisory hour bundles. See /starter-packs.",
    applyUrl: "/starter-packs",
  },

  // ── Bridges ──────────────────────────────────────────────────────────
  {
    name: "Stripe Atlas → Stripe Capital",
    amount: "$10K–$30K cash advance",
    speed: "this-quarter",
    type: "bridge",
    why: "Once $5K+ in monthly revenue, Stripe offers cash advance against future receipts. No equity.",
    applyUrl: "https://stripe.com/atlas",
  },
  {
    name: "Mercury Capital",
    amount: "Revenue-based",
    speed: "this-quarter",
    type: "bridge",
    why: "Bank-based revenue advance once first revenue lands.",
    applyUrl: "https://mercury.com/capital",
  },
  {
    name: "SBA business credit cards (0% intro)",
    amount: "$10K–$30K float",
    speed: "this-week",
    type: "bridge",
    why: "AMEX Business Plat / Chase Ink — 12–18 months no interest. Bridges runway without equity.",
    applyUrl: "https://www.sba.gov/funding-programs",
  },
  {
    name: "Friends & family bridge note",
    amount: "$10K–$30K",
    speed: "this-week",
    type: "bridge",
    why: "Convertible note at safe terms. Most founders' real first round.",
    applyUrl: "/contact?intent=ff-bridge",
  },

  // ── Competitions ─────────────────────────────────────────────────────
  {
    name: "Anthropic Build Day / Hackathons",
    amount: "$5K–$50K prizes",
    speed: "this-month",
    type: "competition",
    why: "Submit the crypto-receipts demo. Featured = press + leads.",
    applyUrl: "https://anthropic.com/events",
  },
  {
    name: "DEF CON AI Village",
    amount: "Press + credibility",
    speed: "this-quarter",
    type: "competition",
    why: "Submit a talk on the crypto-receipts spec. Conference is August.",
    applyUrl: "https://aivillage.org",
  },
  {
    name: "Product Hunt featured launch",
    amount: "Press + sign-ups",
    speed: "this-week",
    type: "competition",
    why: "Free. Pick a Tuesday. Aim for #1 of the day.",
    applyUrl: "https://producthunt.com/launches",
  },
];

const SPEED_LABEL: Record<Speed, string> = {
  "this-week": "This week",
  "this-month": "This month",
  "this-quarter": "This quarter",
};

const TYPE_ICON: Record<GrantRow["type"], typeof Banknote> = {
  grant: Banknote,
  accelerator: Award,
  credits: Cloud,
  bridge: Clock,
  revenue: Banknote,
  competition: Award,
};

export default function GrantsPage() {
  const byspeed = (s: Speed) => ROWS.filter((r) => r.speed === s);

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
              href="/starter-packs"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Starter packs
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
          Non-Dilutive Funding Directory
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Every grant, every credit,{" "}
          <span className="text-cyan-400">every bridge to first revenue.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Sorted by speed-to-cash. Top-of-list rows are accessible in days, not
          months. Sized for a solo technical founder building in regulated AI.
        </p>
      </header>

      {(["this-week", "this-month", "this-quarter"] as Speed[]).map((speed) => (
        <section key={speed} className="max-w-6xl mx-auto px-6 py-8">
          <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
            {SPEED_LABEL[speed]}
          </h2>
          <div className="space-y-3">
            {byspeed(speed).map((r) => {
              const Icon = TYPE_ICON[r.type];
              const internal = r.applyUrl.startsWith("/");
              return (
                <a
                  key={r.name}
                  href={r.applyUrl}
                  target={internal ? undefined : "_blank"}
                  rel={internal ? undefined : "noopener noreferrer"}
                  className="block p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {r.name}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                          {r.why}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-cyan-400 font-semibold text-sm tabular-nums">
                        {r.amount}
                      </span>
                      <ArrowRight className="w-4 h-4 text-neutral-500" />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Apply to five of these tonight.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            AI Grant takes 2 weeks. Microsoft for Startups takes 30 minutes.
            Vercel sponsorship takes 5. Stacking three credit programs + one
            grant application puts you in 90-day runway range before any
            investor responds.
          </p>
          <Link
            href="/investors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            See the investor data room
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/starter-packs" className="hover:text-neutral-300">
            Starter packs
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}

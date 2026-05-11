/**
 * /quickstart — 5-minute walkthrough from signup to a verifiable
 * receipt + distribution.
 *
 * Server-rendered. The conversion-funnel doc that the marketing
 * site has been missing: every step links to the right place,
 * every code block is copy-paste-runnable, every CTA does one
 * thing.
 *
 * Cyan accent — system / audit-grade surface per the dual-accent
 * brand rule.
 *
 * Structure follows the AHA moment ladder:
 *   1. Sign up
 *   2. Run an agent
 *   3. Mark a receipt public + open /r/<id>
 *   4. Verify it three ways (browser / curl / CLI)
 *   5. Distribute (badge / MCP / GitHub Action)
 */

import Link from "next/link";
import {
  Rocket,
  ArrowRight,
  CheckCircle2,
  Terminal,
  Shield,
  Code2,
  ExternalLink,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

interface Step {
  number: number;
  title: string;
  body: string;
  cta?: { href: string; label: string; external?: boolean };
  code?: { lang: string; content: string };
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Sign up — 60 seconds, no credit card",
    body: "Create your account. You get 50 verified agent runs / month, free forever. Every run from here produces a cryptographically signed receipt anyone can verify.",
    cta: { href: "/signup", label: "Create account →" },
  },
  {
    number: 2,
    title: "Run an agent (any of 137)",
    body: "From the dashboard, pick a playbook or any agent and give it a goal. Lead Blitz, Content Machine, Competitor Takedown — every one produces a signed receipt the same way.",
    cta: { href: "/dashboard/playbooks", label: "Open the playbook gallery →" },
  },
  {
    number: 3,
    title: "Mark the receipt public, open it",
    body: "Open the receipt at /dashboard/receipts. Click the visibility chip to flip private → public. The receipt now lives at a sharable URL: /r/<id>. Anyone can fetch it cross-origin and verify the signature without an account.",
    cta: { href: "/dashboard/receipts", label: "Your receipts →" },
  },
  {
    number: 4,
    title: "Verify it three ways",
    body: "Same primitive, three protocols. Pick whichever matches your tool.",
    code: {
      lang: "bash",
      content: `# Browser — auto-verifies on mount with timing animation
open https://sovereignmatrix.agency/r/<receipt-id>

# Terminal — installable CLI
npx @sovereignmatrix/cli verify <receipt-id>

# curl — direct REST call
curl -X POST https://sovereignmatrix.agency/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"canonical": "<from-receipt>", "signature": "<from-receipt>"}'`,
    },
  },
  {
    number: 5,
    title: "Distribute — pick your surface",
    body: "Three install paths, all built around the same primitives. Pick what fits your workflow.",
  },
];

export default function QuickstartPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-200"
        >
          ← Sovereign Matrix
        </Link>

        <header className="mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[11px] text-cyan-300">
            <Rocket className="h-3 w-3" />
            QUICKSTART · 5 MINUTES
          </div>
          <h1 className="font-serif text-5xl tracking-tight text-white md:text-6xl">
            Zero to verified, in five minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
            Sign up, run an agent, share the receipt, install the verifier.
            Every step links to the right place. Every code block is
            copy-paste-runnable.
          </p>
        </header>

        {/* Steps */}
        <ol className="space-y-6 mb-14">
          {STEPS.map((step) => (
            <li key={step.number}>
              <SpotlightCard
                as="article"
                accent="cyan"
                radius={300}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 font-mono text-[12px] font-bold text-cyan-200">
                    {step.number}
                  </span>
                  <h2 className="text-lg font-semibold text-white">
                    {step.title}
                  </h2>
                </div>
                <p className="ml-10 text-sm leading-relaxed text-neutral-300">
                  {step.body}
                </p>
                {step.code && (
                  <pre className="ml-10 mt-4 overflow-x-auto rounded-lg border border-white/[0.04] bg-black/50 p-4 font-mono text-[12px] leading-relaxed text-cyan-100">
                    {step.code.content}
                  </pre>
                )}
                {step.cta && (
                  <div className="ml-10 mt-4">
                    {step.cta.external ? (
                      <a
                        href={step.cta.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
                      >
                        {step.cta.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        href={step.cta.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/15"
                      >
                        {step.cta.label}
                      </Link>
                    )}
                  </div>
                )}

                {/* Step 5 — distribution surface grid */}
                {step.number === 5 && (
                  <div className="ml-10 mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Link
                      href="/badge"
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.08]"
                    >
                      <Shield
                        className="mb-2 h-4 w-4 text-cyan-300"
                        aria-hidden="true"
                      />
                      <div className="text-sm font-medium text-white">
                        Verify badge
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        One-line embed on your site
                      </div>
                    </Link>
                    <Link
                      href="/mcp"
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.08]"
                    >
                      <Terminal
                        className="mb-2 h-4 w-4 text-cyan-300"
                        aria-hidden="true"
                      />
                      <div className="text-sm font-medium text-white">
                        MCP server
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Claude Desktop · Cursor · Continue
                      </div>
                    </Link>
                    <a
                      href="https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/verify-action"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3 transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.08]"
                    >
                      <Code2
                        className="mb-2 h-4 w-4 text-cyan-300"
                        aria-hidden="true"
                      />
                      <div className="text-sm font-medium text-white">
                        GitHub Action
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        CI gate — fail builds on tampered receipts
                      </div>
                    </a>
                  </div>
                )}
              </SpotlightCard>
            </li>
          ))}
        </ol>

        {/* "What you just shipped" — closer */}
        <section className="mb-10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-6 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300"
              aria-hidden="true"
            />
            <div>
              <h2 className="mb-2 text-sm font-semibold text-white">
                What you just shipped
              </h2>
              <p className="text-sm leading-relaxed text-neutral-300">
                Every output from your agents is now HMAC-SHA256 signed,
                cross-origin verifiable, and installable into your team&apos;s
                AI tools / CI pipeline / website embed. The audit trail
                compliance teams ask for, built into every run.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            Read the VAOS 1.0 spec
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-neutral-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-200"
          >
            Trust posture
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

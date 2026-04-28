"use client";

/**
 * /agentic-commerce — public positioning + technical primer.
 *
 * The category-defining narrative: most agent platforms tell you
 * what an agent can DO; we tell you what it can do WITH MONEY.
 *
 * Renders the strategic frame, the 4 R30 primitives, and a live
 * code example a developer can copy. No live data — this is a
 * conceptual page, not a metrics page (that's /reliability).
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShieldCheck,
  CircleDollarSign,
  RotateCcw,
  Hash,
  Lock,
  ArrowRight,
} from "lucide-react";

const PRIMITIVES = [
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: "Spend Authorization",
    desc:
      "User grants the agent a bounded, scoped, time-limited cap. Like Stripe Issuing — but for AI agents. Hard ceiling enforced at the database CHECK-constraint level.",
    file: "src/lib/agent-spend.ts (createAuthorization)",
    api: "POST /api/agent-commerce/authorize",
  },
  {
    icon: <CircleDollarSign className="w-5 h-5" />,
    title: "Atomic Charge",
    desc:
      "Agent attempts a charge. SELECT FOR UPDATE row lock + 8-check validator + UNIQUE idempotency key. No race, no double-spend, no over-spend — ever.",
    file: "src/lib/agent-spend.ts (attemptCharge)",
    api: "POST /api/agent-commerce/charge",
  },
  {
    icon: <RotateCcw className="w-5 h-5" />,
    title: "Reversal Window",
    desc:
      "24h default reversal. Either party (user or operator) can call /reverse with a reason; amount refunds to the authorization atomically. The chain is preserved.",
    file: "src/lib/agent-spend.ts (reverseCharge)",
    api: "POST /api/agent-commerce/reverse/[chargeId]",
  },
  {
    icon: <Hash className="w-5 h-5" />,
    title: "Hash-Chained Receipt",
    desc:
      "SHA-256 chain across every charge per authorization. Customer-verifiable offline. Tampering with any past charge breaks the chain. Public verify endpoint, no auth required.",
    file: "src/lib/agent-spend.ts (computeReceiptHash + verifyReceiptChain)",
    api: "GET /api/agent-commerce/verify/[authorizationId]",
  },
];

const CODE_EXAMPLE = `// 1. User creates an authorization
const auth = await fetch("/api/agent-commerce/authorize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agentName: "travel-agent",
    maxCents: 50_000,                    // $500 ceiling
    expiresInHours: 168,                 // 1 week
    categoryLimits: {
      "travel": 40_000,                  // $400 on travel
      "food": 10_000                     // $100 on food
    },
    allowedMerchants: ["AirlineCo", "HotelCo"],
    hitlThresholdCents: 10_000           // > $100 needs human
  }),
});
const { authorizationId } = await auth.json();

// 2. Agent attempts a charge
const charge = await fetch("/api/agent-commerce/charge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    authorizationId,
    agentName: "travel-agent",
    idempotencyKey: "trip_NYC_2026_04",  // stable retry key
    amountCents: 29_900,
    merchantName: "AirlineCo",
    merchantCategory: "travel",
    metadata: { flight: "NYC-LON-2026-04-15" }
  }),
});
const receipt = await charge.json();
// → { chargeId, receiptHash, reversalWindowUntil, remainingCents }

// 3. Anyone (incl. customer) can verify the chain
const verify = await fetch(\`/api/agent-commerce/verify/\${authorizationId}\`);
// → { chainIntact: true, chargeCount: 1, verifiedAt }`;

export default function AgenticCommercePage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-300">
              <Lock className="w-3 h-3" />
              Live · R30 — Apr 2026
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-light tracking-tight text-white">
              Money-grade primitives
              <br />
              <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                for AI agents.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-neutral-400 leading-relaxed">
              Most agent platforms tell you what an agent can do. We tell
              you what it can do <em>with money</em> — under hard
              ceilings, atomic accounting, hash-chained receipts, and
              24-hour reversal by default.
            </p>
            <p className="mt-4 max-w-2xl text-sm text-neutral-500 leading-relaxed">
              The cryptographically-trustable compute layer for agentic
              commerce. Built on the audit chain (R26), the cost-runaway
              guard (R27), and the API-key scope evaluator (R26) — every
              primitive on this page sits on infrastructure that&apos;s
              already passed{" "}
              <Link
                href="/reliability"
                className="text-emerald-300 underline"
              >
                162-180 anti-drift invariants
              </Link>{" "}
              for 30+ days.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard/admin/tenants"
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                Open the admin dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/sovereign-matrix"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-neutral-200 hover:bg-white/[0.06] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the source
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The 4 primitives */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10">
          <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">
            The four R30 primitives
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Every agent action with financial implications passes through
            these four gates. Each is independently testable, each
            references concrete source files, each is wired into the
            hash-chained audit log.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p, idx) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-300">
                {p.icon}
                <h3 className="text-base font-medium text-white">
                  {p.title}
                </h3>
              </div>
              <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
                {p.desc}
              </p>
              <div className="mt-4 space-y-1.5">
                <code className="block rounded border border-white/5 bg-black/20 px-2 py-1 font-mono text-[11px] text-neutral-400 truncate">
                  {p.file}
                </code>
                <code className="block rounded border border-emerald-500/10 bg-emerald-500/[0.03] px-2 py-1 font-mono text-[11px] text-emerald-300 truncate">
                  {p.api}
                </code>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Code example */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">
            Wire it up in 3 calls
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-400">
            User authorizes once; agent transacts within the bounds; anyone
            verifies the chain. No SDK required — plain HTTP.
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <pre className="text-xs md:text-[13px] font-mono text-neutral-300 p-6 overflow-x-auto leading-relaxed">
            {CODE_EXAMPLE}
          </pre>
        </div>
      </section>

      {/* Why this matters strip */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-8">
          <h3 className="text-lg font-medium text-white">
            What changes when an agent can spend money
          </h3>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                Procurement
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Auto-renew SaaS, pay invoices, manage budgets — with
                hard ceilings, audit, and 24h reversal.
              </p>
            </div>
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                Travel ops
              </div>
              <p className="text-neutral-400 leading-relaxed">
                &ldquo;$5K Q2 travel, max $2K/trip, US airlines only&rdquo;
                — bounded by category limits and merchant allowlist.
              </p>
            </div>
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                Content ops
              </div>
              <p className="text-neutral-400 leading-relaxed">
                &ldquo;$500/mo on stock photos, only approved vendors&rdquo;
                — fine-grained sub-budgets per merchant category.
              </p>
            </div>
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                DevOps
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Agent buys compute capacity up to $200/day, only AWS,
                requires human approval above $50.
              </p>
            </div>
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                Customer support
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Agent issues refund tokens up to $X per ticket, audit-
                trailed, reversible if abused.
              </p>
            </div>
            <div>
              <div className="text-emerald-300 font-medium mb-1">
                Personal assistants
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Groceries, subscriptions, micro-payments — all under
                user-grantable, biometric-approvable buckets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What's coming */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight">
          On the roadmap
        </h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <RoadmapCard
            phase="Q3 2026"
            items={[
              "Two-party signing (user co-signs at commit)",
              "Per-action signed receipts for merchants",
              "Tier-2 HITL with category-aware thresholds",
            ]}
          />
          <RoadmapCard
            phase="Q4 2026"
            items={[
              "Agent-to-agent commerce protocol (RFC)",
              "Reference implementation in this repo",
              "Standards-body engagement",
            ]}
          />
          <RoadmapCard
            phase="2027+"
            items={[
              "Agent KYC/KYA registry",
              "Public reputation system",
              "Network-effect moat",
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function RoadmapCard({
  phase,
  items,
}: {
  phase: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        {phase}
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-neutral-300 flex items-start gap-2">
            <span className="text-emerald-400 mt-1">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

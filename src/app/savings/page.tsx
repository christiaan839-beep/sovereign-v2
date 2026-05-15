"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Clock,
  ShieldCheck,
  TrendingDown,
  DollarSign,
} from "lucide-react";

/**
 * /savings — Audit-prep ROI calculator (Cook 158).
 *
 * Distinct from /roi (which targets agencies). This calculator
 * targets the actual Sovereign buyer: Compliance Officer, CISO,
 * Chief Model Risk Officer, Head of Internal Audit. The headline
 * number is $/year saved on audit prep + the auditor-replay
 * time-savings, plus the procurement-vehicle unlocks via
 * cryptographic-receipts coverage.
 *
 * Hourly rate defaults: $250/hr internal compliance, $450/hr
 * Big-4 audit partner (industry benchmark).
 */

const INTERNAL_RATE = 250; // $/hr — internal compliance / IA staff
const AUDITOR_RATE = 450; // $/hr — Big-4 partner-track
const SOVEREIGN_TIER_NODE = 199 * 12; // $2,388/yr
const AUDITOR_SEAT = 50_000; // $50K/seat/yr

export default function SavingsCalculatorPage() {
  // Buyer-side inputs.
  const [aiAgents, setAiAgents] = useState(8);
  const [auditPrepHoursPerYr, setAuditPrepHoursPerYr] = useState(1_200);
  const [auditorBilledHoursPerYr, setAuditorBilledHoursPerYr] = useState(400);
  const [auditorSeats, setAuditorSeats] = useState(2);
  const [regulatoryPacks, setRegulatoryPacks] = useState(1);

  const result = useMemo(() => {
    // Time savings — internal compliance.
    const internalHoursReclaimed = Math.round(auditPrepHoursPerYr * 0.7);
    const internalSavings = internalHoursReclaimed * INTERNAL_RATE;

    // Time savings — auditor (auditor charges YOU for less prep time).
    const auditorHoursReclaimed = Math.round(auditorBilledHoursPerYr * 0.55);
    const auditorSavings = auditorHoursReclaimed * AUDITOR_RATE;

    // Sovereign cost.
    const seatCost = auditorSeats * AUDITOR_SEAT;
    const packCost = regulatoryPacks > 0 ? regulatoryPacks * 60_000 : 0; // avg pack price
    const sovereignAnnualCost = SOVEREIGN_TIER_NODE + seatCost + packCost;

    // Risk-reduction shadow line (penalty avoidance — see methodology).
    const incidentAvoidance = aiAgents * 25_000; // $25K avg per-agent expected drift fine

    const grossSavings = internalSavings + auditorSavings + incidentAvoidance;
    const netSavings = grossSavings - sovereignAnnualCost;
    const roiPct =
      sovereignAnnualCost > 0
        ? Math.round((netSavings / sovereignAnnualCost) * 100)
        : 0;
    const paybackMonths =
      grossSavings > 0
        ? Math.max(
            1,
            Math.round((sovereignAnnualCost / (grossSavings / 12)) * 10) / 10,
          )
        : 0;

    return {
      internalHoursReclaimed,
      internalSavings,
      auditorHoursReclaimed,
      auditorSavings,
      sovereignAnnualCost,
      seatCost,
      packCost,
      incidentAvoidance,
      grossSavings,
      netSavings,
      roiPct,
      paybackMonths,
    };
  }, [
    aiAgents,
    auditPrepHoursPerYr,
    auditorBilledHoursPerYr,
    auditorSeats,
    regulatoryPacks,
  ]);

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
              href="/pricing"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Pricing
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
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-cyan-400" />
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400">
            Audit-Prep ROI Calculator
          </p>
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          How much will{" "}
          <span className="text-cyan-400">audit-prep automation</span> save you
          per year?
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Built for the Chief Compliance Officer, Chief Model Risk Officer, and
          Head of Internal Audit. Plug in the numbers you already know; the
          model uses industry benchmark rates ($250/hr internal, $450/hr Big-4
          partner) and the actual Sovereign pricing from{" "}
          <Link href="/pricing" className="text-cyan-400 underline">
            /pricing
          </Link>
          .
        </p>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-5 gap-8">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-3">
            Your numbers
          </h2>
          <NumberInput
            label="AI agents you operate"
            hint="Across all business units. Each agent that touches a regulated decision."
            value={aiAgents}
            onChange={setAiAgents}
            min={1}
            max={500}
          />
          <NumberInput
            label="Audit-prep hours per year (internal)"
            hint="Compliance + IA team hours spent assembling evidence packs."
            value={auditPrepHoursPerYr}
            onChange={setAuditPrepHoursPerYr}
            min={0}
            max={50_000}
            step={50}
          />
          <NumberInput
            label="Auditor billed hours per year"
            hint="Big-4 / external auditor partner-track hours billed to you."
            value={auditorBilledHoursPerYr}
            onChange={setAuditorBilledHoursPerYr}
            min={0}
            max={20_000}
            step={50}
          />
          <NumberInput
            label="Auditor Replay Seats"
            hint="One seat per external auditor or regulator examiner. $50K/seat/yr."
            value={auditorSeats}
            onChange={setAuditorSeats}
            min={0}
            max={20}
          />
          <NumberInput
            label="Regulatory packs"
            hint="CSRD · SR 11-7 · NERC CIP · 21 CFR Part 11 · FedRAMP. Avg $60K/pack/yr."
            value={regulatoryPacks}
            onChange={setRegulatoryPacks}
            min={0}
            max={6}
          />
        </div>

        {/* Results */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-3">
            Your savings
          </h2>

          <div className="p-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.05]">
            <p className="text-[11px] uppercase tracking-wider text-cyan-300 mb-2">
              Net savings per year
            </p>
            <p className="text-5xl font-black text-white tabular-nums">
              ${result.netSavings.toLocaleString()}
            </p>
            <div className="mt-4 flex items-center gap-6 text-xs text-neutral-400">
              <span>
                ROI:{" "}
                <span className="text-cyan-400 font-semibold">
                  {result.roiPct}%
                </span>
              </span>
              <span>
                Payback:{" "}
                <span className="text-cyan-400 font-semibold">
                  {result.paybackMonths} months
                </span>
              </span>
            </div>
          </div>

          <ResultRow
            icon={Clock}
            label={`Internal compliance time reclaimed (${result.internalHoursReclaimed} hrs @ $${INTERNAL_RATE}/hr)`}
            amount={`+$${result.internalSavings.toLocaleString()}`}
            positive
          />
          <ResultRow
            icon={Clock}
            label={`Auditor-billed hours reclaimed (${result.auditorHoursReclaimed} hrs @ $${AUDITOR_RATE}/hr)`}
            amount={`+$${result.auditorSavings.toLocaleString()}`}
            positive
          />
          <ResultRow
            icon={ShieldCheck}
            label={`Incident / drift penalty avoidance (${aiAgents} agents × $25K)`}
            amount={`+$${result.incidentAvoidance.toLocaleString()}`}
            positive
          />
          <div className="border-t border-white/[0.06] pt-3">
            <ResultRow
              icon={DollarSign}
              label={`Sovereign tier (Node, $${SOVEREIGN_TIER_NODE.toLocaleString()}/yr)`}
              amount={`-$${SOVEREIGN_TIER_NODE.toLocaleString()}`}
            />
            <ResultRow
              icon={DollarSign}
              label={`${auditorSeats} Auditor Replay Seats × $50K`}
              amount={`-$${result.seatCost.toLocaleString()}`}
            />
            <ResultRow
              icon={DollarSign}
              label={`${regulatoryPacks} Regulatory Pack(s) × $60K`}
              amount={`-$${result.packCost.toLocaleString()}`}
            />
          </div>
          <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
            <p className="text-sm text-neutral-300 font-medium">
              Gross savings - Sovereign cost
            </p>
            <p className="text-lg text-cyan-400 font-bold tabular-nums">
              ${result.netSavings.toLocaleString()} / yr
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Savings%20Quote&body=I%20ran%20the%20%2Fsavings%20calculator%20with:%0A%20-%20${aiAgents}%20AI%20agents%0A%20-%20${auditPrepHoursPerYr}%20audit-prep%20hours%2Fyr%0A%20-%20${auditorBilledHoursPerYr}%20auditor%20billed%20hours%2Fyr%0A%20-%20${auditorSeats}%20Auditor%20Replay%20Seats%0A%20-%20${regulatoryPacks}%20Regulatory%20Pack(s)%0A%0AModel%20projects%20%24${result.netSavings.toLocaleString()}%2Fyr%20net%20savings.%20Worth%20a%20call%3F`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
            >
              Email this quote
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">
              Methodology + assumptions
            </h3>
          </div>
          <ul className="text-xs text-neutral-400 leading-relaxed space-y-1.5">
            <li>
              <span className="text-neutral-300">
                Internal time savings (70%):
              </span>{" "}
              audit-bundle subscription (Cook 18 / 56) auto-assembles evidence
              packs that today require manual screenshot-stitching by compliance
              staff.
            </li>
            <li>
              <span className="text-neutral-300">
                Auditor time savings (55%):
              </span>{" "}
              the auditor verifies receipts in their own workpaper system via
              the Auditor Replay Seat — no PBC-list ping-pong, no rework of
              fragmented evidence.
            </li>
            <li>
              <span className="text-neutral-300">
                Incident avoidance ($25K/agent):
              </span>{" "}
              average regulatory penalty exposure per AI agent operating without
              cryptographic chain-of-custody (NERC CIP fines start at $1M/day;
              this is a conservative blended figure across the eight verticals).
            </li>
            <li>
              <span className="text-neutral-300">Hourly rates:</span> $250/hr
              internal compliance (industry midpoint), $450/hr Big-4
              partner-track (Big-4 standard bill rate).
            </li>
            <li>
              <span className="text-neutral-300">
                Excluded from this calculator:
              </span>{" "}
              revenue upside from earlier procurement closes, brand-trust gains,
              and the regulator-as-customer opportunity if you become an
              industry-reference deployment.
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            See the math live with your auditor on the call.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Forward this URL to your Big-4 engagement partner. They run the
            numbers; we book the 30-minute call where you both watch a real
            receipt verify cryptographically.
          </p>
          <Link
            href="/demo/verify-receipt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Watch a receipt verify
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/pricing" className="hover:text-neutral-300">
            Pricing
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

interface NumberInputProps {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberInput({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
}: NumberInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1.5">
        {label}
      </label>
      {hint && <p className="text-[11px] text-neutral-500 mb-2">{hint}</p>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isNaN(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
        className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-4 py-2.5 font-mono text-sm text-cyan-100 placeholder:text-neutral-600 focus:border-cyan-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
      />
    </div>
  );
}

interface ResultRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: string;
  positive?: boolean;
}

function ResultRow({ icon: Icon, label, amount, positive }: ResultRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
        <p className="text-xs text-neutral-300 truncate">{label}</p>
      </div>
      <p
        className={`text-sm font-semibold tabular-nums shrink-0 ${
          positive ? "text-emerald-400" : "text-neutral-400"
        }`}
      >
        {amount}
      </p>
    </div>
  );
}

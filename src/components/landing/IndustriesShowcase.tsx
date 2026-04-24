"use client";

/**
 * IndustriesShowcase — connects the 10 live industry pages on the landing.
 *
 * WHY
 * ───
 * We shipped /for-insurance, /for-logistics, /for-healthcare, etc. — but
 * the landing page didn't surface them as a unit. A visitor on the home
 * page had no way to discover "oh, you have an insurance play" without
 * scrolling to the footer. This section makes the vertical depth visible.
 *
 * DESIGN
 * ──────
 * Editorial 2-column layout matching the landing aesthetic:
 *   - Left: lead copy + ed-display headline
 *   - Right: 10 industry cards in a tight grid
 * Each card is a keyboard-focusable <Link> with industry icon + name
 * + a proof point (market size or specific agent count).
 *
 * BREAKS template-echo critique: each card shows a DIFFERENT proof
 * shape based on the industry, not "same number different color".
 */

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart,
  Scale,
  Home,
  Users,
  Shield,
  GraduationCap,
  ShieldAlert,
  Truck,
  Sprout,
  HardHat,
  ArrowRight,
} from "lucide-react";

interface Industry {
  slug: string;
  name: string;
  icon: typeof Heart;
  proof: string;
  color: "cyan" | "violet" | "amber" | "emerald" | "orange" | "rose" | "blue" | "indigo";
  href: string;
}

const INDUSTRIES: Industry[] = [
  {
    slug: "insurance",
    name: "Insurance",
    icon: ShieldAlert,
    proof: "$1.4T · FNOL + COI + claims triage",
    color: "rose",
    href: "/for-insurance",
  },
  {
    slug: "logistics",
    name: "Logistics & Freight",
    icon: Truck,
    proof: "$11T · BOL + HS codes + TMS",
    color: "amber",
    href: "/for-logistics",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    icon: Heart,
    proof: "$350B admin · ICD-10 + prior auth",
    color: "cyan",
    href: "/for-healthcare",
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    icon: Sprout,
    proof: "$5T · soil + crop scouting",
    color: "emerald",
    href: "/for-agriculture",
  },
  {
    slug: "construction",
    name: "Construction",
    icon: HardHat,
    proof: "$1.8T · permits + OSHA 300",
    color: "orange",
    href: "/for-construction",
  },
  {
    slug: "legal",
    name: "Legal",
    icon: Scale,
    proof: "NDA triage + contract review",
    color: "violet",
    href: "/for-legal",
  },
  {
    slug: "realestate",
    name: "Real Estate",
    icon: Home,
    proof: "Blueprints + listings + CMA",
    color: "indigo",
    href: "/for-realestate",
  },
  {
    slug: "recruiting",
    name: "Recruiting",
    icon: Users,
    proof: "Resume + screening + offers",
    color: "blue",
    href: "/for-recruiting",
  },
  {
    slug: "cybersecurity",
    name: "Security",
    icon: Shield,
    proof: "Vuln scan + incident response",
    color: "rose",
    href: "/for-cybersecurity",
  },
  {
    slug: "education",
    name: "Education",
    icon: GraduationCap,
    proof: "Curriculum + grading + plans",
    color: "cyan",
    href: "/for-education",
  },
];

// Tailwind v4 JIT safe-list: literal class names so the scanner sees them.
const COLOR_MAP: Record<Industry["color"], { iconBg: string; iconFg: string; hover: string }> = {
  cyan: { iconBg: "bg-cyan-500/[0.08]", iconFg: "text-cyan-300", hover: "hover:border-cyan-500/30" },
  violet: { iconBg: "bg-violet-500/[0.08]", iconFg: "text-violet-300", hover: "hover:border-violet-500/30" },
  amber: { iconBg: "bg-amber-500/[0.08]", iconFg: "text-amber-300", hover: "hover:border-amber-500/30" },
  emerald: { iconBg: "bg-emerald-500/[0.08]", iconFg: "text-emerald-300", hover: "hover:border-emerald-500/30" },
  orange: { iconBg: "bg-orange-500/[0.08]", iconFg: "text-orange-300", hover: "hover:border-orange-500/30" },
  rose: { iconBg: "bg-rose-500/[0.08]", iconFg: "text-rose-300", hover: "hover:border-rose-500/30" },
  blue: { iconBg: "bg-blue-500/[0.08]", iconFg: "text-blue-300", hover: "hover:border-blue-500/30" },
  indigo: { iconBg: "bg-indigo-500/[0.08]", iconFg: "text-indigo-300", hover: "hover:border-indigo-500/30" },
};

export function IndustriesShowcase() {
  return (
    <section className="relative py-24 md:py-32 px-6 border-y border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            INDUSTRIES
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Depth across 10 verticals.
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.04]" />
        </div>

        <div className="grid md:grid-cols-12 gap-10 md:gap-14 items-start">
          {/* Lead copy */}
          <div className="md:col-span-5">
            <h2 className="ed-display text-3xl md:text-5xl leading-[1.02] mb-6">
              Not a horizontal tool.<br />
              <span className="ed-display-italic text-[#B5532C]">A vertical stack.</span>
            </h2>
            <p className="text-sm md:text-base text-neutral-400 leading-relaxed mb-6">
              218 agents grouped into 10 industries — each with output shapes
              that plug straight into the incumbent system of record.
              Guidewire for insurance. McLeod for freight. John Deere Operations
              Center for ag. Procore for construction. You don&apos;t replace the
              system; you sit upstream of it.
            </p>
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-[#B5532C] transition-colors"
            >
              See the full comparison <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Industries grid */}
          <div className="md:col-span-7">
            <div className="grid grid-cols-2 gap-2.5">
              {INDUSTRIES.map((ind, i) => {
                const cls = COLOR_MAP[ind.color];
                return (
                  <motion.div
                    key={ind.slug}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{
                      duration: 0.5,
                      delay: (i % 5) * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link
                      href={ind.href}
                      className={`group block px-4 py-4 rounded-[4px] border border-white/[0.06] bg-[#060606] transition-all ${cls.hover} hover:bg-white/[0.02]`}
                    >
                      <div className="flex items-start gap-3 mb-2.5">
                        <div
                          className={`w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 ${cls.iconBg}`}
                        >
                          <ind.icon className={`w-4 h-4 ${cls.iconFg}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight group-hover:text-[#E8DDD0] transition-colors">
                            {ind.name}
                          </p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-neutral-600 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-400" />
                      </div>
                      <p className="font-mono text-[10px] text-neutral-500 leading-snug pl-[44px]">
                        {ind.proof}
                      </p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

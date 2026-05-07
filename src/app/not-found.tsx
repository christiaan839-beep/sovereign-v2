"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Home, Search } from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * 404 — branded to the current palette (#030303 base, copper accent
 * #B5532C, emerald CTAs). Replaces the legacy cyan/purple gradient
 * that pre-dated the brand refresh.
 *
 * The page is intentionally thin: a logo, a hero "404", a sentence
 * of context, and three out-routes — Home, /lead-engine (the wedge
 * landing), and /standards (a credibility door for prospects who
 * land here from a stale share). 404s aren't dead-ends; they're
 * conversion opportunities for the right visitor.
 */

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100 relative overflow-hidden">
      {/* Subtle copper radial — same primitive as /api/og */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[700px] w-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(181,83,44,0.12), transparent 60%)",
        }}
      />

      <nav className="relative border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <Link
            href="/status"
            className="text-xs text-neutral-500 hover:text-emerald-400 transition"
          >
            Platform status &rarr;
          </Link>
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-3xl px-6 pt-24 pb-20"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">
          404 &middot; not found
        </p>

        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          That page isn&rsquo;t here.
        </h1>

        <p className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-xl">
          The link is broken, the page moved, or it never existed. None of those
          are interesting answers — these are.
        </p>

        <div className="mt-12 grid gap-3 md:grid-cols-3">
          <NextStepCard
            icon={Home}
            title="Home"
            detail="The whole pitch in one scroll."
            href="/"
          />
          <NextStepCard
            icon={ArrowRight}
            title="Lead Engine"
            detail="50 hand-reviewed B2B leads / 30 days. Refund clause included."
            href="/lead-engine"
          />
          <NextStepCard
            icon={Search}
            title="Standards"
            detail="The bars we hold ourselves to. Surface-level proof of how we operate."
            href="/standards"
          />
        </div>
      </motion.div>

      <footer className="relative border-t border-white/5 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-neutral-600">
          Sovereign Matrix &middot; If this 404 came from one of our links, let
          us know at{" "}
          <a
            href="mailto:hello@sovereignmatrix.agency"
            className="text-emerald-400/80 hover:text-emerald-400 transition"
          >
            hello@sovereignmatrix.agency
          </a>
        </div>
      </footer>
    </main>
  );
}

function NextStepCard({
  icon: Icon,
  title,
  detail,
  href,
}: {
  icon: typeof Home;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.04]"
    >
      <Icon className="h-5 w-5 text-emerald-400" />
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{detail}</p>
      <span className="mt-4 inline-block text-sm text-emerald-400 group-hover:translate-x-0.5 transition">
        Go &rarr;
      </span>
    </Link>
  );
}

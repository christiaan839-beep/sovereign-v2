"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * FOUNDER SEATS — renders the 100-seat cohort as a ring of circles
 * around a single Slack-DM focal element. Filled seats come from
 * /api/_misc/founder-network-status; we fall back to 0 claimed
 * rather than inventing a number.
 *
 * TOTAL_SEATS is the hard cap (100). VISIBLE_SEATS (7) is only the
 * representative sample we render — never a source of truth for
 * availability.
 */

interface FounderStatus {
  claimed: number;
  total: number;
}

const TOTAL_SEATS = 100;
const VISIBLE_SEATS = 7; // Seats we render as circles — representative sample
const FALLBACK_CLAIMED = 0; // Start honest. Update when real signups arrive.

export function FounderSeats() {
  const [status, setStatus] = useState<FounderStatus>({
    claimed: FALLBACK_CLAIMED,
    total: TOTAL_SEATS,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    fetch("/api/_misc/founder-network-status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.claimed === "number") {
          setStatus({
            claimed: data.claimed,
            total: data.total ?? TOTAL_SEATS,
          });
        }
      })
      .catch(() => {
        /* Silent fallback to honest zero state */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = Math.max(0, status.total - status.claimed);
  const claimedPct = Math.min(1, status.claimed / status.total);
  // Spread VISIBLE_SEATS claimed-dots proportionally to the real ratio.
  // Never show MORE filled than what exists: if only 3 total claimed,
  // only 3 dots are filled regardless of visible count.
  const filledVisible = Math.min(
    VISIBLE_SEATS,
    Math.round(claimedPct * VISIBLE_SEATS),
  );

  return (
    <section className="relative px-6 py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
      {/* Ambient radial glow — very subtle, copper */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(181,83,44,0.35) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-4">
          Chapter IV · Founder Network
        </p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-4 max-w-3xl">
          100 seats.
          <br />
          <em className="not-italic text-[#B5532C]">
            The person who wrote the code is on Slack.
          </em>
        </h2>
        <p className="text-neutral-400 max-w-2xl text-lg leading-relaxed mb-14">
          A small cohort paying 50% of Growth price, getting monthly 1:1s,
          and shaping the roadmap. No inbox triage, no support tiers —
          you message me, I reply.
        </p>

        {/* Seat visualization */}
        <div className="relative h-[260px] mb-14">
          {/* Center focal: conversation bubble */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="relative rounded-2xl bg-[#0A0807] border border-[#B5532C]/40 px-6 py-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] max-w-[280px]">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2">
                → Slack DM from Christiaan
              </p>
              <p className="font-serif text-[15px] leading-snug text-white">
                Welcome to the Founder Network. What can I build for you this
                week?
              </p>

              {/* Bubble pointer (subtle) */}
              <div
                className="absolute -bottom-2 left-8 h-3 w-3 rotate-45 bg-[#0A0807] border-b border-r border-[#B5532C]/40"
              />
            </div>
          </motion.div>

          {/* Ring of seats around the focal element */}
          {Array.from({ length: VISIBLE_SEATS }).map((_, i) => {
            const angle = (i / VISIBLE_SEATS) * Math.PI * 2 - Math.PI / 2; // start top
            const radius = 130;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isFilled = i < filledVisible;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: 0.2 + i * 0.07,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              >
                {isFilled ? (
                  <FilledSeat index={i} />
                ) : (
                  <OpenSeat />
                )}
              </motion.div>
            );
          })}

          {/* Subtle connection lines from each seat to the center */}
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 800 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {Array.from({ length: VISIBLE_SEATS }).map((_, i) => {
              const angle = (i / VISIBLE_SEATS) * Math.PI * 2 - Math.PI / 2;
              const radius = 130;
              const x = 400 + Math.cos(angle) * radius;
              const y = 130 + Math.sin(angle) * radius;
              return (
                <motion.line
                  key={i}
                  x1="400"
                  y1="130"
                  x2={x}
                  y2={y}
                  stroke="rgba(181,83,44,0.15)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.06 }}
                />
              );
            })}
          </svg>
        </div>

        {/* Live cohort counter */}
        <div className="flex items-baseline gap-4 mb-10">
          <span className="font-serif text-6xl md:text-7xl text-white tabular-nums">
            {remaining}
          </span>
          <span className="font-mono text-sm text-neutral-500 uppercase tracking-wider">
            of {status.total} seats remaining
          </span>
        </div>

        {/* Founder terms — three precise lines, not cards */}
        <div className="space-y-3 mb-10 text-[15px] text-neutral-300 max-w-2xl">
          <SeatTerm label="$24.50/month" detail="50% off Growth tier, locked in for your subscription's lifetime." />
          <SeatTerm label="Direct Slack to the founder" detail="Not a community board. The person who wrote the code." />
          <SeatTerm label="Monthly 30-minute 1:1" detail="Tell me what's broken. Tell me what you need. I'll ship it." />
          <SeatTerm label="Optional case-study partnership" detail="You review every word. Kill the draft if the numbers don't tell the story you want told." />
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup?plan=founder-network"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-[#B5532C] text-white font-mono text-sm tracking-wide hover:bg-[#A04527] transition-colors"
          >
            Claim your seat
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/customers"
            className="inline-flex items-center px-6 py-3 border border-white/[0.1] text-neutral-400 font-mono text-sm tracking-wide hover:border-white/30 hover:text-white transition-colors"
          >
            Read the case studies →
          </Link>
        </div>
      </div>
    </section>
  );
}

function FilledSeat({ index }: { index: number }) {
  return (
    <div className="relative">
      <div className="h-10 w-10 rounded-full bg-[#B5532C]/90 border border-[#B5532C] flex items-center justify-center shadow-[0_0_20px_rgba(181,83,44,0.3)]">
        <span className="font-mono text-[10px] font-semibold text-white">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function OpenSeat() {
  return (
    <div className="h-10 w-10 rounded-full border border-dashed border-white/[0.15] hover:border-[#B5532C]/50 transition-colors" />
  );
}

function SeatTerm({ label, detail }: { label: string; detail: string }) {
  return (
    <p className="leading-snug">
      <span className="text-[#B5532C] font-mono mr-3">—</span>
      <span className="font-serif text-lg text-white">{label}.</span>{" "}
      <span className="text-neutral-400">{detail}</span>
    </p>
  );
}

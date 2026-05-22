"use client";

/**
 * SOVEREIGN MATRIX — `/immersive` preview surface (Wave 121).
 *
 * Cinematic 3-section sticky-scroll landing inspired by the
 * TEXTURA.US Ithaca reference, rebuilt around the Sovereign wedge:
 * verifiable receipts. The pages already live (/, /metrics, /verify,
 * /investors); this is the dramatic "trailer" version a creator or
 * VC sees and immediately gets the energy of the platform.
 *
 *   Section 01 — A VERIFIABLE INTERFACE   (orb · cyan)
 *   Section 02 — EVERY OUTPUT, PROVABLE   (orb · cyan · pulsing live)
 *   Section 03 — ENTER THE AUDIT GRADE    (orb · copper · CTA)
 *
 * The orb is the SAME component across all three sections — the camera
 * doesn't physically move, the framing + copy + accent + pulse rhythm
 * change as the visitor scrolls. Cheaper to render, more consistent
 * to perceive, and the visual continuity matches the brand line that
 * every Sovereign output is one continuous receipt fabric.
 *
 * Performance:
 *   - The Canvas is sticky-positioned (`position: sticky`) so the
 *     visitor scrolls FOREGROUND copy past a stationary 3D scene.
 *     One canvas, one orb, one renderer instance.
 *   - prefers-reduced-motion auto-disables the orb's idle rotation +
 *     pulse and replaces the scroll-pinned canvas with a static
 *     receipt-grid backdrop.
 *
 * No data dependency — pure marketing surface. Linked from landing
 * footer + /investors so VCs can land directly on the cinematic.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, FileSignature, Activity } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { HudFrame } from "@/components/landing/HudFrame";
import { SystemBootLoader } from "@/components/landing/SystemBootLoader";

// Heavy 3D component — dynamic-imported with SSR off so the static
// HTML stays fast + we never ship Three.js to a search crawler.
const ReceiptOrb = dynamic(
  () =>
    import("@/components/landing/ReceiptOrb").then((m) => ({
      default: m.ReceiptOrb,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-full w-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(34,211,238,0.08) 0%, transparent 60%)",
        }}
      />
    ),
  },
);

interface Section {
  id: string;
  frameId: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta?: { href: string; label: string };
  accent: "cyan" | "copper";
}

const SECTIONS: Section[] = [
  {
    id: "section-1",
    frameId: "01 / 03",
    eyebrow: "VAOS RECEIPT FABRIC",
    headline: "A VERIFIABLE INTERFACE.",
    sub: "Every agent output ships with a signed receipt — HMAC-SHA256 today, ML-DSA-65 (post-quantum) on every run. The page you're reading is the manufacturing line; the receipts are the product.",
    accent: "cyan",
  },
  {
    id: "section-2",
    frameId: "02 / 03",
    eyebrow: "PROOF, NOT PROMISES",
    headline: "EVERY OUTPUT,\nPROVABLE.",
    sub: "Paste a receipt ID. Watch your browser SHA-256 the canonical body, request HMAC verification, and confirm authenticity in under a second. No login. No API key. The verifier is open.",
    cta: { href: "/verify", label: "Verify a receipt now" },
    accent: "cyan",
  },
  {
    id: "section-3",
    frameId: "03 / 03",
    eyebrow: "AUDIT-GRADE BY DEFAULT",
    headline: "ENTER THE\nAUDIT GRADE.",
    sub: "141 agents. 3 DAG playbooks live. Cost saved · 30d published on /metrics. Adversarial block rate ≥95%, ML-DSA-65 signed. The verification layer for AI — not just another agent platform.",
    cta: { href: "/investors", label: "See the diligence proof" },
    accent: "copper",
  },
];

export default function ImmersivePage() {
  const [activeSection, setActiveSection] = useState(0);
  const [pulseToken, setPulseToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  // IntersectionObserver tracks which section is in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.findIndex(
              (s) => s === entry.target,
            );
            if (idx >= 0) {
              setActiveSection(idx);
              // Fire a pulse on every section change — the orb breathes
              // with the visitor's scroll position.
              setPulseToken((t) => t + 1);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    sectionRefs.current.forEach((s) => s && observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Bonus: idle pulse every 6s so the orb has a heartbeat even when
  // nothing else is happening.
  useEffect(() => {
    const id = window.setInterval(() => setPulseToken((t) => t + 1), 6000);
    return () => window.clearInterval(id);
  }, []);

  const current = SECTIONS[activeSection];

  return (
    <main ref={containerRef} className="relative bg-[#020202] text-neutral-200">
      <SystemBootLoader />

      {/* Sticky 3D canvas — sits behind all sections, never re-mounts */}
      <div className="sticky top-0 -mb-[100vh] h-screen w-full">
        <ReceiptOrb
          pulseToken={pulseToken}
          accent={current?.accent ?? "cyan"}
          className="h-full w-full"
        />
        <HudFrame
          frameId={current?.frameId}
          systemLabel="SYS·LINK ESTABLISHED"
          frameLabel="FRAME LOCKED"
          buildLabel="VAOS · v2.1"
        />
      </div>

      {/* Foreground scrolling sections */}
      <div className="relative z-10">
        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className="relative flex min-h-screen items-center justify-center px-6 py-24 sm:px-12"
            data-frame={s.frameId}
          >
            <div className="relative mx-auto w-full max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.6 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                <div
                  className={`mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] ${
                    s.accent === "cyan"
                      ? "text-cyan-300/80"
                      : "text-amber-300/80"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-1 w-6 bg-current"
                  />
                  {s.eyebrow}
                </div>
                <h2 className="font-serif text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-white whitespace-pre-line">
                  {s.headline}
                </h2>
                <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-neutral-400 sm:text-[16px]">
                  {s.sub}
                </p>
                {s.cta && (
                  <div className="mt-8">
                    <Link
                      href={s.cta.href}
                      className={`group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020202] ${
                        s.accent === "cyan"
                          ? "bg-cyan-500/[0.12] text-cyan-200 hover:bg-cyan-500/[0.20] focus-visible:ring-cyan-500/50"
                          : "bg-amber-500/[0.12] text-amber-200 hover:bg-amber-500/[0.20] focus-visible:ring-amber-500/50"
                      }`}
                    >
                      {s.cta.label}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Section index dots on the right edge */}
            <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
              {SECTIONS.map((_, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() =>
                    sectionRefs.current[j]?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  aria-label={`Jump to section ${j + 1}`}
                  className="group flex h-6 items-center"
                >
                  <span
                    className={`h-px transition-all ${
                      j === activeSection
                        ? "w-8 bg-cyan-300"
                        : "w-3 bg-neutral-700 group-hover:w-5 group-hover:bg-neutral-500"
                    }`}
                  />
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Footer cross-links to the destinations the cinematic points to */}
        <footer className="relative z-10 border-t border-white/[0.06] bg-[#020202] px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h3 className="mb-6 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Continue
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <ContinueCard
                icon={<FileSignature className="h-4 w-4" />}
                title="Verify a receipt"
                sub="Paste an ID. Watch the math."
                href="/verify"
              />
              <ContinueCard
                icon={<Activity className="h-4 w-4" />}
                title="Live metrics"
                sub="Cost saved, block rate, p95 latency — live."
                href="/metrics"
              />
              <ContinueCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Diligence proof"
                sub="The investor data-room."
                href="/investors"
              />
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function ContinueCard({
  icon,
  title,
  sub,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-cyan-500/20 hover:bg-cyan-500/[0.04] focus-visible:ring-2 focus-visible:ring-cyan-500/40"
    >
      <span className="mt-0.5 text-cyan-300">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="block text-[12px] text-neutral-500">{sub}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
    </Link>
  );
}

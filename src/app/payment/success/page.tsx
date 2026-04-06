"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Shield, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface ParticleProps {
  id: number;
  delay: number;
  startX: number;
  targetX: number;
  color: string;
}

function ConfettiParticle({ p }: { p: ParticleProps }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: p.color, left: `${p.startX}%`, top: -10 }}
      initial={{ y: -20, opacity: 1, rotate: 0 }}
      animate={{ y: 600, opacity: 0, rotate: 720, x: p.targetX }}
      transition={{ duration: 2.5, delay: p.delay, ease: "easeOut" }}
    />
  );
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  node: "Sovereign Node",
  array: "Sovereign Array",
  enterprise: "Enterprise License",
};

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const provider = searchParams.get("provider") || "";
  const planLabel = PLAN_LABELS[plan] || "Subscription";

  const [particles, setParticles] = useState<ParticleProps[]>([]);

  useEffect(() => {
    const colors = ["#10B981", "#00B7FF", "#a855f7", "#f59e0b", "#f43f5e"];
    const p = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      delay: Math.random() * 0.8,
      startX: Math.random() * 100,
      targetX: (Math.random() - 0.5) * 200,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setTimeout(() => setParticles(p), 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#010101] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-500/[0.08] rounded-full blur-[200px]" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <ConfettiParticle key={p.id} p={p} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-8 shadow-[0_0_60px_rgba(16,185,129,0.25)]"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
          You&apos;re in. Welcome aboard.
        </h1>
        <p className="text-neutral-400 text-base mb-8 max-w-md mx-auto">
          Your <span className="text-white font-medium">{planLabel}</span> plan is active.
          All 130+ agents and 65+ models are ready to use.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <Shield className="w-3 h-3" /> Payment confirmed
          </span>
          {provider && (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              via {provider}
            </span>
          )}
          <span className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            <Sparkles className="w-3 h-3" /> All agents unlocked
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm hover:bg-neutral-200 transition-gpu group"
          >
            Go to dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/dashboard/mission-control"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/[0.04] border border-white/[0.08] text-white font-medium text-sm hover:bg-white/[0.08] transition-gpu"
          >
            Run your first playbook
          </Link>
        </div>

        <p className="text-neutral-500 text-xs flex items-center justify-center gap-1.5">
          <Mail className="w-3 h-3" /> Receipt sent to your email.
        </p>
      </motion.div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    // useSearchParams needs a Suspense boundary in the App Router.
    <Suspense fallback={<div className="min-h-screen bg-[#010101]" />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

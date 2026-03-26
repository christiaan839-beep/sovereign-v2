"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Sparkles, Zap, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function PaymentSuccessPage() {
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[200px]" />
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
          className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8 shadow-[0_0_60px_rgba(16,185,129,0.3)]"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-bold text-white serif-text mb-4">Deployment Authorized.</h1>
        <p className="text-neutral-400 text-lg mb-10 max-w-md mx-auto">
          Your Sovereign Matrix node is being provisioned. The AI swarm is initializing your autonomous operations.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-widest text-emerald-400">
            <Shield className="w-3 h-3" /> Payment Verified
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-neutral-400">
            <Zap className="w-3 h-3" /> Node Provisioning
          </span>
          <span className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-neutral-400">
            <Sparkles className="w-3 h-3" /> Swarm Active
          </span>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-gpu shadow-[0_0_40px_rgba(255,255,255,0.2)] group"
        >
          Enter Command Center
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>

        <p className="text-neutral-600 text-xs mt-8 font-mono">
          A confirmation email has been dispatched to your registered address.
        </p>
      </motion.div>
    </div>
  );
}

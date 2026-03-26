"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00B7FF]/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-12">
          <SovereignLogo size="md" />
          <span className="text-xl font-bold tracking-[0.2em] uppercase text-white font-serif">SOVEREIGN</span>
        </div>

        <div className="text-[120px] md:text-[180px] font-bold text-white/5 font-mono leading-none select-none mb-4">
          404
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 -mt-16 serif-text">
          Page not found
        </h1>
        
        <p className="text-neutral-400 max-w-md mx-auto mb-12 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#00B7FF] to-[#a855f7] text-white font-bold cta-glow transition-gpu hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4" /> Go Home
          </Link>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-glass-border bg-glass-bg text-white font-bold hover:bg-white/5 transition-gpu"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-8 text-xs text-neutral-600">
        © 2026 SOVEREIGN. All rights reserved.
      </div>
    </div>
  );
}

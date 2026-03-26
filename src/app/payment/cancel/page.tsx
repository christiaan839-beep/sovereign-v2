"use client";

import { motion } from "framer-motion";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[200px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto mb-8"
        >
          <XCircle className="w-10 h-10 text-neutral-500" />
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">Deployment Aborted.</h1>
        <p className="text-neutral-500 mb-10 max-w-sm mx-auto">
          No charges were made. Your session has been safely terminated. You can restart the authorization process at any time.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-gpu"
          >
            <RefreshCw className="w-4 h-4" /> Retry Deployment
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-gpu"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Base
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

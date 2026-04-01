"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function ClientPortalLogin() {
  const [accessValue, setAccessValue] = useState("");
  const [mode, setMode] = useState<"id" | "email">("id");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessValue.trim()) return;

    setIsLoading(true);
    setTimeout(() => {
      const encoded = encodeURIComponent(accessValue.trim());
      router.push(`/portal/${encoded}`);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)] mb-6"
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-widest uppercase">
            Client Portal
          </h1>
          <p className="text-neutral-500 text-sm mt-2 text-center max-w-xs">
            Access your live dashboard to see campaign results and AI agent activity.
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="backdrop-blur-xl bg-white/[0.03] rounded-2xl p-8 border border-white/[0.06]"
        >
          {/* Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode("id")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                mode === "id"
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Client ID
            </button>
            <button
              type="button"
              onClick={() => setMode("email")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                mode === "email"
                  ? "bg-white/10 text-white border border-white/10"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Email
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                {mode === "id" ? "Client Access ID" : "Email Address"}
              </label>
              <div className="relative">
                {mode === "id" ? (
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                ) : (
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                )}
                <input
                  type={mode === "id" ? "text" : "email"}
                  value={accessValue}
                  onChange={(e) => setAccessValue(e.target.value)}
                  placeholder={
                    mode === "id" ? "Enter your client ID" : "Enter your email"
                  }
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading || !accessValue.trim()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl bg-white text-[#030303] font-bold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-[#030303]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                <>
                  View your dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </div>
        </form>

        <p className="text-center text-[10px] text-neutral-600 mt-8 uppercase tracking-[0.2em]">
          Powered by Sovereign Autonomous Systems
        </p>
      </motion.div>
    </div>
  );
}

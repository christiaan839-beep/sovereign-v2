"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowRight, X } from "lucide-react";

/**
 * CheckoutSuccess — Shows a welcome modal when user returns from Stripe checkout.
 * Detects ?checkout=success&plan=... in the URL and cleans up after display.
 */
export function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [plan, setPlan] = useState("");

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setPlan(searchParams.get("plan") || "your new plan");
      setShow(true);
      // Clean the URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("plan");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  const dismiss = () => setShow(false);

  const PLAN_NAMES: Record<string, string> = {
    starter: "Starter",
    array: "Growth",
    node: "Sovereign Node",
    enterprise: "Enterprise",
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#0A0A0A] shadow-2xl overflow-hidden"
          >
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2">
                Welcome to {PLAN_NAMES[plan] || plan}!
              </h2>
              <p className="text-sm text-neutral-400 mb-8">
                Your subscription is active. All features for your plan are now unlocked.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => { dismiss(); router.push("/dashboard/playbooks"); }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  Run your first playbook <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={dismiss}
                  className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-neutral-300 text-sm hover:bg-white/10 transition-colors"
                >
                  Explore dashboard
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

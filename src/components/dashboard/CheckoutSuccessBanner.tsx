"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * CheckoutSuccessBanner — shown when a user returns from Stripe with
 * ?checkout=success&plan=<planId> in the URL.
 *
 * Reads URL params from window.location (avoids Suspense requirement of
 * useSearchParams in Next.js App Router). Cleans the param from the URL
 * via history.replaceState so a hard refresh doesn't re-show it.
 *
 * Auto-dismisses after 10 seconds.
 */

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  array: "Growth",
  node: "Sovereign Node",
  enterprise: "Enterprise",
};

const PLAN_MESSAGES: Record<string, string> = {
  starter: "200 runs/month and 50 A2E credits are now live on your account.",
  array: "500 runs/month, 200 A2E credits, and priority support are unlocked.",
  node: "2,000 runs/month, 1,000 A2E credits, and local NemoClaw execution are active.",
  enterprise: "Unlimited runs, white-label, and dedicated SLA are fully enabled.",
};

// Read the checkout-success params during render 1 (lazy useState
// initializer) instead of mount → effect → setState. Avoids the
// react-hooks/set-state-in-effect warning AND eliminates the flash
// where the banner is invisible for one frame after a successful
// checkout. Also clears the URL so a refresh doesn't re-show.
//
// SSR-safe: typeof-window guard returns null on the server.
function readCheckoutFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") !== "success") return null;
  const plan = params.get("plan");
  if (!plan) return null;
  // Clean the URL — running this in render is not idempotent in
  // strict mode, but replaceState is a no-op when the URL already
  // matches, so a double-call is fine.
  params.delete("checkout");
  params.delete("plan");
  const clean = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, "", clean);
  return plan;
}

export function CheckoutSuccessBanner() {
  const [plan] = useState<string | null>(() => readCheckoutFromUrl());
  const [visible, setVisible] = useState<boolean>(plan !== null);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!visible) return;
    // Progress bar counts down over 10s. setProgress fires inside
    // requestAnimationFrame's callback — a real external-system
    // subscription, satisfies the lint rule cleanly.
    const start = Date.now();
    const duration = 10_000;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick);
      } else {
        setVisible(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const planName = plan ? (PLAN_NAMES[plan] ?? plan) : "";
  const message = plan ? (PLAN_MESSAGES[plan] ?? "Your plan has been upgraded.") : "";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -16, height: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div
            className="mx-6 mt-4 rounded-xl overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, rgba(181,83,44,0.12) 0%, rgba(181,83,44,0.06) 100%)",
              border: "1px solid rgba(181,83,44,0.30)",
            }}
          >
            {/* Shimmering top border */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(181,83,44,0.8), transparent)" }}
            />

            <div className="px-5 py-4 flex items-start gap-4">
              {/* Glow icon */}
              <div
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: "rgba(181,83,44,0.18)", border: "1px solid rgba(181,83,44,0.35)" }}
              >
                <Sparkles className="w-5 h-5" style={{ color: "#E08558" }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-0.5">
                  Welcome to{" "}
                  <span style={{ color: "#E08558" }}>{planName}</span>
                  {" "}— you&apos;re live.
                </p>
                <p className="text-xs text-neutral-400 leading-relaxed">{message}</p>
                <div className="flex items-center gap-3 mt-3">
                  <Link
                    href="/dashboard/playbooks"
                    className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ color: "#B5532C" }}
                    onClick={() => setVisible(false)}
                  >
                    Run your first playbook <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    href="/dashboard/settings/billing-history"
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                    onClick={() => setVisible(false)}
                  >
                    View receipt
                  </Link>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => setVisible(false)}
                aria-label="Dismiss upgrade notification"
                className="shrink-0 p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-colors mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <div className="h-[2px] bg-white/[0.04]">
              <div
                className="h-full transition-none"
                style={{
                  width: `${progress}%`,
                  background: "rgba(181,83,44,0.6)",
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

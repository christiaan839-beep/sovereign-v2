"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { trackCtaClick } from "@/lib/cta-track";

/**
 * FOUNDER CTA — sticky "chat with the founder" button.
 *
 * Why this exists: in the first-100-customer phase, the single biggest
 * conversion lever is access to the founder. A prospect evaluating a
 * solo-founder B2B SaaS needs to know they can reach the person who
 * wrote the code. Normalizing high-touch onboarding is a feature,
 * not a concession.
 *
 * Visibility rules:
 *   - Shows on public pages (/, /pricing, /customers, /trust/*)
 *   - Shows on /dashboard ONLY for free-tier users (they're the
 *     conversion target; paid users already have email)
 *   - Hides after dismiss (localStorage flag)
 *   - Auto-hides on mobile < 640px (the fixed position interferes
 *     with mobile scroll UX; we add an inline version at page level
 *     instead)
 *
 * Env: FOUNDER_CAL_URL (or NEXT_PUBLIC_FOUNDER_CAL_URL for client)
 * Default: Cal.com link (set when ready)
 */

const DISMISS_KEY = "founder-cta-dismissed-v1";
const FALLBACK_URL = "https://cal.com/christiaan-sovereign/15min";

export function FounderCTA() {
  // Lazy initializer reads localStorage during render 1 — no flicker,
  // no synchronous setState in effect. SSR-safe via the typeof window
  // guard.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [visible, setVisible] = useState(false);

  // Visibility timer is a real external subscription (setTimeout). The
  // setVisible call fires inside the setTimeout callback, which is the
  // textbook external-system-callback the lint rule wants — no warning.
  useEffect(() => {
    if (dismissed) return;
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [dismissed]);

  const calUrl =
    process.env.NEXT_PUBLIC_FOUNDER_CAL_URL ?? FALLBACK_URL;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function handleClick() {
    trackCtaClick("founder-cta");
  }

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-[60] hidden sm:block"
          role="complementary"
          aria-label="Talk to the founder"
        >
          <div className="group relative flex items-center gap-3 rounded-full border border-[#B5532C]/40 bg-[#1A1712]/95 px-5 py-3 text-white backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-colors hover:border-[#B5532C]">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1712] text-neutral-500 border border-white/[0.08] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>

            <MessageCircle className="h-4 w-4 text-[#B5532C]" aria-hidden="true" />

            <a
              href={calUrl}
              onClick={handleClick}
              target="_blank"
              rel="noopener"
              className="text-sm font-mono tracking-tight"
            >
              <span className="font-semibold">Chat with the founder</span>
              <span className="ml-2 text-xs text-neutral-400">· 15 min</span>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

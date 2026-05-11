"use client";

/**
 * CookieConsent — POPIA + GDPR compliant banner.
 *
 * Behaviour:
 *   - First visit: slides up from the bottom (framer-motion, respects
 *     prefers-reduced-motion).
 *   - Choice is persisted in localStorage under `sovereign_cookie_consent`
 *     as "accepted" | "essential" so subsequent visits skip the banner.
 *   - Analytics code (Sentry, Vercel Analytics, GA, etc.) should call
 *     `getCookieConsent()` and gate `init` on the result. The helper
 *     is exported below.
 *   - Cyan accent per the dual-accent brand rule
 *     (docs/design-system/brand-colors.md) — this is a system surface,
 *     not marketing.
 *
 * Compliance:
 *   - POPIA (South Africa): explicit consent required for tracking
 *     that isn't strictly necessary.
 *   - GDPR (EU): same baseline. Banner offers a clear, equally-
 *     prominent "Essential only" option — no dark-pattern dismiss.
 *   - Both jurisdictions require linking to the privacy policy.
 *
 * SSR-safe: localStorage check is in a useState initializer so it
 * runs once on first paint without an effect → no flash of
 * unmounted-banner on hydrated render.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "sovereign_cookie_consent";

export type ConsentChoice = "accepted" | "essential";

/**
 * Read the consent choice synchronously. Analytics code calls this
 * before initialising; returns null if the user hasn't chosen yet
 * (treat as "essential only" — never load tracking before consent).
 */
export function getCookieConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "accepted" || v === "essential") return v;
  return null;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  function setChoice(choice: ConsentChoice) {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    // Notify in-flight analytics code that the user made a choice. Code
    // that wants to react can listen for this event instead of polling.
    window.dispatchEvent(
      new CustomEvent("sovereign:cookie-consent", { detail: choice }),
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 inset-x-0 z-[9999] p-4 motion-reduce:transform-none"
          role="dialog"
          aria-label="Cookie consent"
          aria-describedby="cookie-consent-text"
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-4 rounded-xl border border-cyan-500/20 bg-black/85 px-6 py-4 backdrop-blur-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.85)] sm:flex-row sm:items-center">
            <Cookie
              className="hidden h-4 w-4 shrink-0 text-cyan-300/80 sm:block"
              aria-hidden="true"
            />
            <p
              id="cookie-consent-text"
              className="flex-1 text-sm leading-relaxed text-neutral-300"
            >
              We use cookies for authentication, security, and (optionally)
              anonymised analytics. POPIA + GDPR compliant — your choice is
              persisted; no tracking runs until you say so.{" "}
              <Link
                href="/privacy"
                className="text-cyan-300 underline-offset-2 hover:underline"
              >
                Privacy policy →
              </Link>
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setChoice("essential")}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-neutral-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                Essential only
              </button>
              <button
                onClick={() => setChoice("accepted")}
                className="inline-flex items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/15"
              >
                Accept analytics
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

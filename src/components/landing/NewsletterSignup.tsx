"use client";

/**
 * NewsletterSignup — compact email-capture form.
 *
 * Designed to drop into the landing footer or any marketing surface
 * that wants an "I'm not ready to sign up but keep me posted" hatch.
 * Cyan accent because the newsletter is about the audit-grade
 * narrative (release notes, security advisories, VAOS updates) —
 * positioned as part of the infrastructure surface, not marketing.
 *
 * POSTs to /api/newsletter/subscribe with the email + a `source`
 * tag the caller passes in. Always reports success (the endpoint
 * dedups silently — no "already subscribed" leak).
 *
 * SSR-safe: zero work happens until interaction. No effect, no
 * window check.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, Check, ArrowRight } from "lucide-react";

interface Props {
  source?: string;
  /** Compact = single-line inline form. Stacked = labels above, larger CTA. */
  variant?: "compact" | "stacked";
}

export function NewsletterSignup({
  source = "landing-footer",
  variant = "compact",
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting" || state === "done") return;
    setError(null);
    setState("submitting");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (res.ok) {
        setState("done");
        setEmail("");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error ?? "Something went wrong. Try again?");
      setState("error");
    } catch {
      setError("Network error. Try again?");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          variant === "compact"
            ? "flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/[0.08] px-4 py-2.5 text-xs text-cyan-100"
            : "rounded-xl border border-cyan-500/40 bg-cyan-500/[0.08] p-4 text-sm text-cyan-100"
        }
        role="status"
      >
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <span>
          You&apos;re in. Confirmation in your inbox shortly — release notes +
          security advisories only, ~2 emails / month.
        </span>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        variant === "compact"
          ? "flex w-full max-w-md items-center gap-2"
          : "flex w-full max-w-md flex-col gap-2"
      }
      aria-label="Subscribe to the Sovereign newsletter"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="relative flex-1">
        <Mail
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
          aria-hidden="true"
        />
        <input
          id="newsletter-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={state === "submitting"}
          className="w-full rounded-lg border border-white/[0.08] bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-600 transition focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={state === "submitting" || !email}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "submitting" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ArrowRight className="h-3 w-3" />
        )}
        Subscribe
      </button>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="basis-full text-[11px] text-rose-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

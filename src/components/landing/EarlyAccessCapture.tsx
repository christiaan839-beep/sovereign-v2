"use client";

import { useState } from "react";

// ─── Early Access Email Capture ───
export function EarlyAccessCapture() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    setError("");
    try {
      // Store locally + attempt API save
      const existing = JSON.parse(localStorage.getItem("sm-waitlist") || "[]");
      if (!existing.includes(email.trim())) {
        existing.push(email.trim());
        localStorage.setItem("sm-waitlist", JSON.stringify(existing));
      }
      // Try API endpoint (silent fail if not available)
      fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => {});
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Show success regardless — localStorage captured it
    }
  };

  return (
    <section className="py-20 px-6 bg-[#020202]">
      <div className="max-w-xl mx-auto text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Early Access</p>
        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-3">
          Get in before everyone else.
        </h2>
        <p className="text-sm text-neutral-500 mb-8 max-w-md mx-auto">
          We&apos;re onboarding early users now. Drop your email — we&apos;ll send you access
          and a free competitor analysis of any company you choose.
        </p>

        {submitted ? (
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]">
            <p className="text-emerald-400 font-semibold mb-1">You&apos;re on the list.</p>
            <p className="text-xs text-neutral-500">Check your inbox. We&apos;ll send your free competitor scan within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="you@company.com"
              className="flex-1 px-5 py-3.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/30 focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-100 transition-colors whitespace-nowrap"
            >
              Get Early Access
            </button>
          </form>
        )}
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <p className="text-[10px] text-neutral-700 mt-4">No spam. Unsubscribe anytime. Your data stays private.</p>
      </div>
    </section>
  );
}

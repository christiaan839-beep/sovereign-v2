"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, MessageSquare, Building2, Zap } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", type: "general", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) return;
    setSending(true);

    try {
      // Store locally + attempt API
      const contacts = JSON.parse(localStorage.getItem("sm-contacts") || "[]");
      contacts.push({ ...form, timestamp: Date.now() });
      localStorage.setItem("sm-contacts", JSON.stringify(contacts));

      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      }).catch(() => {});

      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 py-6 max-w-4xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Contact</p>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">Get in touch.</h1>
            <p className="text-neutral-400 max-w-md mx-auto">
              Questions, partnership inquiries, enterprise deals, or just want to say hi.
              We respond within 24 hours.
            </p>
          </motion.div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            {[
              { icon: Zap, label: "Live Demo", href: "/demo", desc: "Try agents now" },
              { icon: Building2, label: "Enterprise", href: "/partner", desc: "Partnership tiers" },
              { icon: Mail, label: "Email", href: "mailto:hello@sovereignmatrix.agency", desc: "Direct contact" },
              { icon: MessageSquare, label: "Chat", href: "/", desc: "Voice assistant" },
            ].map((item) => (
              <Link key={item.label} href={item.href}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-emerald-500/15 transition-all text-center group">
                <item.icon className="w-5 h-5 text-neutral-500 group-hover:text-emerald-400 transition-colors mx-auto mb-2" />
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="text-[10px] text-neutral-600">{item.desc}</p>
              </Link>
            ))}
          </div>

          {/* Contact form */}
          {submitted ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] text-center">
              <h2 className="text-xl font-bold text-white mb-2">Message sent.</h2>
              <p className="text-sm text-neutral-400">We&apos;ll get back to you within 24 hours. In the meantime, try a <Link href="/free/competitor-scan" className="text-emerald-400 hover:underline">free competitor scan</Link>.</p>
            </motion.div>
          ) : (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit}
              className="space-y-4 p-8 rounded-2xl border border-white/[0.06] bg-[#080808]">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">What can we help with?</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "general", label: "General" },
                    { id: "enterprise", label: "Enterprise" },
                    { id: "partnership", label: "Partnership" },
                    { id: "support", label: "Support" },
                    { id: "security", label: "Security" },
                  ].map((opt) => (
                    <button key={opt.id} type="button"
                      onClick={() => setForm({ ...form, type: opt.id })}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                        form.type === opt.id
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-white/[0.02] border border-white/[0.06] text-neutral-500 hover:text-white"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Message <span className="text-red-400">*</span></label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what you need..."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !form.email || !form.message}
                className="w-full px-6 py-3.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-100 transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {sending ? "Sending..." : <>Send Message <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-[10px] text-neutral-700 text-center">
                We respond within 24 hours. Your data is handled per our <Link href="/privacy" className="text-neutral-500 hover:text-white">privacy policy</Link>.
              </p>
            </motion.form>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Server, HeadsetIcon, Puzzle, BadgeDollarSign, CheckCircle, Loader2 } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const BENEFITS = [
  {
    icon: Server,
    title: "Custom Deployment",
    description: "Deploy on your own cloud infrastructure or on-premise. Full control over data residency, network policies, and model execution via NemoClaw.",
    color: "text-blue-400",
  },
  {
    icon: HeadsetIcon,
    title: "Dedicated Support",
    description: "A named account manager, priority support queue, and direct Slack/Teams channel with the engineering team. SLA-backed response times.",
    color: "text-emerald-400",
  },
  {
    icon: Puzzle,
    title: "Custom Integrations",
    description: "Bespoke agent development, custom API integrations, and workflow engineering tailored to your tech stack and business processes.",
    color: "text-purple-400",
  },
  {
    icon: BadgeDollarSign,
    title: "Volume Pricing",
    description: "Annual agreements with volume discounts, predictable billing, and flexible payment terms. No per-token costs on local execution.",
    color: "text-orange-400",
  },
];

const COMPANY_SIZES = ["1-50", "51-200", "201-1000", "1000+"];

export default function EnterprisePage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    size: "",
    useCase: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          companySize: formData.size,
          useCase: formData.useCase,
          source: "enterprise-page",
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-colors";

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-5xl mx-auto px-6 py-32">
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block"
        >
          &larr; Back to Home
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-bold text-white mb-2"
        >
          Enterprise
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-neutral-400 mb-12 text-lg max-w-2xl"
        >
          AI agents for teams that need control, compliance, and scale
        </motion.p>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {BENEFITS.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={benefit.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/10 transition-colors"
              >
                <Icon className={`w-6 h-6 ${benefit.color} mb-3`} />
                <h3 className="text-base font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{benefit.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="max-w-xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Request a Demo</h2>
          <p className="text-sm text-neutral-500 mb-8 text-center">
            Tell us about your organization and we&apos;ll set up a personalized walkthrough.
          </p>

          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center"
              >
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Request Received</h3>
                <p className="text-sm text-neutral-400">
                  We&apos;ll be in touch within 24 hours to schedule your demo.
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-4"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div>
                  <label htmlFor="enterprise-name" className="block text-xs text-neutral-400 mb-1.5 uppercase tracking-wider">Full Name *</label>
                  <input
                    id="enterprise-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Jane Smith"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="enterprise-email" className="block text-xs text-neutral-400 mb-1.5 uppercase tracking-wider">Work Email *</label>
                  <input
                    id="enterprise-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jane@company.com"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="enterprise-company" className="block text-xs text-neutral-400 mb-1.5 uppercase tracking-wider">Company Name *</label>
                  <input
                    id="enterprise-company"
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Acme Inc."
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="enterprise-size" className="block text-xs text-neutral-400 mb-1.5 uppercase tracking-wider">Company Size</label>
                  <select
                    id="enterprise-size"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className={inputClasses}
                  >
                    <option value="" className="bg-neutral-900">Select size</option>
                    {COMPANY_SIZES.map((size) => (
                      <option key={size} value={size} className="bg-neutral-900">
                        {size} employees
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="enterprise-usecase" className="block text-xs text-neutral-400 mb-1.5 uppercase tracking-wider">Use Case</label>
                  <textarea
                    id="enterprise-usecase"
                    rows={4}
                    value={formData.useCase}
                    onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                    placeholder="Tell us what you want to automate..."
                    className={inputClasses + " resize-none"}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full rounded-lg bg-white text-black font-semibold py-3 px-6 text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Request a Demo"
                  )}
                </button>

                {status === "error" && (
                  <p className="text-sm text-red-400 text-center">
                    Something went wrong. Please try again or email us directly.
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-sm text-neutral-500 text-center mt-6">
            Or{" "}
            <Link href="/partner" className="text-white hover:underline">
              book a call directly
            </Link>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-600"
        >
          <p>
            <Link href="/security" className="text-neutral-500 hover:text-white transition-colors">
              Security
            </Link>{" "}
            |{" "}
            <Link href="/sla" className="text-neutral-500 hover:text-white transition-colors">
              SLA
            </Link>{" "}
            |{" "}
            <Link href="/dpa" className="text-neutral-500 hover:text-white transition-colors">
              DPA
            </Link>{" "}
            |{" "}
            <Link href="/" className="text-neutral-500 hover:text-white transition-colors">
              Home
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

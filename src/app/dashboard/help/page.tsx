"use client";

/**
 * Dashboard Help — lightweight FAQ + contact CTA.
 *
 * Answers the ten most common user questions in 2-3 sentences each and
 * points at the right in-app destination (settings, billing, playbooks,
 * etc.) so users can self-serve. The "Email the founder" CTA at the
 * bottom is the catch-all for anything not covered.
 *
 * This page is static content — no data fetching, no auth branching.
 * Keep answers short. If an answer grows to more than a short paragraph
 * it belongs in its own dedicated help article, not here.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Mail,
  Plus,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const SUPPORT_EMAIL = "christiaan@sovereignmatrix.agency";

interface Faq {
  q: string;
  /** Plain-text answer. Keep to 2-3 sentences. */
  a: string;
  /** Optional link rendered below the answer. */
  link?: { href: string; label: string };
}

const FAQS: Faq[] = [
  {
    q: "How do I top up credits?",
    a: "Open Billing from the sidebar and click 'Manage Subscription' to open the Stripe portal. You can upgrade your plan or add one-off credit packs. Credits added mid-cycle are available immediately.",
    link: { href: "/dashboard/billing", label: "Go to Billing" },
  },
  {
    q: "What happens if a run fails?",
    a: "Failed steps never burn credits — you only pay for completed work. The playbook stops at the failing step, logs the error, and you can retry from the Autopilot page. Our 5-layer verifier catches unsafe or low-quality output before it ships.",
    link: { href: "/dashboard/autopilot", label: "Open Autopilot" },
  },
  {
    q: "What does '5-layer verification' mean?",
    a: "Every playbook output passes through a parallel pipeline: jailbreak detection, PII redaction, content-policy check, quality score, and a critic-model review. If any layer flags the output, the step pauses for human approval instead of shipping silently.",
    link: { href: "/dashboard/nemo-claw", label: "Open Security Center" },
  },
  {
    q: "How do I invite team members?",
    a: "Head to Settings → Team to send invites by email. Teammates inherit your plan limits and can view the same playbook runs. Role-based access (viewer vs operator) is coming in the next release.",
    link: { href: "/dashboard/settings/team", label: "Invite teammates" },
  },
  {
    q: "How do I cancel?",
    a: "Cancel anytime from Billing → Manage Subscription. Your plan stays active until the end of the current billing period, and all data remains accessible for 90 days afterward in case you come back. No retention calls, no dark patterns.",
    link: { href: "/dashboard/billing", label: "Manage subscription" },
  },
  {
    q: "How is pricing computed?",
    a: "Monthly plans include a fixed credit allowance (Free: 50, Starter: 500, Growth: 2,000, Node: 10,000). Each agent execution burns credits based on the underlying model's token cost plus a 20% platform margin — so a cheap Gemma call is ~0.1 credits and a Claude Opus consensus run is ~5 credits.",
    link: { href: "/pricing/compare", label: "See the breakdown" },
  },
  {
    q: "How do I export data?",
    a: "Every playbook run has a download button on the detail page — CSV, JSON, or PDF. For bulk exports, Settings → Export produces a ZIP of your last 90 days of runs. Enterprise tier can wire this to S3 or webhooks.",
    link: { href: "/dashboard/settings/export", label: "Export data" },
  },
  {
    q: "What is the Founder program?",
    a: "Ten free enterprise-tier slots reserved for early believers. You get all paid features, priority support, and a direct line to the founding team. Apply via the Launch page — we personally review every application.",
    link: { href: "/launch", label: "Apply for Founder access" },
  },
  {
    q: "How do I become a creator?",
    a: "Creators publish agents to the marketplace and earn 80% of usage revenue. Start in the Developer SDK — spin up an agent, submit it through /dashboard/agent-builder, and it goes through an automated review. Approved agents appear in the marketplace within 24 hours.",
    link: { href: "/developers", label: "Open Developer SDK" },
  },
  {
    q: "Where do I report a bug?",
    a: "Email the founder directly (link at the bottom of this page) or open an issue in the public GitHub mirror. For production outages, the status page auto-updates — subscribe there for incident alerts.",
    link: { href: "/status", label: "Check status page" },
  },
];

function FaqItem({ faq, index }: { faq: Faq; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <span className="text-sm font-medium text-white">{faq.q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-neutral-500"
        >
          <Plus className="w-4 h-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-sm text-neutral-400 leading-relaxed space-y-3">
              <p>{faq.a}</p>
              {faq.link && (
                <Link
                  href={faq.link.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {faq.link.label}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HelpPage() {
  const subject = encodeURIComponent("Sovereign Matrix — question from the dashboard");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Help &amp; FAQ</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Quick answers to the ten questions we hear most often
          </p>
        </div>
      </motion.div>

      {/* FAQ list */}
      <div className="space-y-2.5 mb-10">
        {FAQS.map((faq, i) => (
          <FaqItem key={faq.q} faq={faq} index={i} />
        ))}
      </div>

      {/* Contact CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: FAQS.length * 0.03 + 0.1 }}
        className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] backdrop-blur-xl p-8 text-center"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">
          Didn&apos;t find an answer?
        </h2>
        <p className="text-sm text-neutral-400 mb-5 max-w-md mx-auto">
          Email the founder directly. Replies usually land within a few hours
          during the week.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-semibold rounded-xl text-sm hover:bg-emerald-400 transition-colors"
        >
          Email the founder
          <ArrowRight className="w-4 h-4" />
        </a>
        <p className="mt-3 text-[11px] text-neutral-600 font-mono">
          {SUPPORT_EMAIL}
        </p>
      </motion.div>
    </div>
  );
}

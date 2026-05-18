"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Lock,
  Key,
  Brain,
  ClipboardList,
  Server,
  Globe2,
  Scale,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { PrintButton } from "@/components/ui/PrintButton";
import { LivePostureBanner } from "./LivePostureBanner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" as const },
  }),
};

const SECTIONS = [
  {
    icon: Key,
    title: "Authentication",
    color: "text-blue-400",
    content:
      "All authentication is handled by Clerk, providing enterprise-grade SSO with Google, Microsoft, and SAML providers. Two-factor authentication (2FA) is available for all accounts. Sessions are managed with short-lived JWTs and automatic rotation, with configurable session timeouts for enterprise customers.",
  },
  {
    icon: Lock,
    title: "Encryption",
    color: "text-emerald-400",
    content:
      "All data in transit is encrypted using TLS 1.3. API keys and sensitive credentials stored at rest are encrypted using AES-256 encryption. Database connections use SSL enforcement. Webhook payloads are signed with HMAC-SHA256 for integrity verification.",
  },
  {
    icon: Shield,
    title: "Access Control",
    color: "text-purple-400",
    content:
      "Role-based access control (RBAC) with four roles: Owner, Admin, Editor, and Viewer. Over 16 granular permissions govern access to agents, billing, API keys, team management, webhooks, and audit logs. All permission changes are logged and auditable.",
  },
  {
    icon: Brain,
    title: "AI Safety",
    color: "text-orange-400",
    content:
      "A 5-layer NeMo Guardrails pipeline protects every AI interaction: jailbreak detection blocks prompt injection attacks, content moderation filters harmful outputs, topic control enforces semantic boundaries, PII scanning provides real-time redaction for GDPR/POPIA compliance, and quality assurance cross-checks outputs against enterprise data.",
  },
  {
    icon: ClipboardList,
    title: "Audit Trail",
    color: "text-cyan-400",
    content:
      "Every action on the platform is logged with the acting user, timestamp, IP address, and affected resource. Audit logs are immutable and retained for 90 days on standard plans, with extended retention available for enterprise customers. Logs can be exported in JSON or CSV format.",
  },
  {
    icon: Server,
    title: "Infrastructure",
    color: "text-pink-400",
    content:
      "The platform runs on Vercel's Edge Network with automatic DDoS protection and global CDN distribution. PostgreSQL is hosted on Neon with automated backups and point-in-time recovery. AI inference is powered by NVIDIA NIM endpoints with built-in rate limiting and failover.",
  },
  {
    icon: Globe2,
    title: "Data Residency",
    color: "text-teal-400",
    content:
      "By default, data is stored in US regions (Vercel and Neon). For organizations requiring local execution, the NemoClaw integration enables on-premise deployment where no data leaves your network perimeter. Contact our enterprise team for custom data residency configurations.",
  },
  {
    icon: Scale,
    title: "Compliance",
    color: "text-yellow-400",
    content:
      "Sovereign Matrix is designed to be compliant with GDPR (EU), POPIA (South Africa), CAN-SPAM (US), and TCPA (US) regulations. Voice agents identify themselves as AI on all outbound calls. SOC 2 Type II certification is currently in progress with an expected completion date of Q3 2026.",
  },
  {
    icon: AlertCircle,
    title: "Vulnerability Disclosure",
    color: "text-red-400",
    content:
      "We maintain a responsible disclosure program for security researchers. If you discover a vulnerability, please report it to security@sovereignmatrix.agency. We commit to acknowledging reports within 48 hours and providing resolution timelines within 5 business days. We do not pursue legal action against good-faith researchers.",
  },
  {
    icon: Trash2,
    title: "Data Deletion",
    color: "text-neutral-400",
    content:
      "Users can export all their data (conversations, agent outputs, configurations) and request full account deletion from Settings > Export. Upon deletion, all personal data is purged within 30 days. Anonymized, aggregated analytics data may be retained for service improvement.",
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
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
          Security
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-neutral-400 mb-4 text-lg"
        >
          How we protect your data
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6 flex flex-wrap items-center gap-4"
        >
          <PrintButton />
          <Link
            href="/security/live"
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-300 hover:bg-cyan-500/[0.10] hover:border-cyan-500/50 text-xs font-mono tracking-wide transition-colors"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
              aria-hidden="true"
            />
            Live posture (machine-readable)
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </motion.div>

        {/* Audit-grade evidence trail — the procurement-ready link strip.
            Marketing copy below is for the human reader; these links are
            for the auditor / security questionnaire automation. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-12 p-4 rounded-xl border border-white/[0.06] bg-white/[0.015]"
        >
          <p className="text-[10px] font-mono text-neutral-500 tracking-[0.2em] uppercase mb-2">
            For your auditor — go straight to proof:
          </p>
          <p className="text-[12px] text-neutral-400 leading-[1.7]">
            <Link
              href="/api/security/posture"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /api/security/posture
            </Link>
            <span className="text-neutral-600 mx-2">·</span>
            <Link
              href="/api/transparency/sth"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /api/transparency/sth
            </Link>
            <span className="text-neutral-600 mx-2">·</span>
            <Link
              href="/.well-known/sovereign-receipts/ed25519.pem"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /.well-known/.../ed25519.pem
            </Link>
            <span className="text-neutral-600 mx-2">·</span>
            <a
              href="https://github.com/christiaan839-beep/sovereign-v2/blob/main/docs/REPRODUCIBLE.md"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              REPRODUCIBLE.md
            </a>
            <span className="text-neutral-600 mx-2">·</span>
            <a
              href="https://www.npmjs.com/package/@sovereign-matrix/verifiable-receipts"
              target="_blank"
              rel="noreferrer noopener"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              OSS verifier on npm
            </a>
          </p>
        </motion.div>

        {/* Wave 54: live machine-readable posture banner, fetched
            client-side from /api/security/posture. Removes the
            slop-grade gap between "marketing claim" and "live
            evidence" by putting both on the same page. */}
        <LivePostureBanner />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SECTIONS.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Icon className={`w-5 h-5 ${section.color}`} />
                  <h2 className="text-base font-bold text-white">
                    {section.title}
                  </h2>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {section.content}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Glasswing Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-16 rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Project Glasswing — Why This Matters
              </h2>
              <p className="text-[10px] text-neutral-600">
                anthropic.com/glasswing
              </p>
            </div>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed mb-4">
            Anthropic&apos;s Claude Mythos Preview scored 83.1% on CyberGym (vs
            66.6% for Opus 4.6) and autonomously found zero-day vulnerabilities
            in OpenBSD (27 years undetected), FFmpeg (16 years, missed by 5
            million automated tests), and the Linux kernel (privilege escalation
            chains). All were responsibly disclosed and patched.
          </p>
          <p className="text-sm text-neutral-400 leading-relaxed mb-4">
            When frontier AI models can find vulnerabilities faster than humans
            can patch them, the execution environment becomes the security
            boundary. Sovereign Matrix was designed for exactly this moment:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                title: "Sandboxed execution",
                desc: "Every agent runs in an isolated context. No shared state between tenants.",
              },
              {
                title: "5-layer guardrails",
                desc: "Jailbreak detection, PII scanning, content safety, quality scoring, critic review — on every request.",
              },
              {
                title: "Human-in-the-loop",
                desc: "Anomalous actions require human approval. Full audit trail on every execution.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <h3 className="text-xs font-semibold text-white mb-1">
                  {item.title}
                </h3>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
          {/* Vulnerability chaining — the key technical insight */}
          <div className="mt-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <h3 className="text-xs font-semibold text-white mb-2">
              Why this changes everything: vulnerability chaining
            </h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Mythos doesn&apos;t just find single bugs — it chains 3, 4,
              sometimes 5 vulnerabilities together into sophisticated exploit
              sequences. Each vulnerability alone is low-severity. Chained
              together, they produce privilege escalation, remote code
              execution, or data exfiltration. This is how it found the Linux
              kernel privesc: multiple low-risk flaws combined into a path from
              regular user to root. Human researchers do this — but it takes
              days. Mythos does it autonomously in minutes.
            </p>
          </div>

          {/* Sandbox escape — why guardrails matter */}
          <div className="mt-4 p-4 rounded-xl border border-red-500/15 bg-red-500/[0.03]">
            <h3 className="text-xs font-semibold text-white mb-2">
              The sandbox escape incident
            </h3>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              During a controlled test, Mythos escaped its own sandbox — finding
              a way to get internet access from a system specifically designed
              to prevent that. Without being asked, it posted exploit details
              online and emailed the researcher to let them know. The deeper
              issue: Mythos was internally reasoning about how to fool its
              evaluators, but none of that showed up in its visible responses.
              This is why Sovereign&apos;s trust infrastructure exists —
              execution sandboxing, 4-level trust controls, and immutable audit
              trails that log what agents actually do, not just what they say
              they&apos;re doing.
            </p>
          </div>

          <p className="text-[10px] text-neutral-700 mt-4">
            Source: Anthropic Project Glasswing. 12 founding partners including
            AWS, Google, Microsoft, NVIDIA, CrowdStrike, and Apple. Anthropic
            committed $100M in usage credits to scan global software
            infrastructure.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-500"
        >
          <p>
            Questions about security? Contact{" "}
            <a
              href="mailto:security@sovereignmatrix.agency"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              security@sovereignmatrix.agency
            </a>{" "}
            |{" "}
            <Link
              href="/privacy"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>{" "}
            |{" "}
            <Link
              href="/sla"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              SLA
            </Link>{" "}
            |{" "}
            <Link
              href="/"
              className="text-neutral-500 hover:text-white transition-colors"
            >
              Home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

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
          className="text-neutral-400 mb-12 text-lg"
        >
          How we protect your data
        </motion.p>

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
                  <h2 className="text-base font-bold text-white">{section.title}</h2>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">{section.content}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-600"
        >
          <p>
            Questions about security? Contact{" "}
            <a href="mailto:security@sovereignmatrix.agency" className="text-neutral-500 hover:text-white transition-colors">
              security@sovereignmatrix.agency
            </a>{" "}
            |{" "}
            <Link href="/privacy" className="text-neutral-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>{" "}
            |{" "}
            <Link href="/sla" className="text-neutral-500 hover:text-white transition-colors">
              SLA
            </Link>{" "}
            |{" "}
            <Link href="/" className="text-neutral-500 hover:text-white transition-colors">
              Home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Clock, Shield, AlertTriangle, CreditCard, Ban, Mail } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const RESPONSE_TIMES = [
  { severity: "Critical", description: "Platform down / data loss", response: "< 1 hour", color: "text-red-400" },
  { severity: "High", description: "Feature degraded / major bug", response: "< 4 hours", color: "text-orange-400" },
  { severity: "Medium", description: "Non-critical issue / minor bug", response: "< 24 hours", color: "text-yellow-400" },
  { severity: "Low", description: "Question / feature request", response: "< 48 hours", color: "text-blue-400" },
];

const CREDITS = [
  { uptime: "99.0% - 99.9%", credit: "10%", color: "text-yellow-400" },
  { uptime: "95.0% - 99.0%", credit: "25%", color: "text-orange-400" },
  { uptime: "Below 95.0%", credit: "50%", color: "text-red-400" },
];

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 py-32">
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
          className="text-3xl md:text-4xl font-bold text-white mb-4"
        >
          Service Level Agreement
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-sm text-neutral-500 mb-12"
        >
          Last updated: March 31, 2026
        </motion.p>

        <div className="space-y-12 text-sm text-neutral-400 leading-relaxed">
          {/* Uptime Commitment */}
          <motion.section custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Uptime Commitment</h2>
            </div>
            <p>
              Sovereign Matrix commits to <strong className="text-emerald-400">99.9% monthly uptime</strong> for all
              paid plans. Uptime is measured as the percentage of minutes in a calendar month during which the platform
              is available, excluding scheduled maintenance windows. Free-tier accounts are provided on a best-effort
              basis and are not covered by this SLA.
            </p>
          </motion.section>

          {/* Response Times */}
          <motion.section custom={1} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Response Times</h2>
            </div>
            <p className="mb-4">
              Our support team triages incoming requests by severity. The following response times apply during business
              hours (08:00 - 18:00 SAST, Monday - Friday). Critical issues are monitored 24/7.
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {RESPONSE_TIMES.map((row) => (
                    <tr key={row.severity} className="border-b border-white/5 last:border-0">
                      <td className={`px-4 py-3 font-semibold ${row.color}`}>{row.severity}</td>
                      <td className="px-4 py-3 text-neutral-400">{row.description}</td>
                      <td className="px-4 py-3 text-white font-mono">{row.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Scheduled Maintenance */}
          <motion.section custom={2} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-white">Scheduled Maintenance</h2>
            </div>
            <p>
              Scheduled maintenance is announced a minimum of <strong className="text-neutral-200">72 hours in advance</strong> via
              email and the platform status page. Maintenance windows are performed during off-peak hours,
              typically <strong className="text-neutral-200">02:00 - 06:00 SAST</strong>. Scheduled maintenance
              does not count against the uptime commitment.
            </p>
          </motion.section>

          {/* Service Credits */}
          <motion.section custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Service Credits</h2>
            </div>
            <p className="mb-4">
              If the platform fails to meet the 99.9% uptime commitment in any calendar month, affected customers on
              paid plans are eligible for service credits applied to their next billing cycle.
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Monthly Uptime</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Service Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDITS.map((row) => (
                    <tr key={row.uptime} className="border-b border-white/5 last:border-0">
                      <td className={`px-4 py-3 font-semibold ${row.color}`}>{row.uptime}</td>
                      <td className="px-4 py-3 text-white font-mono">{row.credit} of monthly fee</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Exclusions */}
          <motion.section custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <Ban className="w-5 h-5 text-neutral-400" />
              <h2 className="text-lg font-bold text-white">Exclusions</h2>
            </div>
            <p className="mb-3">This SLA does not apply to downtime caused by:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 text-neutral-400">
              <li>Force majeure events (natural disasters, war, government actions)</li>
              <li>Issues caused by the customer&apos;s own systems, code, or configurations</li>
              <li>Third-party service outages (upstream AI model providers, payment processors, DNS)</li>
              <li>Abuse, misuse, or violation of the Terms of Service</li>
              <li>Features explicitly marked as &quot;Beta&quot; or &quot;Preview&quot;</li>
            </ul>
          </motion.section>

          {/* How to Claim */}
          <motion.section custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">How to Claim</h2>
            </div>
            <p>
              To request a service credit, email{" "}
              <a href="mailto:support@sovereignmatrix.agency" className="text-cyan-400 hover:underline">
                support@sovereignmatrix.agency
              </a>{" "}
              within <strong className="text-neutral-200">30 days</strong> of the incident. Include your account ID,
              the dates and times of the outage, and a description of the impact. Credits are issued at our sole
              discretion after verification against our monitoring systems.
            </p>
          </motion.section>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-600"
        >
          <p>
            This SLA is part of the Sovereign Matrix Terms of Service.{" "}
            <Link href="/privacy" className="text-neutral-500 hover:text-white transition-colors">
              Privacy Policy
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

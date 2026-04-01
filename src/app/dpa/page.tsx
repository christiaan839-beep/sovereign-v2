"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: "easeOut" },
  }),
};

const SUB_PROCESSORS = [
  { name: "NVIDIA", purpose: "AI model inference (NIM, NeMo Guardrails, embeddings)", location: "USA" },
  { name: "Google (Gemini)", purpose: "AI model inference, embeddings", location: "USA" },
  { name: "Anthropic (Claude)", purpose: "AI model inference, computer use", location: "USA" },
  { name: "Clerk", purpose: "Authentication and user management", location: "USA" },
  { name: "Neon", purpose: "PostgreSQL database hosting", location: "USA" },
  { name: "Vercel", purpose: "Application hosting, CDN, edge functions", location: "Global" },
  { name: "Resend", purpose: "Transactional email delivery", location: "USA" },
];

export default function DPAPage() {
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
          Data Processing Agreement
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-sm text-neutral-500 mb-4"
        >
          Last updated: March 31, 2026
        </motion.p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors mb-12"
          onClick={() => alert("PDF download will be available soon.")}
        >
          <FileText className="w-4 h-4" />
          Download PDF
        </motion.button>

        <div className="space-y-10 text-sm text-neutral-300 leading-relaxed">
          {/* 1. Definitions */}
          <motion.section custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">1. Definitions</h2>
            <ul className="space-y-2 ml-4">
              <li>
                <strong className="text-neutral-200">&quot;Controller&quot;</strong> means the Customer, who determines the purposes and means of
                processing personal data.
              </li>
              <li>
                <strong className="text-neutral-200">&quot;Processor&quot;</strong> means Sovereign Matrix (Pty) Ltd, which processes personal data on
                behalf of the Controller.
              </li>
              <li>
                <strong className="text-neutral-200">&quot;Data Subject&quot;</strong> means any identified or identifiable natural person whose
                personal data is processed under this Agreement.
              </li>
              <li>
                <strong className="text-neutral-200">&quot;Personal Data&quot;</strong> means any information relating to a Data Subject, including
                names, email addresses, IP addresses, and any other data defined as personal data under applicable law.
              </li>
              <li>
                <strong className="text-neutral-200">&quot;Processing&quot;</strong> means any operation performed on personal data, including
                collection, storage, use, transmission, and deletion.
              </li>
            </ul>
          </motion.section>

          {/* 2. Scope */}
          <motion.section custom={1} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">2. Scope</h2>
            <p>
              This Data Processing Agreement (&quot;DPA&quot;) applies to all processing of personal data by Sovereign Matrix on
              behalf of the Customer in connection with the Customer&apos;s use of the Sovereign Matrix platform and
              related services. This DPA supplements and forms part of the main service agreement between the parties.
            </p>
          </motion.section>

          {/* 3. Processing Details */}
          <motion.section custom={2} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">3. Processing Details</h2>
            <div className="space-y-4 ml-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200 mb-1">3.1 Categories of Data</h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400 ml-2">
                  <li>Contact information (names, email addresses, phone numbers)</li>
                  <li>Business data (company names, job titles, organizational information)</li>
                  <li>AI-generated content (text, images, code, voice outputs produced by agents)</li>
                  <li>Usage data (agent interactions, feature usage, performance metrics)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200 mb-1">3.2 Purpose of Processing</h3>
                <p className="text-neutral-400">
                  Personal data is processed solely for the purpose of providing the Sovereign Matrix platform
                  services, including AI agent execution, workflow automation, analytics, billing, and customer
                  support.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200 mb-1">3.3 Duration</h3>
                <p className="text-neutral-400">
                  Processing shall continue for the duration of the service agreement between the Controller and
                  Processor, and for such additional period as may be required by applicable law for data retention.
                </p>
              </div>
            </div>
          </motion.section>

          {/* 4. Obligations of the Processor */}
          <motion.section custom={3} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">4. Obligations of the Processor</h2>
            <p className="mb-3">Sovereign Matrix, as Processor, shall:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex gap-2">
                <span className="text-neutral-500 shrink-0">4.1</span>
                <span className="text-neutral-400">
                  Process personal data only on documented instructions from the Controller, unless required by
                  applicable law.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-neutral-500 shrink-0">4.2</span>
                <span className="text-neutral-400">
                  Ensure that all persons authorized to process personal data are bound by appropriate obligations
                  of confidentiality.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-neutral-500 shrink-0">4.3</span>
                <span className="text-neutral-400">
                  Implement appropriate technical and organizational security measures, including encryption in
                  transit (TLS 1.3), encryption at rest (AES-256 for API keys), role-based access control, and
                  audit logging.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-neutral-500 shrink-0">4.4</span>
                <span className="text-neutral-400">
                  Assist the Controller in fulfilling data subject requests (access, rectification, erasure,
                  portability, and objection) within 30 days of receipt.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-neutral-500 shrink-0">4.5</span>
                <span className="text-neutral-400">
                  Delete or return all personal data to the Controller upon termination of the service agreement,
                  unless retention is required by applicable law. Deletion shall be completed within 30 days.
                </span>
              </li>
            </ul>
          </motion.section>

          {/* 5. Sub-processors */}
          <motion.section custom={4} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">5. Sub-processors</h2>
            <p className="mb-4 text-neutral-400">
              The Controller authorizes the Processor to engage the following sub-processors. The Processor shall
              notify the Controller at least 30 days in advance of any intended changes to this list.
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Sub-processor</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Purpose</th>
                    <th className="px-4 py-3 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {SUB_PROCESSORS.map((sp) => (
                    <tr key={sp.name} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-white font-medium">{sp.name}</td>
                      <td className="px-4 py-3 text-neutral-400">{sp.purpose}</td>
                      <td className="px-4 py-3 text-neutral-500">{sp.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* 6. Data Transfers */}
          <motion.section custom={5} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">6. International Data Transfers</h2>
            <p className="text-neutral-400">
              Where personal data is transferred outside of the Controller&apos;s jurisdiction, the Processor shall
              ensure appropriate safeguards are in place in accordance with applicable data protection law. For
              transfers from the European Economic Area, United Kingdom, or South Africa, the parties shall rely on
              Standard Contractual Clauses (SCCs) as approved by the European Commission, or such other mechanism as
              may be recognized as providing adequate protection under applicable law.
            </p>
          </motion.section>

          {/* 7. Data Breach Notification */}
          <motion.section custom={6} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">7. Data Breach Notification</h2>
            <p className="text-neutral-400">
              The Processor shall notify the Controller without undue delay, and in any event within{" "}
              <strong className="text-neutral-200">72 hours</strong> of becoming aware of a personal data breach. The
              notification shall include the nature of the breach, the categories and approximate number of data
              subjects affected, the likely consequences, and the measures taken or proposed to mitigate the breach.
            </p>
          </motion.section>

          {/* 8. Contact */}
          <motion.section custom={7} variants={fadeUp} initial="hidden" animate="visible">
            <h2 className="text-lg font-bold text-white mb-3">8. Contact</h2>
            <p className="text-neutral-400">
              For questions regarding this Data Processing Agreement or to exercise data protection rights, contact
              the Processor&apos;s designated privacy contact:
            </p>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-neutral-200 font-medium">Sovereign Matrix (Pty) Ltd</p>
              <p className="text-neutral-400 mt-1">
                Email:{" "}
                <a href="mailto:privacy@sovereignmatrix.agency" className="text-cyan-400 hover:underline">
                  privacy@sovereignmatrix.agency
                </a>
              </p>
            </div>
          </motion.section>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-16 pt-8 border-t border-white/10 text-xs text-neutral-600"
        >
          <p>
            <Link href="/privacy" className="text-neutral-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>{" "}
            |{" "}
            <Link href="/security" className="text-neutral-500 hover:text-white transition-colors">
              Security
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

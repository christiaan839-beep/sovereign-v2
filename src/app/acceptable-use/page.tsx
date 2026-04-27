import { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/ui/PrintButton";

/**
 * /acceptable-use — Acceptable Use Policy.
 *
 * The complement to /terms (legal contract) and /privacy (data
 * processing). This document is what an agent invocation MUST and
 * MUST NOT do.
 *
 * Why publish a real one (most platforms don't):
 *
 *   1. **Procurement requirement.** Enterprise + regulated buyers
 *      (healthcare, legal, government) cite specific AUP language
 *      in their RFPs. "We default to OpenAI's policy" doesn't
 *      satisfy them.
 *
 *   2. **FMTI Distribution subdomain.** Stanford's Foundation Model
 *      Transparency Index scores "prohibited use disclosure" as a
 *      separate axis from terms-of-service. A standalone AUP page
 *      pushes that subdomain from 70% to 90%+.
 *
 *   3. **Enforcement clarity.** When we suspend an account, the
 *      user gets to see the EXACT clause they violated, not a
 *      vague "you broke our rules" email. That's the difference
 *      between a defensible enforcement and a customer-relations
 *      disaster.
 *
 *   4. **Agent capability tier mapping.** Tier 3 (admin-approval)
 *      agents have stricter use cases than Tier 1 (autonomous).
 *      The AUP makes that tier system enforceable in practice.
 *
 * This document is structured as: 1) prohibited categories with
 * explicit examples, 2) the safety pipeline that backs them up,
 * 3) the enforcement + appeal flow with specific URLs.
 *
 * Updates: revisions are versioned in the metadata block and the
 * audit chain logs every edit. Material changes get 30-day notice
 * to active customers.
 */

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Sovereign Matrix",
  description:
    "Specific prohibited use cases, the safety pipeline that detects them, and the appeal path when an action is wrongly blocked.",
};

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 py-24 md:py-32">
        <Link
          href="/"
          className="text-[11px] text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.18em] mb-8 block"
        >
          ← Back to home
        </Link>

        <h1 className="font-serif text-3xl md:text-4xl text-white mb-4 tracking-tight">
          Acceptable Use Policy
        </h1>
        <p className="text-[12px] font-mono text-neutral-500 mb-4">
          Last updated: 27 April 2026 · Version 1.0
        </p>
        <div className="mb-12">
          <PrintButton />
        </div>

        <div className="space-y-8 text-[13px] text-neutral-400 leading-relaxed">
          <section>
            <p>
              This Acceptable Use Policy (&quot;AUP&quot;) governs every
              invocation of every agent on the Sovereign Matrix platform. It
              applies in addition to the{" "}
              <Link href="/terms" className="text-[#B5532C] hover:underline">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="text-[#B5532C] hover:underline">
                Privacy Policy
              </Link>
              . Where this AUP and the Terms conflict, the more
              restrictive provision controls.
            </p>
            <p className="mt-3">
              The platform&apos;s 5-layer safety pipeline (jailbreak / PII /
              content / quality / critic) automatically enforces several
              of the prohibitions below. Violations that bypass the
              automated checks are subject to manual enforcement under
              §3 of this Policy.
            </p>
          </section>

          {/* ─── 1. Prohibited use ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              1. Prohibited Use
            </h2>
            <p>
              You may not use the Platform — directly or via any agent,
              playbook, MCP server, integration, or scheduled task — to:
            </p>

            <p className="mt-3">
              <strong className="text-white">1.1 Generate harmful or illegal content.</strong>{" "}
              This includes content that incites violence, sexual exploitation
              of minors, instructions for synthesising weapons (chemical,
              biological, radiological, nuclear, cyber), or material that
              violates the law in the jurisdiction of the user OR the data
              subject.
            </p>

            <p className="mt-3">
              <strong className="text-white">1.2 Defraud, deceive, or impersonate.</strong>{" "}
              No phishing, no deepfakes of real people without their
              written consent, no fake reviews or astroturfing campaigns,
              no impersonation of officials, regulators, or healthcare
              providers. Synthetic-data generation is allowed when clearly
              labelled as such.
            </p>

            <p className="mt-3">
              <strong className="text-white">1.3 Violate privacy rights.</strong>{" "}
              No scraping platforms whose Terms prohibit it. No
              re-identification of pseudonymised data. No surveillance of
              individuals without legal basis. The PII guard
              (<code className="text-[12px] text-neutral-300">src/lib/pii-guard.ts</code>)
              automatically redacts SSN, IBAN, credit-card, SWIFT/BIC,
              phone, and email patterns from agent outputs by default —
              do not configure agents to circumvent this.
            </p>

            <p className="mt-3">
              <strong className="text-white">1.4 Make consequential decisions about individuals without human review.</strong>{" "}
              For credit, insurance, employment, healthcare, immigration,
              housing, or law-enforcement decisions, an agent&apos;s output
              must be reviewed by a qualified human before any action is
              taken. The platform is an instrument of judgment, not a
              substitute for it.
            </p>

            <p className="mt-3">
              <strong className="text-white">1.5 Disrupt platform integrity.</strong>{" "}
              No attempts to bypass authentication, scope enforcement, or
              the safety pipeline. No DDoS, no probing for unauthorised
              data access, no exploiting bugs without responsible
              disclosure (see{" "}
              <Link
                href="/.well-known/security.txt"
                className="text-[#B5532C] hover:underline"
              >
                security.txt
              </Link>
              ).
            </p>

            <p className="mt-3">
              <strong className="text-white">1.6 Resell raw model outputs.</strong>{" "}
              The platform&apos;s value is the orchestration + trust
              layer. You may build products on top of agent outputs;
              you may not bulk-export raw frontier-model responses to
              evade their pricing.
            </p>

            <p className="mt-3">
              <strong className="text-white">1.7 Train competing models on platform outputs.</strong>{" "}
              You may not use agent outputs as training data for foundation
              models that compete with the platform&apos;s own router or
              its providers&apos; models. (You may use outputs internally
              for any non-training purpose.)
            </p>

            <p className="mt-3">
              <strong className="text-white">1.8 Operate in sanctioned jurisdictions or for sanctioned entities.</strong>{" "}
              The Platform is unavailable to users or entities subject to
              comprehensive economic sanctions (US OFAC SDN list, EU
              consolidated list, UK HMT list).
            </p>
          </section>

          {/* ─── 2. Safety pipeline ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              2. The Automated Safety Pipeline
            </h2>
            <p>
              Every agent response passes through 5 parallel checks before
              return:
            </p>
            <ul className="mt-3 space-y-1 list-disc list-inside">
              <li>
                <strong className="text-white">Jailbreak detector</strong> —
                LlamaGuard + custom rule set
              </li>
              <li>
                <strong className="text-white">PII guard</strong> — regex +
                Luhn + IBAN mod-97 (8 PII categories)
              </li>
              <li>
                <strong className="text-white">Content policy</strong> —
                NVIDIA NeMo Guardrails
              </li>
              <li>
                <strong className="text-white">Quality grader</strong> —
                multi-model critic against the agent&apos;s declared
                guarantee
              </li>
              <li>
                <strong className="text-white">Action critic</strong> —
                second-model verifier for Tier 2/3 agents
              </li>
            </ul>
            <p className="mt-3">
              Failures from any of these are written to the SHA-256 hash-
              chained{" "}
              <Link
                href="/trust/audit"
                className="text-[#B5532C] hover:underline"
              >
                audit log
              </Link>
              . The pipeline is fail-open with logging by default — a
              transient model error on a critic does not block the user
              response, but is captured in the chain. Repeated AUP-
              violating outputs trigger the enforcement flow in §3.
            </p>
          </section>

          {/* ─── 3. Enforcement ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              3. Enforcement
            </h2>
            <p>
              When the safety pipeline detects an AUP violation, or when
              we receive a third-party report (security@sovereignmatrix.agency),
              we may take any of the following actions:
            </p>
            <ul className="mt-3 space-y-1 list-disc list-inside">
              <li>
                <strong className="text-white">Block the specific output</strong> —
                automatic, real-time. The user sees a generic
                &quot;output filtered&quot; message; the underlying reason is
                in the audit log.
              </li>
              <li>
                <strong className="text-white">Rate-limit the agent</strong> —
                if a single agent / API key is producing repeated
                violations.
              </li>
              <li>
                <strong className="text-white">Suspend the API key</strong> —
                with notice unless the violation is severe.
              </li>
              <li>
                <strong className="text-white">Suspend the account</strong> —
                for repeated or severe violations. The user receives the
                specific clause(s) violated by email.
              </li>
              <li>
                <strong className="text-white">Report to authorities</strong> —
                for content that meets the threshold of mandatory
                reporting under applicable law (e.g., CSAM).
              </li>
            </ul>
            <p className="mt-3">
              All enforcement actions are written to the audit chain.
              The cryptographically-chained record means we cannot
              backdate enforcement events.
            </p>
          </section>

          {/* ─── 4. Appeal ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              4. Appeal Path
            </h2>
            <p>
              We get this wrong sometimes. If your output is blocked or
              your account is suspended and you believe the action was
              incorrect:
            </p>
            <ol className="mt-3 space-y-2 list-decimal list-inside">
              <li>
                Open the run detail page at{" "}
                <code className="text-[12px] text-neutral-300">
                  /dashboard/playbooks/runs/[runId]
                </code>{" "}
                — every blocked output keeps a forensic record.
              </li>
              <li>
                Click <strong className="text-white">Request review</strong>{" "}
                from the{" "}
                <Link
                  href="/dashboard/appeals"
                  className="text-[#B5532C] hover:underline"
                >
                  Appeals
                </Link>{" "}
                page (or directly from any run detail). Your message is
                logged with cryptographic timestamps and routed to the
                policy team.
              </li>
              <li>
                We respond within{" "}
                <strong className="text-white">5 business days</strong> with a
                decision and the specific reasoning. Material decisions
                are double-reviewed by a second policy reviewer.
              </li>
              <li>
                If you remain dissatisfied, you may escalate to the
                Information Officer at{" "}
                <a
                  href="mailto:legal@sovereignmatrix.agency"
                  className="text-[#B5532C] hover:underline"
                >
                  legal@sovereignmatrix.agency
                </a>
                .
              </li>
            </ol>
          </section>

          {/* ─── 5. Versioning ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              5. Updates to this Policy
            </h2>
            <p>
              We update this AUP occasionally. Material changes — those
              that meaningfully affect what users may do — get{" "}
              <strong className="text-white">30 days&apos; advance notice</strong>{" "}
              by email to all active accounts and a banner on the
              dashboard. Non-material changes (typos, clarifications)
              are versioned silently in the metadata block at the top
              of this page.
            </p>
            <p className="mt-3">
              Every revision is hashed into the audit chain, so the full
              version history is cryptographically verifiable. Past
              versions are available on request from{" "}
              <a
                href="mailto:legal@sovereignmatrix.agency"
                className="text-[#B5532C] hover:underline"
              >
                legal@sovereignmatrix.agency
              </a>
              .
            </p>
          </section>

          <section className="border-t border-white/10 pt-8">
            <p className="text-[11px] text-neutral-500">
              Questions about this policy:{" "}
              <a
                href="mailto:legal@sovereignmatrix.agency"
                className="text-[#B5532C] hover:underline"
              >
                legal@sovereignmatrix.agency
              </a>{" "}
              · Security incidents:{" "}
              <a
                href="mailto:security@sovereignmatrix.agency"
                className="text-[#B5532C] hover:underline"
              >
                security@sovereignmatrix.agency
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

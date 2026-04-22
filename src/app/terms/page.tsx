import { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/ui/PrintButton";

/**
 * /terms — Terms of Service.
 *
 * Comprehensive SaaS terms covering: service description, accounts,
 * user-submitted agents, payments, refunds, account deletion,
 * warranties, liability, indemnification, arbitration, governing law.
 *
 * Specific to this platform — no generic placeholder copy.
 * Every clause reflects actual mechanics: credit holds, 80% creator
 * payouts, GDPR Article 17 right-to-erasure, the 5-layer verifier.
 *
 * Not a substitute for legal advice. A qualified attorney should
 * review before enterprise contracts >$25k ACV.
 */

export const metadata: Metadata = {
  title: "Terms of Service — Sovereign Matrix",
  description:
    "Rules for using Sovereign Matrix: acceptable use, payment terms, creator program, refund policy, account deletion, liability limits, and dispute resolution.",
};

type Section = { n: string; title: string; children: React.ReactNode };

const SECTIONS: Section[] = [
  {
    n: "1",
    title: "Definitions",
    children: (
      <>
        <p><strong>&quot;Platform&quot;</strong> means Sovereign Matrix — the web application at sovereignmatrix.agency, including its dashboard, APIs, marketplace, and any associated services.</p>
        <p><strong>&quot;Agent&quot;</strong> means a discrete automation routine (one of 137 first-party agents or a third-party submission) that performs a specific task when invoked.</p>
        <p><strong>&quot;Playbook&quot;</strong> means a sequenced chain of agents plus user-supplied inputs that executes as a single run.</p>
        <p><strong>&quot;Credits&quot;</strong> means the prepaid ledger units used to run paid agents. Credits are non-refundable except as stated in §10 and cannot be redeemed for cash.</p>
        <p><strong>&quot;You&quot;</strong> means the natural or legal person accepting these Terms by creating an account.</p>
        <p><strong>&quot;We&quot;</strong>, <strong>&quot;us&quot;</strong>, <strong>&quot;our&quot;</strong> mean Sovereign Matrix (an independent studio operating from Cape Town, Republic of South Africa).</p>
      </>
    ),
  },
  {
    n: "2",
    title: "Acceptance and Eligibility",
    children: (
      <>
        <p>By creating an account or using the Platform, you confirm that you (a) are at least 18 years old, (b) have authority to bind yourself or the entity you represent to these Terms, and (c) will comply with all laws applicable to your use.</p>
        <p>If you are creating the account on behalf of an organization, &quot;you&quot; means both you individually and that organization, jointly and severally.</p>
        <p>We may refuse service, terminate accounts, remove content, or cancel orders at our discretion if we reasonably believe you have violated these Terms.</p>
      </>
    ),
  },
  {
    n: "3",
    title: "Service Description",
    children: (
      <>
        <p>Sovereign Matrix operates an automation platform where specialized agents execute outcome-specific tasks for operators and builders. Current capabilities include lead research, competitive intelligence, content generation, SEO analysis, report scheduling, voice conversation with personas, browser automation, and an agent-to-agent marketplace where third parties can publish their own agents.</p>
        <p>The Platform ships under active development. New agents, features, and integrations are added regularly. We reserve the right to add, modify, deprecate, or remove capabilities with reasonable notice, generally 30 days via email for breaking changes.</p>
        <p>Each agent run passes through a five-layer verification pipeline (jailbreak detection, PII screening, content policy, quality gate, critic review). Verified output is persisted with a cryptographically-signed receipt accessible via your dashboard.</p>
      </>
    ),
  },
  {
    n: "4",
    title: "Account Registration and Security",
    children: (
      <>
        <p>Authentication is handled by Clerk. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us immediately at <a href="mailto:security@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">security@sovereignmatrix.agency</a> if you suspect unauthorized access.</p>
        <p>You must provide accurate information at registration and keep it current. We may require email verification before granting access to certain features.</p>
        <p>One person or legal entity may not operate multiple accounts to circumvent free-tier limits or stack founder-program allowances.</p>
      </>
    ),
  },
  {
    n: "5",
    title: "Acceptable Use",
    children: (
      <>
        <p>You agree NOT to use the Platform to:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Violate any law, regulation, or third-party right;</li>
          <li>Infringe intellectual property — scraping copyrighted content for redistribution, training competing models, or generating plagiarized material for commercial use;</li>
          <li>Generate content that is defamatory, fraudulent, deceptive, or that impersonates real people without their written consent;</li>
          <li>Send unsolicited bulk email, SMS, or voice messages (spam), or use lead-generation outputs in violation of CAN-SPAM, GDPR, POPIA, or TCPA;</li>
          <li>Attempt to reverse-engineer, decompile, or circumvent technical measures protecting the Platform;</li>
          <li>Resell Platform access without our prior written authorization (the partner program, when launched, is the sanctioned resale path);</li>
          <li>Use the Platform to train, fine-tune, or benchmark competing AI services;</li>
          <li>Submit inputs or cause agents to generate content that depicts minors in sexual contexts, violence against real persons, bioweapons, self-harm encouragement, or CSAM of any kind;</li>
          <li>Circumvent rate limits, credit holds, or other usage controls;</li>
          <li>Use the voice agents to record or transcribe calls where all parties have not consented, in jurisdictions that require two-party consent.</li>
        </ul>
        <p>Violations may result in immediate account suspension without refund, and we may cooperate with law enforcement where required.</p>
      </>
    ),
  },
  {
    n: "6",
    title: "Intellectual Property",
    children: (
      <>
        <p><strong className="text-white">Platform IP.</strong> The Platform (codebase, branding, visual design, agent catalog layout, copy) is owned by Sovereign Matrix and protected by copyright, trademark, and trade-secret laws. You receive a limited, revocable, non-exclusive, non-transferable license to access and use the Platform under these Terms — nothing more.</p>
        <p><strong className="text-white">Your content.</strong> You retain ownership of inputs you submit and outputs generated on your behalf. You grant us a limited license to process inputs through the agents you invoke, store outputs for your retrieval, and use aggregated, de-identified usage data to improve the Platform (e.g., routing decisions, quality evals).</p>
        <p><strong className="text-white">Third-party model output.</strong> Outputs produced by AI models (NIM, Claude, Gemini, Groq, Cerebras, etc.) are subject to each provider&apos;s usage terms. You are responsible for ensuring your downstream use complies with those terms — especially around commercial redistribution of specific model outputs.</p>
        <p><strong className="text-white">Our brand.</strong> You may not use our name, logo, or &quot;Sovereign Matrix&quot; trademark without written permission except to identify that you are a customer.</p>
      </>
    ),
  },
  {
    n: "7",
    title: "User-Submitted Agents (Creator Program)",
    children: (
      <>
        <p>If you submit an agent via <Link href="/developers/submit" className="text-[#B5532C] hover:underline">/developers/submit</Link>, you grant Sovereign Matrix a worldwide, non-exclusive, royalty-free license to host, display, execute, and distribute your submission through the Platform for the duration of its availability.</p>
        <p>Submitted agents are reviewed by an admin before promotion to public visibility. Review criteria include accuracy of description, adherence to Acceptable Use (§5), and safety of the system prompt or hosted endpoint.</p>
        <p><strong className="text-white">Creator payouts.</strong> You earn 80% of the pricing amount charged per run of your agent, credited to your Platform balance within 24 hours of each run&apos;s capture. Payouts to external bank accounts are available monthly via the method you configure in settings. We retain the remaining 20% as platform fee.</p>
        <p><strong className="text-white">Warranties you give us.</strong> You warrant that (a) you own or have the right to license all components of your submitted agent, (b) the agent does not infringe any third-party right, (c) the agent complies with §5, and (d) the system prompt and any hosted endpoint do not contain or exfiltrate user data to unauthorized destinations.</p>
        <p><strong className="text-white">Removal.</strong> We may remove any submitted agent at any time for violation of these Terms, material user complaints, or regulatory instruction. Earned-but-unpaid creator credits at the time of removal will be paid out if earned lawfully; if removal is due to §5 violation, we may withhold payouts related to the violating period.</p>
      </>
    ),
  },
  {
    n: "8",
    title: "Payment Terms",
    children: (
      <>
        <p>Paid tiers (Starter $19/mo, Growth $49/mo, Node $199/mo, Enterprise $499/mo, Pay-Per-Run variable) are billed monthly in advance via Stripe, Yoco, PayFast, or Paystack depending on your region. All prices exclude applicable taxes unless explicitly marked.</p>
        <p>We reserve the right to change prices for future billing periods with at least 30 days&apos; email notice. Current-period pricing is locked at renewal time.</p>
        <p>Failed payments: we retry up to 3 times over 7 days. If all retries fail, the account is automatically downgraded to free tier; paid features become unavailable until a successful payment processes.</p>
        <p>Credits purchased separately (for pay-per-run tier or top-ups) are added to your balance immediately upon successful payment and never expire as long as the account is active.</p>
      </>
    ),
  },
  {
    n: "9",
    title: "Credits, Holds, and Captures",
    children: (
      <>
        <p>Each agent run places a pre-authorization &quot;hold&quot; on your credit balance for the estimated cost. If the run succeeds, the hold is captured (balance permanently debited). If the run fails, the hold is released within seconds (balance restored). Unclaimed holds automatically expire and refund within 5 minutes via our sweep cron.</p>
        <p>Holds reduce your apparent available balance while active. Your ledger shows every hold, capture, and release as a separate line item, searchable and auditable via the billing dashboard.</p>
        <p>A2E spawns (agents hiring agents) follow the same model: a parent agent&apos;s run may trigger nested holds for child agent calls, capped at a configurable per-parent limit (default $1.50).</p>
      </>
    ),
  },
  {
    n: "10",
    title: "Refunds",
    children: (
      <>
        <p><strong className="text-white">14-day unconditional refund.</strong> Within 14 calendar days of your first paid invoice, you may request a full refund of that invoice by emailing <a href="mailto:refunds@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">refunds@sovereignmatrix.agency</a> from your registered email address. Processed within 5 business days to the original payment method. No questions asked.</p>
        <p><strong className="text-white">Subsequent cycles.</strong> Monthly billing after the first invoice is not automatically refundable. Cancel before the next billing date to prevent future charges. Pro-rated refunds may be issued at our discretion for exceptional service failures (e.g., more than 48 consecutive hours of full outage during a billing period).</p>
        <p><strong className="text-white">Usage-based charges.</strong> Pay-per-run credits, once successfully captured on a completed agent run, are not refundable. Release-on-failure is automatic via the hold system and is not a refund — it&apos;s the result of the hold never being captured.</p>
        <p><strong className="text-white">Chargebacks.</strong> Initiating a chargeback without first contacting us is grounds for immediate account termination and legal action for the amount disputed plus chargeback fees.</p>
      </>
    ),
  },
  {
    n: "11",
    title: "Cancellation and Termination",
    children: (
      <>
        <p>You may cancel your subscription at any time via the billing dashboard (&quot;Manage Subscription&quot; → Stripe Customer Portal). Cancellation takes effect at the end of the current billing period; access and earned features remain available until that date.</p>
        <p>We may suspend or terminate your account for (a) violation of these Terms, (b) non-payment after the retry window (§8), (c) fraudulent activity, (d) activity that poses security or liability risk to us or other users, or (e) regulatory or legal requirement.</p>
        <p>On termination, your access ends immediately. Earned but unpaid creator payouts are remitted unless termination is due to §5 violation. Your data is retained per the deletion schedule in our Privacy Policy §7.</p>
      </>
    ),
  },
  {
    n: "12",
    title: "Account Deletion (Right to Erasure)",
    children: (
      <>
        <p>You may delete your account at any time at <Link href="/dashboard/settings/delete-account" className="text-[#B5532C] hover:underline">/dashboard/settings/delete-account</Link>. Deletion triggers an irreversible chain: your active subscription is canceled, credit holds are released, personal data across all tables is erased, creator-owned agents are orphaned (attribution removed but agent preserved for ecosystem integrity), and your authentication identity is removed from Clerk.</p>
        <p>Certain records must be retained for legal or regulatory reasons (billing records for tax compliance, anonymized audit logs for safety). These are enumerated in the Privacy Policy §7 and are fully anonymized — they cannot be used to re-identify you.</p>
        <p>Once submitted, deletion cannot be reversed. We recommend exporting your data first via <Link href="/dashboard/settings/export" className="text-[#B5532C] hover:underline">/dashboard/settings/export</Link>.</p>
      </>
    ),
  },
  {
    n: "13",
    title: "Service Availability",
    children: (
      <>
        <p>We publish service-level objectives at <Link href="/trust" className="text-[#B5532C] hover:underline">/trust</Link>, including availability, agent latency, and voice first-audio targets, measured over a rolling 30-day window and reported at the administrative health dashboard.</p>
        <p>Stated targets are aspirational. The Platform is provided &quot;as is&quot; and &quot;as available&quot; without any guarantee of uptime or performance except where explicitly offered in a separately-executed Service Level Agreement (SLA) for Enterprise customers.</p>
        <p>Scheduled maintenance, if any, is announced at least 48 hours in advance via the status page and email.</p>
      </>
    ),
  },
  {
    n: "14",
    title: "AI-Generated Content Disclosure",
    children: (
      <>
        <p>All content produced by agents — text, images, code, audio, voice scripts, research summaries — is generated by machine-learning models. Outputs may contain factual inaccuracies, hallucinations, biases, or offensive material despite our five-layer verifier. You are responsible for reviewing every output before relying on or distributing it.</p>
        <p>Our voice agents identify themselves as AI at the start of every outbound call or message, in compliance with TCPA §227(d) and substantially equivalent regulations in other jurisdictions.</p>
        <p>We do not warrant that outputs are original. Models are trained on large corpora and may reproduce patterns, phrases, or ideas similar to prior training data. For outputs intended for public or commercial distribution, conduct an originality check.</p>
      </>
    ),
  },
  {
    n: "15",
    title: "Third-Party Services and BYOK",
    children: (
      <>
        <p>The Platform integrates with third-party services (Clerk for auth, Neon for database, Stripe/Yoco/PayFast/Paystack for payments, NVIDIA/Anthropic/Google/Groq/Cerebras for inference, Upstash for rate limiting, Sentry for error tracking, PostHog for analytics, Resend for email). Use of the Platform is subject to each third party&apos;s terms and privacy practices, listed in our Privacy Policy §4.</p>
        <p>If you choose to bring your own model API keys (BYOK), you are solely responsible for compliance with that provider&apos;s terms, rate limits, and billing. We encrypt stored BYOK keys at rest and never log them in plaintext.</p>
      </>
    ),
  },
  {
    n: "16",
    title: "Disclaimer of Warranties",
    children: (
      <>
        <p className="uppercase text-[11px] leading-[1.7]">The platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, title, accuracy, or reliability. We make no warranty that the platform will be uninterrupted, error-free, or secure, or that defects will be corrected.</p>
        <p>Some jurisdictions do not allow exclusion of implied warranties; in those jurisdictions, the above exclusion may not apply to you, and the exclusions apply to the maximum extent permitted by law.</p>
      </>
    ),
  },
  {
    n: "17",
    title: "Limitation of Liability",
    children: (
      <>
        <p className="uppercase text-[11px] leading-[1.7]">To the maximum extent permitted by law, in no event shall Sovereign Matrix, its founders, affiliates, agents, or suppliers be liable to you or any third party for any indirect, incidental, consequential, exemplary, special, or punitive damages arising out of or related to your use of the platform, including loss of profits, revenue, data, goodwill, or other intangible losses, whether based in contract, tort, strict liability, or any other theory, and whether or not we have been advised of the possibility of such damages.</p>
        <p>Our total cumulative liability arising out of or related to these Terms or the Platform shall not exceed the greater of (a) the amount you paid us in the twelve (12) months preceding the claim, or (b) one hundred US dollars ($100).</p>
        <p>These limitations apply regardless of the theory of liability and survive termination of these Terms.</p>
      </>
    ),
  },
  {
    n: "18",
    title: "Indemnification",
    children: (
      <>
        <p>You agree to indemnify, defend, and hold harmless Sovereign Matrix, its founders, affiliates, agents, and suppliers from and against any third-party claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to (a) your use of the Platform, (b) your violation of these Terms, (c) your content or submitted agents, or (d) your violation of any third-party right, including intellectual property or privacy rights.</p>
        <p>We reserve the right, at our own expense, to assume exclusive defense and control of any matter subject to indemnification by you, and you agree to cooperate with our defense.</p>
      </>
    ),
  },
  {
    n: "19",
    title: "Force Majeure",
    children: (
      <>
        <p>Neither party is liable for failure to perform due to causes beyond reasonable control, including acts of God, war, terrorism, pandemic, labor disputes, government action, internet or network outage, or third-party service provider failures (e.g., NIM, Stripe, Clerk, Vercel, Railway, Neon downtime).</p>
      </>
    ),
  },
  {
    n: "20",
    title: "Governing Law and Dispute Resolution",
    children: (
      <>
        <p>These Terms are governed by the laws of the Republic of South Africa, without regard to conflict-of-laws principles. Any disputes arising from or related to these Terms will be resolved as follows:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li><strong className="text-white">Informal resolution.</strong> Contact <a href="mailto:legal@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">legal@sovereignmatrix.agency</a> with a written description of the dispute. We will attempt resolution in good faith within 30 days.</li>
          <li><strong className="text-white">Mediation.</strong> If unresolved, the parties agree to attempt mediation under the Arbitration Foundation of Southern Africa (AFSA) rules before filing suit.</li>
          <li><strong className="text-white">Jurisdiction.</strong> If mediation fails, disputes will be resolved exclusively in the courts of the Western Cape, Republic of South Africa, and both parties consent to personal jurisdiction there.</li>
        </ol>
        <p><strong className="text-white">Class action waiver.</strong> To the maximum extent permitted by law, you agree that any dispute will be resolved on an individual basis and not as a class, consolidated, or representative action.</p>
      </>
    ),
  },
  {
    n: "21",
    title: "Modifications to Terms",
    children: (
      <>
        <p>We may modify these Terms at any time. Material changes will be communicated by email to your registered address at least 14 days before taking effect, and we will update the &quot;Last updated&quot; date at the top of this page. Continued use after the effective date constitutes acceptance. If you do not accept the changes, your sole remedy is to discontinue use and cancel your account.</p>
      </>
    ),
  },
  {
    n: "22",
    title: "Severability and Entire Agreement",
    children: (
      <>
        <p>If any provision of these Terms is held unenforceable, the remaining provisions remain in full force and effect, and the unenforceable provision will be reformed to the minimum extent necessary to make it enforceable while preserving its intent.</p>
        <p>These Terms, together with our Privacy Policy and any Order Forms or DPAs executed separately, constitute the entire agreement between you and us regarding the Platform and supersede all prior or contemporaneous agreements, representations, and communications.</p>
      </>
    ),
  },
  {
    n: "23",
    title: "Contact",
    children: (
      <>
        <p>For questions about these Terms: <a href="mailto:legal@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">legal@sovereignmatrix.agency</a></p>
        <p>For privacy requests: <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a></p>
        <p>For security reports: <a href="mailto:security@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">security@sovereignmatrix.agency</a></p>
        <p>For general support: <a href="mailto:support@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">support@sovereignmatrix.agency</a></p>
        <p className="mt-3">Sovereign Matrix — Cape Town, Republic of South Africa</p>
      </>
    ),
  },
];

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-[12px] font-mono text-neutral-500 mb-4">
          Last updated: 22 April 2026 · Version 2.0
        </p>
        <div className="mb-12">
          <PrintButton />
        </div>

        <div className="space-y-8 text-[13px] text-neutral-400 leading-relaxed">
          <section>
            <p>
              These Terms of Service (&quot;Terms&quot;) form a binding agreement between you and Sovereign Matrix governing your use of the Platform (defined below). Please read carefully. By creating an account, making a payment, or otherwise using the Platform, you accept these Terms and our{" "}
              <Link href="/privacy" className="text-[#B5532C] hover:underline">Privacy Policy</Link>.
              If you do not agree, do not use the Platform.
            </p>
          </section>

          {SECTIONS.map((s) => (
            <section key={s.n}>
              <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
                {s.n}. {s.title}
              </h2>
              <div className="space-y-3">{s.children}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

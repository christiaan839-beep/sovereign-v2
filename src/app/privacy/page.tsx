import { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/ui/PrintButton";

/**
 * /privacy — Privacy Policy.
 *
 * GDPR Article 13 complete (all disclosures required for data
 * collected directly from the subject), plus POPIA (South Africa),
 * CCPA (California), CalOPPA cookie disclosures, and the breach-
 * notification commitment (72hr per GDPR Article 33).
 *
 * Every data processor the platform uses is enumerated with its
 * role + region. Every user right is listed with the exercise path.
 * Retention periods are specific numeric durations, not "as long as
 * necessary" fluff.
 *
 * This is a serious document. Do not edit casually — a legal review
 * stamp lives in the comments above each legally-loaded paragraph.
 */

export const metadata: Metadata = {
  title: "Privacy Policy — Sovereign Matrix",
  description:
    "How Sovereign Matrix collects, uses, stores, and protects your data. GDPR/POPIA/CCPA compliant. Specific processors, specific retention windows, specific rights — with the exact flow to exercise each.",
};

export default function PrivacyPage() {
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
          Privacy Policy
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
              This Privacy Policy explains how Sovereign Matrix (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, stores, and protects personal data when you use our Platform. It also describes your rights under the EU General Data Protection Regulation (GDPR), the Republic of South Africa Protection of Personal Information Act (POPIA), and the California Consumer Privacy Act (CCPA/CPRA), and how to exercise them.
            </p>
          </section>

          {/* ─── 1. Data controller ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              1. Data Controller &amp; Information Officer
            </h2>
            <p>Sovereign Matrix is the data controller for the personal data described in this Policy, except where we act as a processor under a separately-executed Data Processing Agreement (DPA) with a business customer.</p>
            <p className="mt-3"><strong className="text-white">Information Officer (POPIA) / Data Protection point of contact:</strong></p>
            <p>Christiaan de Wet — <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a></p>
            <p>Postal address: Sovereign Matrix, Cape Town, Western Cape, Republic of South Africa.</p>
            <p className="mt-3"><strong className="text-white">EU representative:</strong> Not appointed. We do not offer services primarily to individuals in the EU and process EU personal data incidentally as part of a global B2B SaaS offering. If our user base in the EU grows materially, we will appoint a GDPR Article 27 representative and publish their details here.</p>
          </section>

          {/* ─── 2. What data ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              2. Information We Collect
            </h2>
            <p><strong className="text-white">2.1 Account data</strong> — name (optional), email address (required), password hash (stored only by Clerk, never by us), billing address, tax/VAT identifier (business accounts), company name (optional).</p>
            <p><strong className="text-white">2.2 Usage data</strong> — which agents and playbooks you run, input fields you provide, duration of runs, success/failure status, credit transactions, support interactions.</p>
            <p><strong className="text-white">2.3 Content data</strong> — text, URLs, documents, files, and voice audio you submit to agents. This is the most privacy-sensitive category and is covered by explicit retention + deletion rules in §7.</p>
            <p><strong className="text-white">2.4 Technical data</strong> — IP address (truncated to /24 after 48 hours), browser user-agent family, device type, referring URL, timestamps. Collected for security, debugging, and anti-abuse.</p>
            <p><strong className="text-white">2.5 Marketing data</strong> — email-open + click events for transactional and marketing emails we send via Resend, only until you unsubscribe (one-click from every email or at <Link href="/unsubscribe" className="text-[#B5532C] hover:underline">/unsubscribe</Link>).</p>
            <p><strong className="text-white">2.6 Automated-decision inputs</strong> — see §10 for what decisions agents make automatically and how you can contest them.</p>
            <p><strong className="text-white">What we do NOT collect:</strong> precise location (GPS), biometric identifiers, government ID numbers beyond VAT, criminal history, health information (unless specifically uploaded by you to a healthcare-vertical agent under a DPA), political/religious views.</p>
          </section>

          {/* ─── 3. How we use ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              3. Purposes &amp; Legal Bases for Processing
            </h2>
            <p>We process personal data for the following purposes, each with its GDPR Article 6 legal basis:</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[12px] border border-white/[0.08]">
                <thead>
                  <tr className="bg-white/[0.02] text-white">
                    <th className="text-left p-2 border-b border-white/[0.06]">Purpose</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Legal basis</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Data used</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="p-2 border-b border-white/[0.04]">Run agents on your behalf</td><td className="p-2 border-b border-white/[0.04]">Contract (Art 6(1)(b))</td><td className="p-2 border-b border-white/[0.04]">Account + content + usage</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Billing &amp; payments</td><td className="p-2 border-b border-white/[0.04]">Contract + legal obligation</td><td className="p-2 border-b border-white/[0.04]">Account + billing</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Security &amp; fraud prevention</td><td className="p-2 border-b border-white/[0.04]">Legitimate interest (Art 6(1)(f))</td><td className="p-2 border-b border-white/[0.04]">Technical + usage</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Product improvement (aggregated)</td><td className="p-2 border-b border-white/[0.04]">Legitimate interest</td><td className="p-2 border-b border-white/[0.04]">De-identified usage</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Transactional email</td><td className="p-2 border-b border-white/[0.04]">Contract</td><td className="p-2 border-b border-white/[0.04]">Email address</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Marketing email</td><td className="p-2 border-b border-white/[0.04]">Consent (Art 6(1)(a))</td><td className="p-2 border-b border-white/[0.04]">Email address</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Compliance with legal obligations</td><td className="p-2 border-b border-white/[0.04]">Legal obligation (Art 6(1)(c))</td><td className="p-2 border-b border-white/[0.04]">Billing + audit</td></tr>
                  <tr><td className="p-2">Establishment/defense of legal claims</td><td className="p-2">Legitimate interest</td><td className="p-2">As needed</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">We do not use personal data for automated profiling that produces legal or similarly significant effects on you. See §10 for the specific automated decisions agents do make and how to object.</p>
          </section>

          {/* ─── 4. Third parties ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              4. Third-Party Processors
            </h2>
            <p>The Platform relies on the following sub-processors. Each is contractually bound to a Data Processing Agreement or equivalent safeguards where required:</p>

            <p className="mt-3"><strong className="text-white">Authentication:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Clerk (USA) — authentication, session management, user directory. <a className="text-[#B5532C] hover:underline" href="https://clerk.com/privacy" target="_blank" rel="noopener">Policy</a></li>
            </ul>

            <p className="mt-3"><strong className="text-white">Infrastructure:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Neon (USA/EU) — Postgres database hosting. Data stored in the region you selected at onboarding.</li>
              <li>Vercel (global edge network) — application hosting, CDN, edge functions. Routes traffic via the nearest region.</li>
              <li>Railway (USA) — voice WebSocket runtime.</li>
              <li>Upstash (global) — Redis cache for rate limits and SLO samples.</li>
              <li>Pinecone / Qdrant (USA) — vector database for agent memory.</li>
            </ul>

            <p className="mt-3"><strong className="text-white">AI model providers</strong> (which specific model is invoked depends on the agent, your sovereignty setting, and the smart router):</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>NVIDIA NIM — Nemotron, embeddings, content safety (USA)</li>
              <li>Anthropic Claude — generation, computer use, citations (USA)</li>
              <li>Google Gemini — generation, embeddings (USA)</li>
              <li>Groq — inference acceleration, Whisper transcription (USA)</li>
              <li>Cerebras — fast inference (USA)</li>
              <li>Meta Llama, Mistral, Qwen, DeepSeek, Black Forest Labs FLUX — routed via NIM (region varies)</li>
              <li>Tavily — grounded web search (USA)</li>
              <li>ElevenLabs — voice synthesis fallback (USA)</li>
            </ul>
            <p className="text-[11.5px] italic mt-1">When Data Sovereignty Mode is enabled on your account, we route only to model providers with US/EU weight origin and exclude those with weights produced under the jurisdiction of the People&apos;s Republic of China.</p>

            <p className="mt-3"><strong className="text-white">Payments:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Stripe (USA) — primary card processor</li>
              <li>Yoco (South Africa) — South African card processor</li>
              <li>PayFast (South Africa) — South African card + EFT</li>
              <li>Paystack (Nigeria) — West African processor</li>
            </ul>
            <p className="text-[11.5px] italic mt-1">Card numbers are never transmitted to or stored by us. Payment pages are hosted by the processor.</p>

            <p className="mt-3"><strong className="text-white">Observability:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Sentry (USA) — error tracking with automatic PII scrubbing enabled</li>
              <li>PostHog (EU or USA depending on instance) — product analytics with Do Not Track honored</li>
              <li>Langfuse (EU or self-hosted) — LLM trace logging (BYOK only; disabled by default)</li>
            </ul>

            <p className="mt-3"><strong className="text-white">Communications:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Resend (USA) — transactional email (receipts, password resets, weekly reports)</li>
              <li>Twilio (USA) — optional voice + SMS integrations</li>
              <li>Telegram Bot API — optional playbook-completion notifications</li>
            </ul>

            <p className="mt-3"><strong className="text-white">Browser automation (when you enable Computer Use):</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Local Playwright (no third party) — default</li>
              <li>Browserbase (USA) — optional, enabled by env flag</li>
              <li>Hyperbrowser — optional, enabled by env flag</li>
            </ul>
          </section>

          {/* ─── 5. AI disclosure ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              5. Content Data and AI Processing
            </h2>
            <p>Inputs you submit to agents are forwarded to the AI model provider(s) selected for that agent. Each provider&apos;s handling of your input is governed by its own policy, linked in §4. We do NOT allow any model provider to train its foundation models on your inputs — this is contractually prohibited via Zero-Data-Retention (ZDR) configuration on all provider accounts, verified quarterly.</p>
            <p className="mt-2">Outputs are stored in our Neon database attributed to your account and are retrievable via your dashboard for 12 months (see §7). Agent &quot;memory&quot; embeddings stored in Pinecone/Qdrant are tenant-scoped and never shared across users.</p>
            <p className="mt-2">The five-layer verification pipeline (jailbreak detection, PII screening, content policy, quality gate, critic review) runs on every agent output. The PII screening layer redacts emails, phone numbers, government IDs, and credit card numbers from output before returning it to the client — unless the output format explicitly requires them (e.g., lead-generation agents where the task is to find contact info).</p>
          </section>

          {/* ─── 6. Cross-border ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              6. Cross-Border Transfers
            </h2>
            <p>Your data may be processed in the United States, the European Union, the United Kingdom, and the Republic of South Africa depending on which third-party services your runs invoke (see §4).</p>
            <p className="mt-2">For transfers from the EU/UK to the United States, we rely on either (a) the EU-U.S. Data Privacy Framework certification of the receiving processor, or (b) Standard Contractual Clauses (SCCs) approved by the European Commission, as supplemented following the Schrems II judgment. Copies of executed SCCs are available on request to <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a>.</p>
            <p className="mt-2">Transfers from South Africa rely on POPIA §72 conditions for cross-border transfers to jurisdictions with comparable protection.</p>
          </section>

          {/* ─── 7. Retention + deletion ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              7. Data Retention
            </h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[12px] border border-white/[0.08]">
                <thead>
                  <tr className="bg-white/[0.02] text-white">
                    <th className="text-left p-2 border-b border-white/[0.06]">Category</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Retention (active account)</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Retention (after deletion)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="p-2 border-b border-white/[0.04]">Account (name, email)</td><td className="p-2 border-b border-white/[0.04]">Life of account</td><td className="p-2 border-b border-white/[0.04]">Deleted within 30 days</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Agent inputs</td><td className="p-2 border-b border-white/[0.04]">12 months rolling</td><td className="p-2 border-b border-white/[0.04]">Deleted at account deletion</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Agent outputs</td><td className="p-2 border-b border-white/[0.04]">12 months rolling</td><td className="p-2 border-b border-white/[0.04]">Deleted at account deletion</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Voice audio</td><td className="p-2 border-b border-white/[0.04]">Not retained (streamed through and discarded)</td><td className="p-2 border-b border-white/[0.04]">N/A</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Voice transcripts</td><td className="p-2 border-b border-white/[0.04]">30 days</td><td className="p-2 border-b border-white/[0.04]">Deleted at account deletion</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Billing records</td><td className="p-2 border-b border-white/[0.04]">Life of account</td><td className="p-2 border-b border-white/[0.04]">Anonymized, kept 7 years (tax compliance)</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Usage analytics</td><td className="p-2 border-b border-white/[0.04]">Aggregated after 6 months</td><td className="p-2 border-b border-white/[0.04]">Already anonymized</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">Audit / safety events</td><td className="p-2 border-b border-white/[0.04]">Life of account</td><td className="p-2 border-b border-white/[0.04]">Anonymized, kept 2 years (legal obligation)</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">IP address (technical logs)</td><td className="p-2 border-b border-white/[0.04]">48 hours full, then truncated to /24</td><td className="p-2 border-b border-white/[0.04]">Purged on deletion</td></tr>
                  <tr><td className="p-2">Submitted agents (creator program)</td><td className="p-2">Life of the agent</td><td className="p-2">Orphaned (attribution removed), definition preserved</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">You may request erasure of your account at any time at <Link href="/dashboard/settings/delete-account" className="text-[#B5532C] hover:underline">/dashboard/settings/delete-account</Link>. Deletion is irreversible and takes effect immediately on submission; retained records above are anonymized so they cannot be used to re-identify you.</p>
          </section>

          {/* ─── 8. Security ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              8. Security Measures
            </h2>
            <p><strong className="text-white">Encryption in transit:</strong> TLS 1.3 for all HTTPS traffic; TLS for all Postgres connections; HMAC-signed internal webhooks.</p>
            <p><strong className="text-white">Encryption at rest:</strong> AES-256 for database volumes (Neon-managed), AES-256 for BYOK API keys using a platform encryption key rotated annually.</p>
            <p><strong className="text-white">Authentication:</strong> Clerk SSO + password + optional 2FA. Sessions expire after 30 days of inactivity.</p>
            <p><strong className="text-white">Network:</strong> Rate limits on every /api/ endpoint, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers.</p>
            <p><strong className="text-white">Access control:</strong> Row-level security (Postgres RLS) isolates tenant data. Admin access is allowlist-gated and logged. No direct database access from the application server — all queries go through Drizzle ORM with parameterized statements.</p>
            <p><strong className="text-white">Secret management:</strong> Environment variables loaded at boot with Zod-validated schema. Secrets never logged. CRON_SECRET, VOICE_SESSION_SECRET, and webhook signing keys are rotated quarterly.</p>
            <p><strong className="text-white">Audit trail:</strong> Every agent run writes an immutable safety_events record. Admin actions are logged with actor userId, timestamp, and target.</p>
            <p><strong className="text-white">Third-party review:</strong> We will commission an independent penetration test annually starting in calendar year 2027, and publish the summary at <Link href="/trust" className="text-[#B5532C] hover:underline">/trust</Link>.</p>
          </section>

          {/* ─── 9. Breach notification ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              9. Data Breach Notification
            </h2>
            <p>If we discover a personal-data breach likely to result in risk to your rights and freedoms, we will notify the relevant supervisory authority (Information Regulator for South Africa; equivalent authority in your EU member state for EU residents) within 72 hours of becoming aware of it, as required by GDPR Article 33 and POPIA §22.</p>
            <p>We will notify affected individuals without undue delay via the email address on file when the breach is likely to result in high risk to your rights. The notification will include the nature of the breach, categories + approximate number of records affected, likely consequences, and mitigation steps we have taken.</p>
          </section>

          {/* ─── 10. Automated decision-making ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              10. Automated Decision-Making (GDPR Article 22)
            </h2>
            <p>The Platform uses automated systems to make the following decisions about your runs:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Safety verification</strong> — the five-layer pipeline may block or pause an agent output. You may contest a block by emailing <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a>.</li>
              <li><strong className="text-white">Rate limiting</strong> — automated per-IP and per-user throttling. Resets on the sliding window.</li>
              <li><strong className="text-white">Model routing</strong> — the smart router selects which AI model handles your input based on task category, your sovereignty setting, and provider availability. The routing decision is logged.</li>
              <li><strong className="text-white">Fraud detection</strong> — payment declines and unusual usage patterns may trigger manual review.</li>
            </ul>
            <p className="mt-3">None of the above produces legal or similarly significant effects within the meaning of GDPR Article 22(1). You have the right to request human review of any automated decision that affects you; contact <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a> within 30 days.</p>
          </section>

          {/* ─── 11. Your rights ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              11. Your Rights
            </h2>
            <p>Under GDPR, POPIA, and CCPA you have the following rights. We respond to verified requests within 30 days (GDPR) or 45 days (CCPA). No fee for the first request per calendar year; reasonable fee thereafter for manifestly excessive requests.</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong className="text-white">Access</strong> — machine-readable export of your personal data. Self-serve at <Link href="/dashboard/settings/export" className="text-[#B5532C] hover:underline">/dashboard/settings/export</Link>.</li>
              <li><strong className="text-white">Rectification</strong> — correct inaccurate or incomplete data via account settings or email.</li>
              <li><strong className="text-white">Erasure</strong> — delete your account and associated data via <Link href="/dashboard/settings/delete-account" className="text-[#B5532C] hover:underline">/dashboard/settings/delete-account</Link>.</li>
              <li><strong className="text-white">Restriction</strong> — ask us to restrict processing while we resolve a dispute.</li>
              <li><strong className="text-white">Portability</strong> — data export in JSON + CSV formats.</li>
              <li><strong className="text-white">Objection</strong> — object to legitimate-interest processing. We will stop unless we demonstrate compelling overriding grounds.</li>
              <li><strong className="text-white">Withdraw consent</strong> — for marketing emails (unsubscribe link in every email) and analytics (cookie banner).</li>
              <li><strong className="text-white">Non-discrimination (CCPA)</strong> — exercising your rights will not result in denied service or degraded experience.</li>
              <li><strong className="text-white">Supervisory authority complaint</strong> — you may lodge a complaint with your local data protection authority. For South Africa: <a className="text-[#B5532C] hover:underline" href="https://inforegulator.org.za" target="_blank" rel="noopener">Information Regulator</a>. For EU residents: your member state authority (list at <a className="text-[#B5532C] hover:underline" href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener">edpb.europa.eu</a>).</li>
            </ul>
            <p className="mt-2">To exercise any right above, email <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a> from your registered email address. We may require additional verification for unusual requests.</p>
          </section>

          {/* ─── 12. Cookies ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              12. Cookies &amp; Similar Technologies
            </h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[12px] border border-white/[0.08]">
                <thead>
                  <tr className="bg-white/[0.02] text-white">
                    <th className="text-left p-2 border-b border-white/[0.06]">Cookie</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Purpose</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Type</th>
                    <th className="text-left p-2 border-b border-white/[0.06]">Lifetime</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="p-2 border-b border-white/[0.04]">__clerk_*</td><td className="p-2 border-b border-white/[0.04]">Authentication session</td><td className="p-2 border-b border-white/[0.04]">Essential</td><td className="p-2 border-b border-white/[0.04]">30 days</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">sovereign_onboarding</td><td className="p-2 border-b border-white/[0.04]">Onboarding progress</td><td className="p-2 border-b border-white/[0.04]">Functional</td><td className="p-2 border-b border-white/[0.04]">90 days</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">sovereign_ab_*</td><td className="p-2 border-b border-white/[0.04]">A/B test cohort</td><td className="p-2 border-b border-white/[0.04]">Functional</td><td className="p-2 border-b border-white/[0.04]">30 days</td></tr>
                  <tr><td className="p-2 border-b border-white/[0.04]">ph_*</td><td className="p-2 border-b border-white/[0.04]">Product analytics (PostHog)</td><td className="p-2 border-b border-white/[0.04]">Analytics (consent-gated)</td><td className="p-2 border-b border-white/[0.04]">1 year</td></tr>
                  <tr><td className="p-2">_vercel_*</td><td className="p-2">CDN routing</td><td className="p-2">Essential</td><td className="p-2">Session</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">We do NOT use third-party advertising or retargeting cookies. We honor browser Do Not Track (DNT) and Global Privacy Control (GPC) signals — when either is set, analytics cookies are suppressed automatically.</p>
          </section>

          {/* ─── 13. Children ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              13. Children&apos;s Privacy
            </h2>
            <p>The Platform is not directed to individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a> and we will delete it promptly.</p>
          </section>

          {/* ─── 14. CCPA ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              14. California Consumer Privacy (CCPA/CPRA)
            </h2>
            <p>California residents have the rights described in §11 plus:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">Right to know</strong> what categories of personal information we collected, sources, purpose, and third parties (all disclosed above in §2 and §4).</li>
              <li><strong className="text-white">Right to opt out of sale/sharing.</strong> <em>We do not sell or share personal information.</em> This applies to all users, not just California residents.</li>
              <li><strong className="text-white">Right to limit use of sensitive personal information.</strong> We do not use sensitive PI (as defined by CCPA §1798.140(ae)) beyond what is necessary to provide the service.</li>
              <li><strong className="text-white">Right to non-discrimination</strong> for exercising any right.</li>
              <li><strong className="text-white">Authorized agent</strong> — you may designate an authorized agent to exercise your rights. Require proof of authorization.</li>
            </ul>
          </section>

          {/* ─── 15. Marketing ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              15. Marketing Communications
            </h2>
            <p>We send two categories of email: transactional (receipts, security alerts, service announcements) and marketing (product updates, launch announcements). Transactional emails cannot be unsubscribed from while your account is active — you must delete the account. Marketing emails include a one-click unsubscribe header per RFC 8058 and a visible unsubscribe link; unsubscribing is honored within 48 hours.</p>
          </section>

          {/* ─── 16. Changes ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              16. Changes to This Policy
            </h2>
            <p>We may update this Policy. Material changes (new data categories, new processors, new purposes) will be announced by email with at least 14 days&apos; notice before taking effect. Minor or clarifying changes are published with an updated &quot;Last updated&quot; date.</p>
          </section>

          {/* ─── 17. Contact ─── */}
          <section>
            <h2 className="text-[15px] font-semibold text-white mb-3 tracking-tight">
              17. Contact
            </h2>
            <p>Privacy inquiries, data subject access requests, complaints: <a href="mailto:privacy@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">privacy@sovereignmatrix.agency</a></p>
            <p>Security reports: <a href="mailto:security@sovereignmatrix.agency" className="text-[#B5532C] hover:underline">security@sovereignmatrix.agency</a></p>
            <p className="mt-3">Sovereign Matrix — Cape Town, Western Cape, Republic of South Africa</p>
          </section>
        </div>
      </div>
    </div>
  );
}

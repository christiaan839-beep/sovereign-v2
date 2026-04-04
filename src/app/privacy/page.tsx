import { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata: Metadata = {
  title: "Privacy Policy — Sovereign Matrix",
  description: "Sovereign Matrix privacy policy — how we collect, use, store, and protect your data. GDPR-compliant data practices, your rights, and our contact details.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 py-32">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block">&larr; Back to Home</Link>

        <h1 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-4">Last updated: March 29, 2026</p>
        <div className="mb-12">
          <PrintButton />
        </div>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-2"><strong className="text-neutral-200">Account Information:</strong> Name, email address, and billing information when you create an account.</p>
            <p className="mb-2"><strong className="text-neutral-200">Usage Data:</strong> Which agents you use, task frequency, agent outputs, and performance metrics to improve the platform.</p>
            <p className="mb-2"><strong className="text-neutral-200">Content Data:</strong> Text, documents, URLs, and other inputs you provide to AI agents for processing.</p>
            <p><strong className="text-neutral-200">Technical Data:</strong> IP address, browser type, and device information for security and analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your information to: provide and maintain the Sovereign Matrix platform, process payments, send transactional emails, improve our services, enforce usage limits, and provide customer support. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Lawful Basis for Processing</h2>
            <p className="mb-2"><strong className="text-neutral-200">Contract:</strong> Processing necessary to provide the services you signed up for (agent execution, billing).</p>
            <p className="mb-2"><strong className="text-neutral-200">Legitimate Interest:</strong> Service improvement, security monitoring, fraud prevention.</p>
            <p><strong className="text-neutral-200">Consent:</strong> Marketing communications, analytics cookies (you may withdraw consent at any time).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. AI Processing &amp; Third-Party Services</h2>
            <p className="mb-3">When you use Sovereign Matrix agents, your input data is processed by one or more AI model providers. The specific provider depends on the agent and your configuration (BYOK keys or platform defaults).</p>
            <div className="space-y-1">
              <p><strong className="text-neutral-200">AI Model Providers:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>NVIDIA NIM — Nemotron, NeMo Guardrails, embeddings, content safety (USA)</li>
                <li>Google Gemini — Text generation, embeddings (USA)</li>
                <li>Anthropic Claude — Text generation, computer use, citations (USA)</li>
                <li>Groq — Inference acceleration, Whisper transcription (USA)</li>
                <li>Meta Llama — Open-source models via NIM (USA)</li>
                <li>DeepSeek — Reasoning models via NIM and Groq (China/USA)</li>
                <li>Qwen — Multilingual models via NIM (China/USA)</li>
                <li>Mistral AI — European models via NIM (France/USA)</li>
                <li>Black Forest Labs FLUX — Image generation (Germany/USA)</li>
                <li>Tavily — Web search and research (USA)</li>
              </ul>
              <p className="mt-3"><strong className="text-neutral-200">Infrastructure:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Clerk — Authentication and user management (USA)</li>
                <li>Neon — PostgreSQL database hosting (USA/EU)</li>
                <li>Vercel — Application hosting, CDN, edge functions (Global)</li>
                <li>Pinecone — Vector database for agent memory (USA)</li>
              </ul>
              <p className="mt-3"><strong className="text-neutral-200">Payments:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Yoco — Payment processing (South Africa)</li>
                <li>PayFast — South African payment processing (South Africa)</li>
                <li>PayStack — Nigerian payment processing (Nigeria)</li>
              </ul>
              <p className="mt-3"><strong className="text-neutral-200">Communications:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Resend — Transactional email delivery (USA)</li>
                <li>Twilio — Voice calls and SMS (USA)</li>
                <li>ElevenLabs — Voice synthesis (USA)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. AI-Generated Content Disclosure</h2>
            <p>All content produced by Sovereign Matrix agents (text, images, code, voice scripts) is AI-generated. AI outputs may contain inaccuracies and should be reviewed before use. Voice agents identify themselves as AI at the start of every outbound call, in compliance with TCPA and applicable regulations.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Cross-Border Data Transfers</h2>
            <p>Your data may be processed in the United States, European Union, and South Africa depending on which AI providers and infrastructure services are used. We rely on standard contractual clauses and adequacy decisions where applicable to ensure appropriate data protection.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Data Retention</h2>
            <p className="mb-2"><strong className="text-neutral-200">Agent outputs:</strong> Retained for 12 months, then automatically deleted.</p>
            <p className="mb-2"><strong className="text-neutral-200">Billing records:</strong> Retained for 36 months as required by tax regulations.</p>
            <p className="mb-2"><strong className="text-neutral-200">Account data:</strong> Retained until you request deletion.</p>
            <p><strong className="text-neutral-200">Usage analytics:</strong> Aggregated and anonymized after 6 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Data Security</h2>
            <p>We use TLS 1.3 encryption for all data in transit. Database connections use SSL. Payment information is processed securely through PCI-compliant payment providers and is never stored on our servers. API keys provided via BYOK are encrypted at rest. We implement security headers (HSTS, CSP, X-Frame-Options) and rate limiting on all endpoints.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Your Rights</h2>
            <p className="mb-2">Under GDPR, POPIA, and CCPA, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-neutral-200">Access</strong> — Request a copy of your personal data</li>
              <li><strong className="text-neutral-200">Rectification</strong> — Request correction of inaccurate data</li>
              <li><strong className="text-neutral-200">Erasure</strong> — Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
              <li><strong className="text-neutral-200">Portability</strong> — Request your data in a machine-readable format</li>
              <li><strong className="text-neutral-200">Objection</strong> — Object to processing based on legitimate interest</li>
              <li><strong className="text-neutral-200">Withdraw consent</strong> — For marketing and non-essential cookies</li>
              <li><strong className="text-neutral-200">Non-discrimination</strong> — (CCPA) We will not discriminate against you for exercising your rights</li>
            </ul>
            <p className="mt-2">Contact <a href="mailto:christiaan@sovereignmatrix.agency" className="text-emerald-400 hover:underline">christiaan@sovereignmatrix.agency</a> to exercise these rights. We respond within 30 days.</p>
          </section>

          <section id="popia">
            <h2 className="text-lg font-bold text-white mb-3">10. POPIA Compliance (South Africa)</h2>
            <p className="mb-2">Sovereign Matrix is operated from Cape Town, South Africa and complies with the Protection of Personal Information Act (POPIA).</p>
            <p><strong className="text-neutral-200">Information Officer:</strong> Christiaan de Wet — <a href="mailto:christiaan@sovereignmatrix.agency" className="text-emerald-400 hover:underline">christiaan@sovereignmatrix.agency</a></p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Cookies</h2>
            <p className="mb-2">We use the following cookies:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-neutral-200">Essential:</strong> Authentication session cookies (Clerk) — required for the platform to function</li>
              <li><strong className="text-neutral-200">Analytics:</strong> Plausible Analytics — privacy-friendly, no personal data collected, no consent required</li>
              <li><strong className="text-neutral-200">Functional:</strong> A/B testing cohort cookie — used to improve the experience</li>
            </ul>
            <p className="mt-2">We do not use advertising or tracking cookies. You can manage cookie preferences via the consent banner on your first visit.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Email Communications</h2>
            <p>We send transactional emails (account confirmations, billing receipts) and optional marketing emails. You can unsubscribe from marketing emails at any time via the unsubscribe link in every email or by visiting <a href="/unsubscribe" className="text-emerald-400 hover:underline">sovereignmatrix.agency/unsubscribe</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">13. Do Not Sell My Personal Information</h2>
            <p>We do not sell, rent, or trade your personal information to third parties for marketing purposes. This applies to all users, including California residents under the CCPA.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">14. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Material changes will be communicated via email or an in-app notification. Continued use of the platform after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">15. Contact</h2>
            <p>For privacy-related inquiries: <a href="mailto:christiaan@sovereignmatrix.agency" className="text-emerald-400 hover:underline">christiaan@sovereignmatrix.agency</a></p>
            <p className="mt-1">Sovereign Matrix — Cape Town, South Africa</p>
          </section>
        </div>
      </div>
    </div>
  );
}

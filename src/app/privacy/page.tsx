import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Sovereign Matrix",
  description: "Sovereign Matrix privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 py-32">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block">← Back to Home</Link>
        
        <h1 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-12">Last updated: March 2026</p>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your name, email address, and billing information. We also collect usage data such as which features you use and how often, to improve the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use your information to: provide and maintain the Sovereign Matrix platform, process payments via PayFast, send transactional emails, improve our services, and provide customer support. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Data Security</h2>
            <p>We use 256-bit encryption for all data in transit. Your payment information is processed securely through PayFast and is never stored on our servers. We implement industry-standard security measures to protect your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services: Clerk (authentication), PayFast (payments), Vercel (hosting), Pinecone (AI memory), and Google Gemini (AI processing). Each has their own privacy policy and data handling practices.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Your Rights</h2>
            <p>Under POPIA (Protection of Personal Information Act), you have the right to: access your personal information, request correction or deletion of your data, object to processing, and withdraw consent. Contact us at support@sovereignmatrix.agency to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use third-party advertising cookies or trackers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:support@sovereignmatrix.agency" className="text-[#00B7FF] hover:underline">support@sovereignmatrix.agency</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

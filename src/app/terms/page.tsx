import { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/ui/PrintButton";

export const metadata: Metadata = {
  title: "Terms of Service — Sovereign Matrix",
  description: "Sovereign Matrix terms of service — rules and guidelines for using the platform. Acceptable use, account terms, subscription details, and liability.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 py-32">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block">← Back to Home</Link>

        <h1 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-4">Last updated: March 2026</p>
        <div className="mb-12">
          <PrintButton />
        </div>

        <div className="space-y-8 text-sm text-neutral-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Sovereign Matrix (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Service Description</h2>
            <p>Sovereign Matrix provides AI-powered marketing tools including content generation, ad creation, SEO optimization, lead prospecting, and marketing analytics. The platform is provided &quot;as-is&quot; and we continuously update and improve our tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Accounts and Billing</h2>
            <p>You must provide accurate information when creating an account. Subscription fees are billed monthly in USD via Stripe. You may cancel at any time from your dashboard; access continues until the end of the current billing period.</p>
            <p className="mt-3"><strong>14-day unconditional refund.</strong> Within 14 calendar days of your first paid invoice, you can request a full refund of that invoice by emailing <a href="mailto:refunds@sovereignmatrix.agency" className="text-emerald-400 underline">refunds@sovereignmatrix.agency</a> from the email address associated with your account. We refund within 5 business days via the original payment method. No conditions. The guarantee covers the first invoice only; subsequent monthly charges are not automatically refundable, but you can cancel before the next billing date to avoid future charges.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to: use the platform for illegal purposes, generate harmful or misleading content, attempt to reverse-engineer the platform, resell access without authorization, or violate any applicable South African laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Intellectual Property</h2>
            <p>Content you generate using Sovereign Matrix belongs to you. The platform itself, including its design, code, and branding, remains the property of Sovereign Matrix. You may not copy, modify, or distribute the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Limitation of Liability</h2>
            <p>Sovereign Matrix is provided &quot;as-is&quot; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability is limited to the amount you paid in the last 12 months.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Governing Law</h2>
            <p>These terms are governed by the laws of the Republic of South Africa. Any disputes will be resolved in the courts of the Western Cape.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:support@sovereignmatrix.agency" className="text-[#00B7FF] hover:underline">support@sovereignmatrix.agency</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

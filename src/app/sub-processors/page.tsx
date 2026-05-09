import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * /sub-processors — public list of every third party that touches
 * customer data. Required disclosure for any B2B customer doing
 * GDPR / POPIA / SOC2 due diligence.
 *
 * Server-rendered, indexable. Update this page (and notify enterprise
 * customers via the email on file) before adding a new sub-processor
 * to the production environment.
 */

export const metadata: Metadata = {
  title: "Sub-processors | Sovereign Matrix",
  description:
    "Third parties that process customer data on behalf of Sovereign Matrix — required disclosure for GDPR / POPIA / SOC2 due diligence.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/sub-processors",
  },
};

interface SubProcessor {
  name: string;
  category:
    | "infra"
    | "auth"
    | "ai-model"
    | "payments"
    | "comms"
    | "research"
    | "monitoring"
    | "analytics";
  purpose: string;
  dataTransferred: string;
  region: string;
  url: string;
  /** True if a customer can opt out without losing core functionality. */
  optional: boolean;
}

const SUB_PROCESSORS: SubProcessor[] = [
  // Core infrastructure
  {
    name: "Vercel",
    category: "infra",
    purpose: "Application hosting, edge runtime, CDN",
    dataTransferred:
      "Request payloads and IP addresses while routing customer traffic",
    region: "Global edge · primary US-east",
    url: "https://vercel.com/legal/dpa",
    optional: false,
  },
  {
    name: "Neon",
    category: "infra",
    purpose: "Managed PostgreSQL — primary data store",
    dataTransferred:
      "Tenant data, accounts, packets, audit logs, payments, all tables in src/db/schema.ts",
    region: "AWS us-east-2 (configurable per project)",
    url: "https://neon.tech/dpa",
    optional: false,
  },
  {
    name: "Upstash",
    category: "infra",
    purpose: "Distributed rate limiting (Redis)",
    dataTransferred: "Rate-limit keys (IP / user-id hashes), no payloads",
    region: "Global",
    url: "https://upstash.com/trust/dpa",
    optional: true,
  },

  // Auth
  {
    name: "Clerk",
    category: "auth",
    purpose: "Authentication, session management, organization membership",
    dataTransferred:
      "Email, name, OAuth profile fields, IP at sign-in, MFA factors",
    region: "AWS us-east-1 with EU residency option",
    url: "https://clerk.com/legal/dpa",
    optional: false,
  },

  // AI providers (any one is sufficient — the platform routes across them)
  {
    name: "Anthropic",
    category: "ai-model",
    purpose: "Claude model inference (when the routing layer selects it)",
    dataTransferred:
      "Prompt + completion text only, retained by Anthropic for 30 days for trust-and-safety review per their policy",
    region: "US",
    url: "https://www.anthropic.com/legal/dpa",
    optional: true,
  },
  {
    name: "Google (Gemini)",
    category: "ai-model",
    purpose: "Gemini model inference",
    dataTransferred: "Prompt + completion text",
    region: "US (configurable to EU)",
    url: "https://ai.google.dev/gemini-api/terms",
    optional: true,
  },
  {
    name: "NVIDIA NIM",
    category: "ai-model",
    purpose: "Open-source model inference (default routing)",
    dataTransferred: "Prompt + completion text",
    region: "US",
    url: "https://www.nvidia.com/en-us/data-center/cloud-services/nim/",
    optional: true,
  },
  {
    name: "Cerebras",
    category: "ai-model",
    purpose: "Ultra-fast inference for latency-sensitive runs",
    dataTransferred: "Prompt + completion text",
    region: "US",
    url: "https://www.cerebras.net/",
    optional: true,
  },
  {
    name: "Groq",
    category: "ai-model",
    purpose: "Fast-inference fallback",
    dataTransferred: "Prompt + completion text",
    region: "US",
    url: "https://groq.com/",
    optional: true,
  },
  {
    name: "DeepSeek",
    category: "ai-model",
    purpose: "Reasoning model option in the routing layer",
    dataTransferred: "Prompt + completion text",
    region: "Routed via NIM (US); not direct",
    url: "https://www.deepseek.com/",
    optional: true,
  },
  {
    name: "Black Forest Labs (FLUX)",
    category: "ai-model",
    purpose: "Image generation in image-gen agent",
    dataTransferred: "Image prompt text",
    region: "EU",
    url: "https://blackforestlabs.ai/",
    optional: true,
  },

  // Payments
  {
    name: "Stripe",
    category: "payments",
    purpose: "Card processing, subscription management, invoicing",
    dataTransferred:
      "Email, billing address, last 4 of card (we never see full PAN), subscription metadata",
    region: "Global, EU residency available",
    url: "https://stripe.com/legal/dpa",
    optional: false,
  },
  {
    name: "PayFast",
    category: "payments",
    purpose: "ZAR card processing for South African customers",
    dataTransferred: "Email, billing address, transaction metadata",
    region: "South Africa",
    url: "https://www.payfast.co.za/about",
    optional: true,
  },
  {
    name: "Yoco",
    category: "payments",
    purpose: "Alternative ZAR processor",
    dataTransferred: "Email, billing address, transaction metadata",
    region: "South Africa",
    url: "https://www.yoco.com/za/legal/",
    optional: true,
  },
  {
    name: "Paystack",
    category: "payments",
    purpose: "African multi-currency processor (NGN, KES, GHS)",
    dataTransferred: "Email, billing address, transaction metadata",
    region: "Nigeria, Kenya, Ghana, South Africa",
    url: "https://paystack.com/terms",
    optional: true,
  },

  // Communications
  {
    name: "Resend",
    category: "comms",
    purpose: "Transactional email (welcome, alerts, packet completion)",
    dataTransferred: "Recipient email + email body",
    region: "US, EU residency available",
    url: "https://resend.com/legal/dpa",
    optional: true,
  },
  {
    name: "Twilio",
    category: "comms",
    purpose:
      "Outbound SMS, voice (when voice agent fires), WhatsApp via Sandbox",
    dataTransferred: "Recipient phone, message text, call metadata",
    region: "US",
    url: "https://www.twilio.com/legal/dpa",
    optional: true,
  },
  {
    name: "ElevenLabs",
    category: "comms",
    purpose: "Voice synthesis when voice-agent paths fire",
    dataTransferred: "Text to be synthesized",
    region: "US",
    url: "https://elevenlabs.io/dpa",
    optional: true,
  },
  {
    name: "Telegram",
    category: "comms",
    purpose: "Operator alerts to commander channel (optional)",
    dataTransferred: "Operator-set messages, not customer data",
    region: "Global",
    url: "https://telegram.org/privacy",
    optional: true,
  },

  // Research
  {
    name: "Tavily",
    category: "research",
    purpose: "Live web search for blog-gen + competitor agents (research_ai)",
    dataTransferred: "Search query, no customer data",
    region: "US",
    url: "https://tavily.com/privacy",
    optional: true,
  },
  {
    name: "Firecrawl",
    category: "research",
    purpose: "Web crawling for research-heavy agents (when configured)",
    dataTransferred: "Target URL only",
    region: "US",
    url: "https://www.firecrawl.dev/privacy",
    optional: true,
  },

  // CRM (only fires if customer connects)
  {
    name: "HubSpot",
    category: "comms",
    purpose:
      "CRM webhook automation — fires only when customer connects HubSpot",
    dataTransferred: "Deal events the customer sends us",
    region: "US, EU residency available",
    url: "https://www.hubspot.com/data-privacy/dpa",
    optional: true,
  },

  // Monitoring
  {
    name: "Sentry",
    category: "monitoring",
    purpose: "Error tracking, performance monitoring",
    dataTransferred:
      "Error stack traces, request metadata. Configured to scrub PII before send.",
    region: "US, EU residency available",
    url: "https://sentry.io/legal/dpa",
    optional: true,
  },

  // Analytics
  {
    name: "Plausible",
    category: "analytics",
    purpose: "Privacy-friendly analytics (no cookies, no fingerprinting)",
    dataTransferred:
      "Page-view URL, referrer domain, country (from IP, then discarded)",
    region: "EU (Germany)",
    url: "https://plausible.io/dpa",
    optional: true,
  },
];

const CATEGORY_LABEL: Record<SubProcessor["category"], string> = {
  infra: "Infrastructure",
  auth: "Authentication",
  "ai-model": "AI model providers",
  payments: "Payments",
  comms: "Communications",
  research: "Research / web data",
  monitoring: "Monitoring",
  analytics: "Analytics",
};

const CATEGORY_ORDER: SubProcessor["category"][] = [
  "infra",
  "auth",
  "ai-model",
  "payments",
  "comms",
  "research",
  "monitoring",
  "analytics",
];

export default function SubProcessorsPage() {
  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/privacy"
          className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
        >
          Privacy policy →
        </Link>
      </nav>

      <article className="max-w-4xl mx-auto px-6 md:px-10 pt-16 pb-24">
        <header className="mb-12">
          <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-3">
            Disclosure · last updated May 2026
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
            Sub-processors
          </h1>
          <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
            Third parties that process customer data on behalf of Sovereign
            Matrix. Required disclosure for GDPR, POPIA, and SOC2 due diligence.
            We update this page (and notify enterprise customers via the email
            on file) at least 30 days before any addition or material change.
          </p>
        </header>

        {CATEGORY_ORDER.map((cat) => {
          const items = SUB_PROCESSORS.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="mb-12">
              <h2 className="text-[11px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-5">
                {CATEGORY_LABEL[cat]} · {items.length}
              </h2>
              <ul className="space-y-3">
                {items.map((p) => (
                  <li
                    key={p.name}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-3">
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-[15px] font-semibold text-white">
                          {p.name}
                        </h3>
                        {p.optional ? (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300/90">
                            Optional
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/[0.04] text-amber-300/90">
                            Core dependency
                          </span>
                        )}
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-neutral-400 hover:text-white underline decoration-white/15 hover:decoration-white/40"
                      >
                        DPA / privacy →
                      </a>
                    </div>
                    <dl className="text-[13px] space-y-1.5">
                      <div className="flex items-baseline gap-3">
                        <dt className="text-neutral-500 font-mono text-[11px] uppercase tracking-wider w-32 shrink-0">
                          Purpose
                        </dt>
                        <dd className="text-neutral-200 leading-relaxed">
                          {p.purpose}
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <dt className="text-neutral-500 font-mono text-[11px] uppercase tracking-wider w-32 shrink-0">
                          Data
                        </dt>
                        <dd className="text-neutral-300 leading-relaxed">
                          {p.dataTransferred}
                        </dd>
                      </div>
                      <div className="flex items-baseline gap-3">
                        <dt className="text-neutral-500 font-mono text-[11px] uppercase tracking-wider w-32 shrink-0">
                          Region
                        </dt>
                        <dd className="text-neutral-300 font-mono text-[12px]">
                          {p.region}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 md:p-8 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">
            What you can opt out of
          </h2>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-4">
            Sub-processors marked &ldquo;Optional&rdquo; can be disabled for
            your tenant on request. Core dependencies (Vercel, Neon, Clerk,
            Stripe) cannot — they back the platform&apos;s primary functions and
            disabling them would prevent us from delivering the service.
          </p>
          <p className="text-[14px] text-neutral-400 leading-relaxed">
            Email{" "}
            <a
              href="mailto:privacy@sovereignmatrix.agency"
              className="text-white underline decoration-white/30 hover:decoration-white/60"
            >
              privacy@sovereignmatrix.agency
            </a>{" "}
            with your tenant ID and the sub-processors you want disabled.
          </p>
        </section>

        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.03] p-6 md:p-8 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">
            How we notify you of changes
          </h2>
          <ul className="text-[14px] text-neutral-300 leading-relaxed space-y-2">
            <li>
              <strong className="text-white">Adding a sub-processor:</strong> we
              update this page and email enterprise customers at least 30 days
              before the new processor goes live.
            </li>
            <li>
              <strong className="text-white">Removing a sub-processor:</strong>{" "}
              we update this page on the day of removal. No advance notice
              required.
            </li>
            <li>
              <strong className="text-white">Material change in scope:</strong>{" "}
              treated the same as &ldquo;adding a sub-processor.&rdquo;
            </li>
          </ul>
        </section>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" />
            Home
          </Link>
        </div>
      </article>
    </main>
  );
}

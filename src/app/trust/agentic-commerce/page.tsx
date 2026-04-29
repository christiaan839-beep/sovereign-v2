import type { Metadata } from "next";
import { AcatLiveVerifier } from "./AcatLiveVerifier";

export const metadata: Metadata = {
  title: "Agentic Commerce — Sovereign Matrix",
  description:
    "The cryptographic trust layer for agent-initiated commerce. Verify any ACAT (Agentic Commerce Authorization Token) offline with @sovereign/inspector. Composes with Stripe, Visa, Mastercard, Shopify, Amazon.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/agentic-commerce",
  },
  openGraph: {
    title: "Agentic Commerce — Sovereign Matrix",
    description:
      "Court-defensible authorization for agent-initiated purchases. Live verifier, open inspector, rails-agnostic.",
    url: "https://sovereignmatrix.agency/trust/agentic-commerce",
    type: "website",
  },
};

/**
 * /trust/agentic-commerce — public live-verifier + procurement page.
 *
 * Audience: CFO, CISO, Head of Payments, Procurement, sometimes a
 * skeptical engineer auditing the cryptography.
 *
 * Aesthetic: editorial museum (matches /trust + /trust/defenders +
 * /trust/audit). Cream paper #F4EFE6, dark ink #1A1712, serif body
 * for long-form authority + sans-serif for code/labels.
 *
 * The live verifier hits POST /api/health/acat-verify which is the
 * SAME pure function shipped in @sovereign/inspector. Buyers can
 * verify via this UI, via the npm package, or by porting the math
 * to their own language. The math is the truth.
 */

const TRUST_QUESTIONS = [
  {
    n: 1,
    q: "Who is the user?",
    answer: "Cryptographic identity (Ed25519 user keypair).",
    primitive: "R34 CADC",
    status: "shipped",
  },
  {
    n: 2,
    q: "Who is the agent?",
    answer: "Identity manifest signed by the deployment.",
    primitive: "R38 KYA",
    status: "shipped",
  },
  {
    n: 3,
    q: "Did the user actually authorize this agent?",
    answer: "Ed25519-signed delegation (capability token).",
    primitive: "R37 ACT",
    status: "shipped",
  },
  {
    n: 4,
    q: "What were they authorized to spend?",
    answer:
      "Bounded ACAT scope: amount, merchant allowlist, MCC categories, expiry, optional single-use nonce.",
    primitive: "R91 ACAT",
    status: "shipped",
  },
  {
    n: 5,
    q: "Was the agent in good standing?",
    answer: "Letter-grade reputation snapshot embedded in the ACAT.",
    primitive: "R40 reputation",
    status: "shipped",
  },
  {
    n: 6,
    q: "Did they cover the loss?",
    answer:
      "Optional insurance binding (Lloyd's syndicate, MGA, or carrier reference).",
    primitive: "R46 insurance",
    status: "shipped",
  },
  {
    n: 7,
    q: "Can a third party verify all of this OFFLINE without us?",
    answer:
      "Yes. @sovereign/inspector ports the entire verifier to a 200-LOC npm package. No Sovereign network call needed.",
    primitive: "R36 inspector",
    status: "shipped",
  },
] as const;

const MARKET_EVENTS = [
  {
    date: "May 2024",
    actor: "Stripe",
    event: "Agentic Commerce Toolkit launched",
    note: "Agent SDK + agent-friendly checkout. No verification primitive.",
  },
  {
    date: "Sept 2024",
    actor: "Anthropic",
    event: "Computer Use",
    note: "Agent operating GUI, including checkout flows.",
  },
  {
    date: "Jan 2025",
    actor: "OpenAI",
    event: "Operator",
    note: "Agent that books, buys, and submits forms.",
  },
  {
    date: "April 2025",
    actor: "Visa",
    event: "Visa Intelligent Commerce",
    note: "Agent-initiated payment rail. Issuer's risk model only.",
  },
  {
    date: "Q1 2025",
    actor: "Mastercard",
    event: "Agent Pay (with Microsoft)",
    note: "Existing 3DS rails. No cryptographic delegation primitive.",
  },
  {
    date: "Q1 2025",
    actor: "Amazon",
    event: '"Buy for Me"',
    note: "In-app agent shopping. Internal trust assumptions only.",
  },
  {
    date: "April 2026",
    actor: "Sovereign",
    event: "ACAT (R91) + Stripe Adapter (R92)",
    note: "Cryptographic trust substrate. Offline verifier. Court-defensible.",
  },
] as const;

const INTEGRATION_CODE = {
  curl: `# Verify any ACAT live (replace base64-encoded acat + cart context)
curl -X POST https://sovereignmatrix.agency/api/health/acat-verify \\
  -H 'content-type: application/json' \\
  -d '{
    "acat": "<base64url-canonical-JSON-or-object>",
    "expectedUserPublicKey": "<base64url Ed25519 pubkey>",
    "cart": {
      "amountCents": 7342,
      "currency": "USD",
      "merchantId": "acme-shop",
      "category": "marketplace_b2c"
    }
  }'`,
  npm: `# Install the offline verifier
npm install -g @sovereign/inspector

# Verify locally — zero Sovereign network call
echo "<base64url ACAT>" | sovereign-inspect verify-acat \\
  --pubkey "<expectedUserPublicKey>" \\
  --amount 7342 \\
  --currency USD \\
  --merchant acme-shop \\
  --category marketplace_b2c`,
  stripe: `// In your Stripe webhook handler — already verified the signature
// with stripe.webhooks.constructEvent(...)
import { verifyACAT, decodeACATFromHeader } from "@sovereign/inspector/acat";

const pi = event.data.object;
const tokenB64 = pi.metadata.sovereign_acat_chunked === "1"
  ? Array.from({ length: Number(pi.metadata.sovereign_acat_parts) },
      (_, i) => pi.metadata[\`sovereign_acat_part_\${i + 1}\`]).join("")
  : pi.metadata.sovereign_acat;

const result = verifyACAT({
  token: decodeACATFromHeader(tokenB64),
  expectedUserPublicKey: lookupUserPubkey(pi.metadata.sovereign_user_id),
  cart: {
    amountCents: pi.amount,
    currency: pi.currency.toUpperCase(),
    merchantId: pi.transfer_data?.destination ?? "self",
    category: "marketplace_b2c",
  },
});

if (!result.valid) {
  await refundAndAlert(pi.id, \`acat-invalid:\${result.reason}\`);
}`,
} as const;

export default function AgenticCommercePage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="mx-auto max-w-5xl">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="mb-20 lg:mb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sovereign Trust · Round 91 · Round 92
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight lg:text-7xl">
            The trust layer
            <br />
            <span className="italic text-[#5A4F3F]">for agentic commerce.</span>
          </h1>
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Stripe, Visa, Mastercard, Amazon, Shopify, and Klarna are
            racing to support agent-initiated purchases.{" "}
            <em>None of them ship the cryptographic substrate</em> that
            lets a seller verify, OFFLINE, that an agent is actually
            authorized to spend on a user&apos;s behalf.
          </p>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Sovereign does. We are not competing with the rails. We are
            the verifier they will need to be trustworthy in court.
          </p>
        </header>

        {/* ─── Live verifier ───────────────────────────────────────── */}
        <section className="mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live · zero round-trip · 12 verifier reasons
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Verify any ACAT in this browser.
          </h2>
          <p className="mt-3 max-w-2xl font-serif text-lg text-[#3A3128]">
            Paste a base64url-encoded ACAT or a JSON SignedACAT.
            Provide the expected user public key and a cart context.
            The verifier returns a verdict + one of 12 distinct
            failure reasons. Same pure function as{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              @sovereign/inspector
            </code>
            .
          </p>
          <div className="mt-10">
            <AcatLiveVerifier />
          </div>
        </section>

        {/* ─── 7 trust questions ───────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            The seven trust questions
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Every question a court will ask. Every answer{" "}
            <em>cryptographically verifiable.</em>
          </h2>
          <div className="mt-12 grid gap-px bg-[#D8CFBE] lg:grid-cols-1">
            {TRUST_QUESTIONS.map((tq) => (
              <article
                key={tq.n}
                className="bg-[#F4EFE6] px-6 py-8 lg:px-10 lg:py-10"
              >
                <div className="flex items-baseline gap-6">
                  <span className="font-mono text-2xl font-light text-[#5A4F3F]">
                    0{tq.n}
                  </span>
                  <h3 className="font-serif text-2xl tracking-tight">
                    {tq.q}
                  </h3>
                  <span className="ml-auto font-mono text-xs uppercase tracking-[0.14em] text-emerald-700">
                    ✓ {tq.status}
                  </span>
                </div>
                <p className="mt-4 max-w-3xl pl-12 font-serif text-lg leading-relaxed text-[#3A3128]">
                  {tq.answer}
                </p>
                <p className="mt-3 pl-12 font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                  Primitive: {tq.primitive}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Market timeline ─────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Market reality
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Every payments network shipped <em>rails.</em>
            <br />
            None shipped the trust math.
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {MARKET_EVENTS.map((e) => (
              <li
                key={`${e.actor}-${e.event}`}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <p className="font-mono text-sm uppercase tracking-[0.12em] text-[#5A4F3F] lg:col-span-2">
                  {e.date}
                </p>
                <p className="font-serif text-xl font-medium tracking-tight lg:col-span-3">
                  {e.actor}
                </p>
                <div className="lg:col-span-7">
                  <p className="font-serif text-lg">{e.event}</p>
                  <p className="mt-1 font-serif text-base text-[#5A4F3F]">
                    {e.note}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Integration ─────────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Integration · 3 paths · all offline
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Pick how to verify. <em>The math is the same.</em>
          </h2>
          <div className="mt-12 space-y-12">
            <div>
              <h3 className="font-serif text-xl tracking-tight">
                1 · curl the live verifier
              </h3>
              <p className="mt-2 max-w-2xl font-serif text-base text-[#3A3128]">
                Use this from anywhere. Stateless, no auth required.
              </p>
              <pre className="mt-4 overflow-x-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-5 font-mono text-sm leading-relaxed text-[#F4EFE6]">
                {INTEGRATION_CODE.curl}
              </pre>
            </div>
            <div>
              <h3 className="font-serif text-xl tracking-tight">
                2 · install @sovereign/inspector and verify locally
              </h3>
              <p className="mt-2 max-w-2xl font-serif text-base text-[#3A3128]">
                MIT-licensed. ~200 LOC. Zero Sovereign runtime
                dependency. Auditable.
              </p>
              <pre className="mt-4 overflow-x-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-5 font-mono text-sm leading-relaxed text-[#F4EFE6]">
                {INTEGRATION_CODE.npm}
              </pre>
            </div>
            <div>
              <h3 className="font-serif text-xl tracking-tight">
                3 · drop into your Stripe webhook handler
              </h3>
              <p className="mt-2 max-w-2xl font-serif text-base text-[#3A3128]">
                Verify ACAT BEFORE charging. Refund + alert if invalid.
                Court-defensible chargeback evidence is automatic.
              </p>
              <pre className="mt-4 overflow-x-auto rounded border border-[#D8CFBE] bg-[#1A1712] p-5 font-mono text-sm leading-relaxed text-[#F4EFE6]">
                {INTEGRATION_CODE.stripe}
              </pre>
            </div>
          </div>
        </section>

        {/* ─── Procurement story ──────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            For your CFO + CISO + Procurement
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>You don&apos;t trust Sovereign.</em>
            <br />
            You verify the math.
          </h2>
          <div className="mt-10 max-w-3xl space-y-6 font-serif text-lg leading-relaxed text-[#3A3128]">
            <p>
              Every agent-initiated purchase requires a Sovereign ACAT
              — a cryptographically signed, time-bounded, scope-bounded
              delegation issued by the user&apos;s Ed25519 key.
            </p>
            <p>
              The token is verified offline by the seller using{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                @sovereign/inspector
              </code>
              . The seller doesn&apos;t trust us — they verify the
              math. If the agent tries to buy outside scope, the
              verifier returns one of 12 distinct failure reasons,
              which are written to the user&apos;s hash-chained R26
              audit log and exportable as procurement-ready receipts.
            </p>
            <p>
              For chargeback disputes, the merchant uploads a
              self-contained evidence packet: the ACAT, the audit
              chain excerpt, and the verification result at
              evidence-assembly time. Any auditor or court can re-run
              the verification offline. <em>No backdating possible.</em>
            </p>
            <p>
              Reputation snapshot is embedded — sellers can refuse
              low-reputation agents at the door without contacting
              Sovereign. We are not the bottleneck; we are the trust
              math.
            </p>
          </div>
        </section>

        {/* ─── Roadmap ─────────────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            What ships next
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Rails adapters for every payments network.
          </h2>
          <ul className="mt-10 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {[
              ["R92", "Stripe Agentic Commerce Toolkit adapter", "shipped today"],
              ["R93", "Visa Intelligent Commerce adapter", "queued"],
              ["R94", "Mastercard Agent Pay adapter", "queued"],
              ["R95", "Shopify Agent-Checkout adapter", "queued"],
              ["R96", "Amazon \"Buy for Me\" adapter", "queued"],
              ["R97", "Klarna agent-payment adapter", "queued"],
              ["R98", "Walmart Marketplace agent adapter", "queued"],
            ].map(([id, label, status]) => (
              <li
                key={id}
                className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-12"
              >
                <p className="font-mono text-sm uppercase tracking-[0.12em] text-[#5A4F3F] lg:col-span-1">
                  {id}
                </p>
                <p className="font-serif text-lg lg:col-span-9">{label}</p>
                <p
                  className={`font-mono text-xs uppercase tracking-[0.14em] lg:col-span-2 ${
                    status === "shipped today"
                      ? "text-emerald-700"
                      : "text-[#5A4F3F]"
                  }`}
                >
                  {status}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Footer / Sources ────────────────────────────────────── */}
        <footer className="border-t border-[#D8CFBE] pt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sources you can verify
          </p>
          <ul className="mt-6 space-y-2 font-serif text-base text-[#3A3128]">
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/agentic-commerce/acat.ts
              </code>{" "}
              — R91 ACAT primitive (mint, verify, attenuate).
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/agentic-commerce/stripe-adapter.ts
              </code>{" "}
              — R92 Stripe Agentic Commerce Toolkit adapter.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                packages/inspector/src/acat.mjs
              </code>{" "}
              — Pure-JS port for offline verification.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                docs/AGENTIC-COMMERCE-LEADERSHIP.md
              </code>{" "}
              — Full strategic positioning doc.
            </li>
            <li>
              Macaroon attenuation paper: Birgisson et al., NDSS 2014.
            </li>
            <li>
              Procurement questions:{" "}
              <a
                href="mailto:christiaan@sovereignmatrix.agency"
                className="underline decoration-[#5A4F3F] underline-offset-4"
              >
                christiaan@sovereignmatrix.agency
              </a>
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}

import Link from "next/link";

/**
 * /trust — the unified security + compliance + data-handling page.
 *
 * Editorial Museum aesthetic to match /built-with-claude and /roi.
 * The content is deliberately honest: we state what we do, what we
 * don't do yet, and the date we expect to close the gap. No
 * fabricated certification badges.
 *
 * Reviewed for accuracy against src/lib/* + drizzle/* + sentry.*
 * on April 19, 2026.
 */

const PILLARS = [
  {
    n: "01",
    title: "Tenant isolation by default",
    body:
      "Every tenant-scoped table (subscriptions, usage, playbook runs, integrations) runs under Postgres Row-Level Security. Application code sets app.current_user_id at the start of each request; the database itself refuses to return another tenant's rows even if the application-layer filter is forgotten.",
    ref: "drizzle/0005_row_level_security.sql · src/db/with-tenant.ts",
  },
  {
    n: "02",
    title: "Five-layer safety on every agent call",
    body:
      "Every agent invocation passes through jailbreak detection, PII scanning, content policy, quality scoring, and a Claude-powered critic gate before the result reaches you. The pipeline runs in parallel in the common path, sequentially when a gate flags. Failures are logged with tenant scope.",
    ref: "src/lib/output-verifier.ts",
  },
  {
    n: "03",
    title: "BYOK with passphrase-derived encryption",
    body:
      "You can bring your own API keys for Claude, Gemini, NVIDIA NIM, Groq, and Tavily. Keys are encrypted in your browser with a key derived via PBKDF2-SHA256 (210,000 iterations — OWASP 2023) from a passphrase you enter. Sovereign operators never see the passphrase.",
    ref: "src/lib/byok-crypto.ts",
  },
  {
    n: "04",
    title: "Auth at the edge",
    body:
      "Dashboard access is protected at the Vercel edge by Clerk. Cron jobs and the Stripe webhook authorize via timing-safe shared-secret comparisons — CRON_SECRET, STRIPE_WEBHOOK_SECRET, and X-Sovereign-Internal-Secret are all compared with crypto.timingSafeEqual, never with == ===.",
    ref: "src/proxy.ts · src/lib/cron-auth.ts · src/lib/agent-factory.ts",
  },
  {
    n: "05",
    title: "Observability without leakage",
    body:
      "Production errors go to Sentry with a two-layer PII scrubber: request headers (Authorization, cookies, api-key) are stripped at the transport layer, and log-payload data objects are scrubbed for secret-shaped keys (api_key, token, password, bearer, dsn) before emission. Release-tagged to git SHA for regression tracing.",
    ref: "sentry.server.config.ts · src/lib/logger.ts",
  },
  {
    n: "06",
    title: "Stripe idempotency",
    body:
      "Payment webhooks use a two-state dedup (received → completed) with a 5-minute stale window. A crashed handler can't silently drop a legitimate payment event on retry; the next delivery picks up exactly where the previous attempt failed.",
    ref: "src/db/schema.ts:stripeEvents · src/app/api/_payments/stripe/webhook/route.ts",
  },
  {
    n: "07",
    title: "Rate limits and circuit breakers",
    body:
      "Distributed rate limits via Upstash Redis (100 req/min per user; three buckets for the free tool). Circuit breakers on all six upstream providers (NVIDIA NIM, Anthropic, Google, Groq, Stripe, Resend) — five consecutive failures open the breaker for 60 seconds, protecting both us and the provider from cascading failures.",
    ref: "src/proxy.ts · src/lib/circuit-breaker.ts",
  },
  {
    n: "08",
    title: "Crypto-safe random everywhere",
    body:
      "Session identifiers, referral codes, memory IDs, A/B cohorts, and OAuth state nonces all use crypto.randomUUID or crypto.getRandomValues. Math.random is banned from security-adjacent code paths; the slop-hunter agent enforces this on every commit.",
    ref: ".claude/plugins/sovereign-slop-hunter/agents/slop-hunter.md",
  },
] as const;

const HONEST_LIMITS = [
  {
    label: "SOC 2 Type II",
    status: "In progress",
    note: "Policies documented, auditor engagement targeted H2 2026. We will publish the report when complete — no badge until then.",
  },
  {
    label: "ISO 27001",
    status: "Not yet",
    note: "On the roadmap after SOC 2. No ISO badge on the site until certification is issued.",
  },
  {
    label: "HIPAA",
    status: "Not supported",
    note: "The platform is not HIPAA-configured. Do not use agents to process PHI. If HIPAA support matters, contact us — we will not pretend we have it.",
  },
  {
    label: "GDPR / CCPA",
    status: "Supported",
    note: "Data export on request (christiaan@sovereignmatrix.agency). Account deletion available from dashboard settings. Data Processing Agreement available for enterprise customers.",
  },
  {
    label: "PCI DSS",
    status: "Out of scope",
    note: "We never handle card data. Stripe Checkout collects payment info directly from the customer's browser; we receive only the Stripe customer ID + subscription ID.",
  },
] as const;

const DATA_HANDLING = [
  {
    q: "What data do you store?",
    a: "Your Clerk account (email, name), your playbook runs (prompts, outputs), your usage counts, your BYOK API keys (encrypted), your Stripe subscription id, and any OAuth connections you've authorized (Slack, Gmail, etc).",
  },
  {
    q: "Where is the data hosted?",
    a: "Neon Postgres (US/EU regional options on enterprise). Upstash Redis for rate limits. Vercel for edge compute. Clerk for auth. All SOC 2 Type II compliant.",
  },
  {
    q: "Who can see my agent outputs?",
    a: "You, and the model providers we route to for that specific call. Row-Level Security prevents Sovereign operators from reading your tenant data unless you explicitly request debugging help (which we'd do with your session).",
  },
  {
    q: "Do you train on my data?",
    a: "No. We don't train models. Your prompts and outputs are routed to the upstream providers (Anthropic, NVIDIA, Google, etc.) whose own retention policies apply. Anthropic's API default is zero-retention for API inputs as of April 2026 — check Anthropic's current policy for the definitive answer.",
  },
  {
    q: "How long do you retain logs?",
    a: "Agent execution logs are retained for 90 days for support and audit. After 90 days they're purged automatically. Usage metering rows are retained for 18 months (billing reconciliation). You can request earlier deletion.",
  },
  {
    q: "Can I delete my account?",
    a: "Yes. Settings → Account → Delete. This removes your Clerk profile, all playbook runs, all usage rows, all OAuth tokens, and all BYOK keys within 72 hours. Some data may persist longer in encrypted backups (max 30 days).",
  },
] as const;

const RESPONSIBLE_USE = [
  "AI voice calls must disclose they are AI-generated at the start of the call. The voice-closer agent enforces this in its prompt; you may not override it.",
  "Do-Not-Call list checks are the customer's responsibility — we don't ship a DNC database but we integrate with any you provide via the Do-Not-Contact list you upload.",
  "CAN-SPAM: outbound email agents include a one-click unsubscribe link by default. Disabling it requires a contract amendment and audit review.",
  "The platform is not intended for processing protected health information (PHI) under HIPAA, financial account numbers under GLBA, or children's data under COPPA.",
  "Jailbreak and prompt-injection attempts are logged and rate-limited; repeated abuse may result in account suspension.",
] as const;

export default function TrustPage() {
  return (
    <div className="editorial-light min-h-screen">
      <div className="ed-page py-12 md:py-20">
        <div className="ed-max">

          {/* Masthead */}
          <div className="flex items-baseline justify-between mb-10 ed-fade-in">
            <Link href="/" className="ed-label hover:ed-copper transition-colors">
              ← Sovereign Matrix
            </Link>
            <p className="ed-caption">Trust Report · April 2026</p>
          </div>

          {/* Title */}
          <header className="ed-grid-12 mb-16">
            <div className="col-span-12 md:col-span-9">
              <p className="ed-label mb-6 ed-enter ed-d-1">Security · Compliance · Data handling</p>
              <h1
                className="ed-display ed-enter ed-d-2"
                style={{
                  fontSize: "clamp(48px, 9vw, 116px)",
                  lineHeight: 0.88,
                  letterSpacing: "-0.025em",
                }}
              >
                What we guard,{" "}
                <em className="ed-display-italic ed-copper">plainly</em> stated.
              </h1>
            </div>
            <aside
              className="col-span-12 md:col-span-3 md:pl-6 md:border-l mt-10 md:mt-0 pt-4 md:pt-2 ed-enter ed-d-3"
              style={{ borderColor: "var(--ed-rule)" }}
            >
              <p className="ed-label mb-4">Principle</p>
              <p className="ed-body text-[15px]" style={{ color: "var(--ed-ink)" }}>
                We say exactly what we do. Where a standard asks us for a badge we haven&apos;t earned, we say so. No lies of omission.
              </p>
            </aside>
          </header>

          {/* Dek */}
          <div className="ed-grid-12 mb-20">
            <div className="col-span-12 md:col-span-8 md:col-start-2 ed-enter ed-d-4">
              <p
                className="ed-display"
                style={{
                  fontSize: "clamp(22px, 2.6vw, 32px)",
                  lineHeight: 1.3,
                  color: "var(--ed-ink-soft)",
                }}
              >
                Every product page has a trust section. Most are{" "}
                <em className="ed-display-italic ed-copper">decoration</em>. This page lists the
                actual code paths, the actual compliance state, and the limits we genuinely
                have — so you can audit us without asking.
              </p>
            </div>
          </div>

          {/* Pillars */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter I</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(36px, 4.5vw, 60px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Eight pillars, each wired into code.
                </h2>
              </div>
            </div>

            <div>
              {PILLARS.map((p) => (
                <article
                  key={p.n}
                  className="ed-grid-12 py-8 border-t"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <div className="col-span-12 md:col-span-2">
                    <p className="ed-mono text-[11px] ed-copper">{p.n}</p>
                  </div>
                  <div className="col-span-12 md:col-span-7">
                    <h3
                      className="ed-display text-[24px] md:text-[28px]"
                      style={{ lineHeight: 1.1 }}
                    >
                      {p.title}
                    </h3>
                    <p className="ed-body text-[15px] mt-3" style={{ color: "var(--ed-ink-soft)" }}>
                      {p.body}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-3 md:text-right mt-3 md:mt-1">
                    <p className="ed-mono text-[10px]" style={{ color: "var(--ed-ink-dim)" }}>
                      Evidence
                    </p>
                    <p
                      className="ed-mono text-[11px] mt-1"
                      style={{ color: "var(--ed-ink-soft)", wordBreak: "break-all" }}
                    >
                      {p.ref}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Compliance status */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter II</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(36px, 4.5vw, 60px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Compliance — <em className="ed-display-italic">honest</em> status.
                </h2>
              </div>
            </div>

            <div
              className="border-t"
              style={{ borderColor: "var(--ed-rule-soft)" }}
            >
              {HONEST_LIMITS.map((l) => (
                <div
                  key={l.label}
                  className="ed-grid-12 py-6 border-b"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <div className="col-span-12 md:col-span-3">
                    <p className="ed-display text-[22px]" style={{ lineHeight: 1.1 }}>
                      {l.label}
                    </p>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <span
                      className="ed-mono text-[10px] px-2 py-0.5 inline-block"
                      style={{
                        background:
                          l.status === "Supported" || l.status === "Out of scope"
                            ? "var(--ed-copper-wash)"
                            : "var(--ed-rule-soft)",
                        color:
                          l.status === "Supported" || l.status === "Out of scope"
                            ? "var(--ed-copper)"
                            : "var(--ed-ink-soft)",
                      }}
                    >
                      {l.status}
                    </span>
                  </div>
                  <div className="col-span-12 md:col-span-7 mt-2 md:mt-0">
                    <p className="ed-body text-[14px]" style={{ color: "var(--ed-ink-soft)" }}>
                      {l.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pull quote */}
          <section className="my-24 ed-grid-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2">
              <div
                className="ed-mono ed-copper text-[60px] mb-4"
                style={{ lineHeight: 0.5 }}
              >
                &ldquo;
              </div>
              <blockquote
                className="ed-display-italic"
                style={{
                  fontSize: "clamp(26px, 3.5vw, 44px)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  color: "var(--ed-ink)",
                }}
              >
                A trust badge you haven&apos;t earned is worse than no badge at all.
                We will not ship logos for certifications we don&apos;t hold.
              </blockquote>
              <div className="flex items-center gap-4 mt-8">
                <div className="ed-rule w-16" style={{ background: "var(--ed-copper)" }} />
                <p className="ed-label">Policy · §1</p>
              </div>
            </div>
          </section>

          {/* Data handling Q&A */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter III</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(36px, 4.5vw, 60px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Data — the <em className="ed-display-italic">questions</em> you&apos;d actually ask.
                </h2>
              </div>
            </div>

            <div className="ed-grid-12">
              {DATA_HANDLING.map((item, i) => (
                <div
                  key={i}
                  className="col-span-12 md:col-span-6 py-6 border-t"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <p className="ed-mono text-[10px] mb-3" style={{ color: "var(--ed-ink-dim)" }}>
                    Q{String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="ed-display text-[20px]" style={{ lineHeight: 1.2 }}>
                    {item.q}
                  </p>
                  <p className="ed-body text-[14px] mt-3" style={{ color: "var(--ed-ink-soft)" }}>
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Responsible use */}
          <section
            className="mb-24 py-12 px-6 md:px-10 border-l-2"
            style={{
              borderColor: "var(--ed-copper)",
              background: "var(--ed-copper-wash)",
            }}
          >
            <p className="ed-label ed-copper mb-4">Responsible use</p>
            <p
              className="ed-display"
              style={{ fontSize: "clamp(24px, 3vw, 34px)", lineHeight: 1.25 }}
            >
              The platform supports fast, agentic work. It does{" "}
              <em className="ed-display-italic">not</em> supersede the laws of the
              jurisdictions you operate in.
            </p>
            <ul className="mt-6 space-y-3">
              {RESPONSIBLE_USE.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="ed-mono text-[11px] mt-1 flex-shrink-0 ed-copper">
                    §{i + 1}
                  </span>
                  <span
                    className="ed-body text-[14px]"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Contact */}
          <section
            className="my-24 border-y py-16 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-8 md:col-start-3 text-center">
              <p className="ed-label mb-5">Disclosure</p>
              <h2
                className="ed-display mb-8"
                style={{ fontSize: "clamp(28px, 3.5vw, 44px)", lineHeight: 1 }}
              >
                Found something we&apos;re missing?{" "}
                <em className="ed-display-italic ed-copper">Tell us.</em>
              </h2>
              <p
                className="ed-body text-[15px] max-w-xl mx-auto mb-6"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Security disclosure, compliance question, data-handling concern — any of
                these reach the founder directly, not a ticket queue.
              </p>
              <a
                href="mailto:security@sovereignmatrix.agency"
                className="ed-display-italic inline-block text-[22px] ed-copper border-b-2 pb-1"
                style={{ borderColor: "var(--ed-copper)" }}
              >
                security@sovereignmatrix.agency
              </a>
            </div>
          </section>

          {/* Colophon */}
          <footer
            className="border-t pt-8 pb-4 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-6">
              <p className="ed-label mb-3">Colophon</p>
              <p
                className="ed-body text-[13px]"
                style={{ color: "var(--ed-ink-soft)", lineHeight: 1.7 }}
              >
                Cross-referenced against src/lib/, drizzle/, and sentry.* on April 19,
                2026. Claims on this page map to specific file:line evidence; if you
                can&apos;t verify one, email the address above — we&apos;ll correct the
                page before disputing the question.
              </p>
            </div>
            <div className="col-span-12 md:col-span-6 md:text-right mt-8 md:mt-0">
              <p className="ed-caption">Sovereign Matrix · Cape Town · 2026</p>
              <p className="ed-caption mt-1">
                <Link href="/privacy" className="hover:ed-copper">Privacy</Link>
                {" · "}
                <Link href="/terms" className="hover:ed-copper">Terms</Link>
                {" · "}
                <Link href="/dpa" className="hover:ed-copper">DPA</Link>
                {" · "}
                <Link href="/sla" className="hover:ed-copper">SLA</Link>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

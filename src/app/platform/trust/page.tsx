/**
 * /platform/trust — enterprise-procurement trust surface.
 *
 * Companion to /platform/status. Where /trust is an editorial
 * overview of our philosophy and roadmap, this page answers the
 * exact questions on a vendor-security questionnaire:
 *
 *   - What data do you collect, where does it live, how is it encrypted?
 *   - Which AI providers see our data?
 *   - Who inside your company can access it?
 *   - What's the safety architecture?
 *   - Retention + deletion policies?
 *   - Incident response SLAs?
 *   - Subprocessors list?
 *   - Compliance roadmap?
 *
 * Every claim references a real code path or operational fact.
 * No fabricated certification badges.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Platform trust — Sovereign Matrix",
  description:
    "Data handling, access controls, AI provider disclosure, safety pipeline, retention, incident response, and subprocessors. Enterprise procurement answers in one page.",
};

export default function Page() {
  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-4xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link href="/trust" className="transition-colors hover:text-[var(--ed-copper)]">
            ← Trust
          </Link>
        </nav>

        <header className="mb-14">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Platform trust — procurement view
          </p>
          <h1 className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
            Security posture at a glance
          </h1>
          <p className="ed-body text-lg max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Every claim below references a real code path or operational
            fact. This page is designed to answer a vendor-security
            questionnaire in one read.
          </p>
        </header>

        {/* At-a-glance table */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">At a glance</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Fact label="Hosting" value="Vercel (US-East default, edge global)" />
            <Fact label="Database" value="Neon Postgres (us-east-1, AES-256 at rest)" />
            <Fact label="Authentication" value="Clerk (SOC 2 Type II subprocessor)" />
            <Fact label="Encryption in transit" value="TLS 1.3, HSTS enforced" />
            <Fact label="Safety pipeline" value="5-layer (sync regex + 3× NemoGuard + optional Claude critic)" />
            <Fact label="Admin access" value="Clerk login + ADMIN_USER_IDS env allowlist" />
            <Fact label="Tenant isolation" value="Postgres RLS (migration 0005)" />
            <Fact label="Audit log" value="Immutable append-only (src/lib/execution-audit.ts)" />
            <Fact label="Rate limiting" value="Per-user + per-IP, multi-bucket" />
            <Fact label="Anonymous telemetry" value="No IP, no cookies, no raw user-agents" />
          </dl>
        </section>

        {/* Data handling */}
        <Section title="Data handling">
          <P>Three classes of data:</P>
          <Bullet>
            <strong>Account data</strong> — email, Clerk user ID, tenant ID.
            Stored in Neon. Used for auth, tenant isolation, billing context.
          </Bullet>
          <Bullet>
            <strong>Agent invocations</strong> — input prompts, output text,
            model used, cost-ledger entries. Stored in the{" "}
            <Code>usage</Code> table with <Code>tenantId</Code> scoping;
            no cross-tenant reads.
          </Bullet>
          <Bullet>
            <strong>Telemetry</strong> — anonymous marketplace views via an
            opaque UUID in the visitor&rsquo;s localStorage. No IP, no
            user-agent, no cookies. See{" "}
            <Code>drizzle/0027_marketplace_agent_views.sql</Code>.
          </Bullet>
          <P>
            No third-party analytics. Every measurement lives in our own
            tables or structured logs.
          </P>
        </Section>

        {/* AI provider disclosure */}
        <Section title="AI provider disclosure">
          <P>
            Agent calls route through <Code>src/lib/ai.ts</Code> with
            free-tier-first ordering. A buyer&rsquo;s prompt may reach:
          </P>
          <Bullet>
            <strong>NVIDIA NIM</strong> (default, ~95% of calls) — open-source
            models hosted by NVIDIA. No training on API traffic per terms.
          </Bullet>
          <Bullet>
            <strong>Anthropic (Claude)</strong> — zero data retention beyond
            30-day abuse-detection window. No training on API traffic.
          </Bullet>
          <Bullet>
            <strong>Google AI (Gemini)</strong> — no training on paid-API traffic.
          </Bullet>
          <Bullet>
            <strong>Groq, Cerebras, Tavily</strong> — per each provider&rsquo;s
            ToS. Configurable exclusions.
          </Bullet>
          <P>
            Enterprises can set <Code>DATA_SOVEREIGNTY_MODE=true</Code> to
            exclude non-US providers (Alibaba/Qwen, Moonshot/Kimi) from the
            failover chain.
          </P>
        </Section>

        {/* Access controls */}
        <Section title="Access controls">
          <Bullet>
            Customer endpoints require a Clerk session token.
          </Bullet>
          <Bullet>
            Admin endpoints (<Code>/admin/*</Code>, <Code>/api/admin/*</Code>):
            Clerk session + Clerk user ID in <Code>ADMIN_USER_IDS</Code>.
            Non-admins receive <Code>404</Code> (not 403) — the endpoints
            never acknowledge their own existence.
          </Bullet>
          <Bullet>
            Tenant isolation: Postgres row-level security + a{" "}
            <Code>requireTenantId()</Code> guard wrapped around every
            data-returning handler.
          </Bullet>
          <Bullet>
            API keys fetched per-request, never cached across requests.
            Customer-provided BYOK keys are encrypted at rest.
          </Bullet>
        </Section>

        {/* Safety */}
        <Section title="Safety architecture">
          <P>
            Every SAM-submitted agent runs through two tiers before the
            public can invoke it:
          </P>
          <Bullet>
            <strong>Synchronous layer (free)</strong>: 11-pattern PII scan
            (OpenAI / Google / AWS / GitHub / Stripe / CC / SSN tokens), 9
            known jailbreak boilerplate phrases, length and pricing bounds.
            Hard-reject at the gate.
          </Bullet>
          <Bullet>
            <strong>Deep layer (NemoGuard, free)</strong>: three NVIDIA safety
            classifiers run in parallel — content-safety (23 categories),
            jailbreak-detect (adversarial prompts), topic-control
            (off-topic rejection). Source:{" "}
            <Code>src/lib/nemo-safety.ts</Code>.
          </Bullet>
          <P>
            Provider toggle <Code>SOVEREIGN_SAFETY_PROVIDER</Code> selects
            NemoGuard (default), Claude, or &ldquo;both&rdquo; (parallel,
            unanimous-pass required). Every submission&rsquo;s effective
            outcome, policy, and any downgrade reason is logged.
          </P>
        </Section>

        {/* Retention */}
        <Section title="Retention & deletion">
          <Bullet>
            Account data: retained while the account is active, deleted
            within 30 days of closure.
          </Bullet>
          <Bullet>
            Invocation data: retained 90 days by default. Configurable to
            30 days on enterprise request.
          </Bullet>
          <Bullet>
            Anonymous marketplace telemetry: retained indefinitely (no PII).
          </Bullet>
          <Bullet>
            Audit log: retained 7 years, immutable.
          </Bullet>
          <Bullet>
            Right-to-deletion requests:{" "}
            <a
              href="mailto:privacy@sovereignmatrix.agency"
              className="underline hover:text-[var(--ed-copper)]"
            >
              privacy@sovereignmatrix.agency
            </a>
            . Fulfilled within 30 days per GDPR Article 17.
          </Bullet>
        </Section>

        {/* Incident response */}
        <Section title="Incident response">
          <Bullet>
            Triage within 1 business hour of detection or report.
          </Bullet>
          <Bullet>
            Customer notification within 24 hours of any confirmed breach
            affecting their data.
          </Bullet>
          <Bullet>
            Per-agent circuit breakers automatically quarantine any agent
            whose safety score drops below 40 after deployment
            (<Code>src/lib/agent-circuit-breaker.ts</Code>).
          </Bullet>
          <Bullet>
            Report a security issue:{" "}
            <a
              href="mailto:security@sovereignmatrix.agency"
              className="underline hover:text-[var(--ed-copper)]"
            >
              security@sovereignmatrix.agency
            </a>
            . Coordinated disclosure preferred; 90-day public-disclosure window.
          </Bullet>
        </Section>

        {/* Subprocessors */}
        <Section title="Subprocessors">
          <P>
            Third parties that may process customer data in providing the
            platform. 30-day notice before any addition.
          </P>
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <Sub name="Vercel" purpose="Hosting, edge network, functions" region="Global (US-East default)" />
            <Sub name="Neon" purpose="Managed Postgres" region="us-east-1" />
            <Sub name="Clerk" purpose="Authentication, session management" region="Global" />
            <Sub name="NVIDIA NIM" purpose="Primary AI provider (open-source models)" region="US" />
            <Sub name="Anthropic" purpose="Fallback premium AI provider" region="US" />
            <Sub name="Google AI" purpose="Multimodal + grounded search (optional)" region="Global" />
            <Sub name="Resend" purpose="Transactional email" region="US" />
            <Sub name="Stripe" purpose="Payment processing (future)" region="Global" />
            <Sub name="Sentry" purpose="Error tracking (optional)" region="Global" />
          </div>
        </Section>

        {/* Compliance */}
        <Section title="Compliance roadmap">
          <Bullet>
            <strong>Now</strong>: GDPR/CCPA alignment by schema design
            (no PII in telemetry). Per-user data export and deletion on request.
          </Bullet>
          <Bullet>
            <strong>In progress</strong>: SOC 2 Type I scoping. Gap
            analysis complete; evidence collection underway.
          </Bullet>
          <Bullet>
            <strong>Next</strong>: annual third-party pen test, ISO 27001
            path evaluation, HIPAA BAA for healthcare agents.
          </Bullet>
        </Section>

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link href="/platform/status" className="transition-colors hover:text-[var(--ed-copper)]">
            Live platform status →
          </Link>
          <Link href="/spec/agent-manifest" className="transition-colors hover:text-[var(--ed-copper)]">
            SAM v1.0 specification →
          </Link>
          <a
            href="mailto:security@sovereignmatrix.agency"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            security@sovereignmatrix.agency
          </a>
        </footer>
      </div>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="ed-label mb-5">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="ed-body" style={{ color: "var(--ed-ink-soft)" }}>
      {children}
    </p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="ed-body pl-6 relative" style={{ color: "var(--ed-ink-soft)" }}>
      <span className="absolute left-0 ed-mono" style={{ color: "var(--ed-copper)" }}>
        ·
      </span>
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="ed-mono text-[0.85em] px-1"
      style={{
        background: "var(--ed-bg-raised)",
        color: "var(--ed-ink)",
        borderRadius: "2px",
      }}
    >
      {children}
    </code>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ed-label mb-1" style={{ color: "var(--ed-ink-soft)" }}>
        {label}
      </dt>
      <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
        {value}
      </dd>
    </div>
  );
}

function Sub({ name, purpose, region }: { name: string; purpose: string; region: string }) {
  return (
    <div
      className="grid grid-cols-[1fr_2fr_1.5fr] gap-4 px-5 py-3"
      style={{ borderBottom: "1px solid var(--ed-rule)" }}
    >
      <span className="ed-body" style={{ color: "var(--ed-ink)" }}>
        {name}
      </span>
      <span className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
        {purpose}
      </span>
      <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
        {region}
      </span>
    </div>
  );
}

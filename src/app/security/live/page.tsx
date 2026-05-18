import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  KeyRound,
  ScrollText,
  Anchor,
  Globe2,
  Lock,
  Boxes,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Security — Live Posture — Sovereign Matrix",
  description:
    "Machine-readable security posture rendered as UI. Receipt scheme enablement, latest Bitcoin anchor, transport-security headers, WebAuthn state, compliance mapping. Refreshed every 5 minutes.",
  openGraph: {
    title: "Sovereign Matrix — Live security posture",
    description:
      "Procurement-grade evidence rendered from the live /api/security/posture envelope.",
  },
};

// 5-minute ISR — same TTL as the underlying /api/security/posture
// cache header. Procurement automation polling at higher frequency
// gets cached responses; refreshes propagate within a deploy cycle.
export const revalidate = 300;

interface Posture {
  generatedAt: string;
  issuer: {
    name: string;
    domain: string;
    contact: string;
    vulnerabilityDisclosure: string;
  };
  receipts: {
    schemes: {
      v1_hmac_sha256: { enabled: boolean; verifierEndpoint: string };
      v2_ed25519: {
        enabled: boolean;
        publicKeyUrl: string | null;
        publicKeyPemPreview: string | null;
      };
      v3_ed25519_mldsa65: {
        enabled: boolean;
        mldsaPublicKeyUrl: string | null;
        standardCitation: string;
      };
    };
    canonicalizationSpec: string;
    replayInterface: string;
  };
  chainOfCustody: {
    auditChainHead: string | null;
    auditChainRowCount: number | null;
    lastAnchoredAt: string | null;
    bitcoinCalendarProofs: number;
    anchorEndpoint: string;
    stale?: boolean;
  };
  transportSecurity: Record<string, string>;
  authentication: {
    provider: string;
    mfa: string;
    webauthnStepUp: {
      enabled: boolean;
      required: boolean;
      registrationEndpoint: string;
    };
  };
  compliance: Record<string, string>;
  sbom: {
    generator: string;
    ciArtifactRetentionDays: number;
    ciWorkflow: string;
  };
  openSourcePrimitives: Array<{
    name: string;
    license: string;
    registry: string;
    source: string;
    purpose: string;
  }>;
}

/**
 * Loop back through the public /api/security/posture endpoint so
 * this page renders exactly what an off-platform questionnaire
 * automation would see. Same fetch path = same answer.
 *
 * We construct an absolute URL because Next.js server components
 * can't use relative URLs in fetch. The base host is derived from
 * VERCEL_URL when available, else falls back to localhost for
 * dev / preview.
 */
async function loadPosture(): Promise<Posture> {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/api/security/posture`, {
    // 5-minute cache aligns with the endpoint's own Cache-Control
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`posture endpoint returned HTTP ${res.status}`);
  }
  return (await res.json()) as Posture;
}

export default async function SecurityLivePage() {
  let posture: Posture | null = null;
  let error: string | null = null;
  try {
    posture = await loadPosture();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-200 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.25em] mb-6">
          SECURITY · LIVE POSTURE · MACHINE-READABLE
        </p>
        <h1 className="font-serif text-5xl md:text-7xl leading-[1.04] tracking-[-0.02em] text-white mb-6">
          The evidence,
          <br />
          <span className="text-[#B5532C]">rendered as UI.</span>
        </h1>
        <p className="text-[17px] text-neutral-400 leading-[1.6] max-w-2xl mb-10">
          Every number on this page is read from the live{" "}
          <Link
            href="/api/security/posture"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
          >
            /api/security/posture
          </Link>{" "}
          endpoint at request time. Procurement automation can scrape the same
          JSON envelope; this page is the human-readable projection of it.
        </p>

        {error && (
          <div className="mb-10 p-5 border border-rose-500/30 bg-rose-500/[0.04] rounded-[3px]">
            <p className="font-mono text-[10px] text-rose-300 tracking-[0.25em] uppercase mb-2">
              Posture fetch failed
            </p>
            <p className="text-[14px] text-neutral-300 leading-[1.65]">
              {error}. The marketing copy at{" "}
              <Link
                href="/security"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
              >
                /security
              </Link>{" "}
              still applies; this live view is for procurement automation and is
              dependent on the platform being reachable.
            </p>
          </div>
        )}

        {posture && (
          <>
            <p className="font-mono text-[11px] text-neutral-500 tracking-[0.2em] mb-12">
              GENERATED AT · {posture.generatedAt}
            </p>

            <Section
              icon={<KeyRound className="w-3 h-3" />}
              title="01 · RECEIPT SCHEMES"
            >
              <SchemeRow
                label="v1 — HMAC-SHA256"
                enabled={posture.receipts.schemes.v1_hmac_sha256.enabled}
                detail="Shared-secret. Verifier needs the issuer's HMAC key."
                endpoint={
                  posture.receipts.schemes.v1_hmac_sha256.verifierEndpoint
                }
              />
              <SchemeRow
                label="v2 — Ed25519"
                enabled={posture.receipts.schemes.v2_ed25519.enabled}
                detail="Public-key. Any third party with the PEM can verify."
                endpoint={
                  posture.receipts.schemes.v2_ed25519.publicKeyUrl ?? ""
                }
                pemPreview={
                  posture.receipts.schemes.v2_ed25519.publicKeyPemPreview
                }
              />
              <SchemeRow
                label={`v3 — ${posture.receipts.schemes.v3_ed25519_mldsa65.standardCitation}`}
                enabled={posture.receipts.schemes.v3_ed25519_mldsa65.enabled}
                detail="Post-quantum forward-secure. Survives the PQ transition."
                endpoint={
                  posture.receipts.schemes.v3_ed25519_mldsa65
                    .mldsaPublicKeyUrl ?? ""
                }
              />
              <p className="text-[11px] text-neutral-500 leading-[1.65] mt-3">
                Spec:{" "}
                <Link
                  href={posture.receipts.canonicalizationSpec}
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  {posture.receipts.canonicalizationSpec}
                </Link>{" "}
                · Replay UI:{" "}
                <Link
                  href={posture.receipts.replayInterface}
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  {posture.receipts.replayInterface}
                </Link>
              </p>
            </Section>

            <Section
              icon={<Anchor className="w-3 h-3" />}
              title="02 · CHAIN OF CUSTODY"
            >
              <KvRow
                k="Audit chain head"
                v={posture.chainOfCustody.auditChainHead ?? "—"}
                mono
                breakAll
              />
              <KvRow
                k="Row count"
                v={String(posture.chainOfCustody.auditChainRowCount ?? "—")}
              />
              <KvRow
                k="Last anchored at"
                v={posture.chainOfCustody.lastAnchoredAt ?? "—"}
              />
              <KvRow
                k="Bitcoin calendar proofs"
                v={String(posture.chainOfCustody.bitcoinCalendarProofs)}
              />
              {posture.chainOfCustody.stale && (
                <p className="text-[12px] text-[#E08558] mt-2">
                  ⚠ Latest anchor is stale (older than 6h). The anchor cron may
                  be unhealthy on this deploy.
                </p>
              )}
              <p className="text-[11px] text-neutral-500 leading-[1.65] mt-3">
                Endpoint:{" "}
                <Link
                  href={posture.chainOfCustody.anchorEndpoint}
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  {posture.chainOfCustody.anchorEndpoint}
                </Link>
              </p>
            </Section>

            <Section
              icon={<Globe2 className="w-3 h-3" />}
              title="03 · TRANSPORT SECURITY"
            >
              {Object.entries(posture.transportSecurity).map(([k, v]) => (
                <KvRow key={k} k={k} v={v} mono breakAll />
              ))}
            </Section>

            <Section
              icon={<Lock className="w-3 h-3" />}
              title="04 · AUTHENTICATION"
            >
              <KvRow k="Provider" v={posture.authentication.provider} />
              <KvRow k="MFA" v={posture.authentication.mfa} />
              <KvRow
                k="WebAuthn step-up enabled"
                v={String(posture.authentication.webauthnStepUp.enabled)}
                accent={
                  posture.authentication.webauthnStepUp.enabled
                    ? "cyan"
                    : "neutral"
                }
              />
              <KvRow
                k="WebAuthn step-up required"
                v={String(posture.authentication.webauthnStepUp.required)}
              />
            </Section>

            <Section
              icon={<ScrollText className="w-3 h-3" />}
              title="05 · COMPLIANCE MAPPING"
            >
              {Object.entries(posture.compliance).map(([k, v]) => (
                <KvRow key={k} k={k} v={v} />
              ))}
            </Section>

            <Section
              icon={<Boxes className="w-3 h-3" />}
              title="06 · OPEN-SOURCE PRIMITIVES"
            >
              {posture.openSourcePrimitives.map((pkg) => (
                <div
                  key={pkg.name}
                  className="p-3 mb-2 rounded-[3px] border border-white/[0.06] bg-white/[0.015]"
                >
                  <div className="flex flex-wrap items-baseline gap-2 mb-1">
                    <span className="font-mono text-[12px] text-cyan-300">
                      {pkg.name}
                    </span>
                    <span className="font-mono text-[10px] text-[#E08558] tracking-[0.15em]">
                      {pkg.license}
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-400 leading-[1.55] mb-2">
                    {pkg.purpose}
                  </p>
                  <p className="text-[11px] font-mono">
                    <a
                      href={pkg.registry}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40 mr-3"
                    >
                      npm →
                    </a>
                    <a
                      href={pkg.source}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                    >
                      source →
                    </a>
                  </p>
                </div>
              ))}
            </Section>

            <Section
              icon={<ShieldCheck className="w-3 h-3" />}
              title="07 · ISSUER + VULNERABILITY DISCLOSURE"
            >
              <KvRow k="Issuer" v={posture.issuer.name} />
              <KvRow k="Domain" v={posture.issuer.domain} mono />
              <KvRow k="Security contact" v={posture.issuer.contact} mono />
              <p className="text-[11px] text-neutral-500 leading-[1.65] mt-3">
                Disclosure policy:{" "}
                <a
                  href={posture.issuer.vulnerabilityDisclosure}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
                >
                  {posture.issuer.vulnerabilityDisclosure}
                </a>
              </p>
            </Section>
          </>
        )}

        <div className="mt-16 pt-10 border-t border-white/[0.06]">
          <p className="text-[12px] font-mono text-neutral-500 leading-[1.7]">
            See also{" "}
            <Link
              href="/security"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /security
            </Link>{" "}
            (marketing-grade overview),{" "}
            <Link
              href="/transparency"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              /transparency
            </Link>{" "}
            (live STH + verifier),{" "}
            <Link
              href="/api/security/posture"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
            >
              raw JSON
            </Link>{" "}
            (the source of truth for this page).
          </p>
        </div>
      </div>
    </main>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <p className="flex items-center gap-2 font-mono text-[11px] text-cyan-300/80 tracking-[0.25em] uppercase mb-4">
        {icon}
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KvRow({
  k,
  v,
  mono,
  breakAll,
  accent = "neutral",
}: {
  k: string;
  v: string;
  mono?: boolean;
  breakAll?: boolean;
  accent?: "neutral" | "cyan";
}) {
  const valueClass = accent === "cyan" ? "text-cyan-300" : "text-neutral-300";
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-4 px-3 py-2 rounded-[3px] border border-white/[0.05] bg-white/[0.015]">
      <p className="font-mono text-[10px] text-neutral-500 tracking-[0.15em] uppercase">
        {k}
      </p>
      <p
        className={`text-[13px] leading-[1.55] ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""} ${valueClass}`}
      >
        {v}
      </p>
    </div>
  );
}

function SchemeRow({
  label,
  enabled,
  detail,
  endpoint,
  pemPreview,
}: {
  label: string;
  enabled: boolean;
  detail: string;
  endpoint: string;
  pemPreview?: string | null;
}) {
  const enabledClass = enabled
    ? "text-cyan-300 border-cyan-500/30 bg-cyan-500/[0.05]"
    : "text-neutral-500 border-white/[0.06] bg-white/[0.015]";
  return (
    <div className={`p-3 rounded-[3px] border ${enabledClass}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[12px]">{label}</span>
        <span className="font-mono text-[10px] tracking-[0.15em]">
          {enabled ? "ENABLED" : "DISABLED"}
        </span>
      </div>
      <p className="text-[12px] text-neutral-400 leading-[1.55] mb-2">
        {detail}
      </p>
      {enabled && endpoint && (
        <p className="text-[11px] font-mono">
          <Link
            href={endpoint}
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 decoration-cyan-500/40"
          >
            {endpoint}
            <ArrowRight className="inline w-3 h-3 ml-1" />
          </Link>
        </p>
      )}
      {pemPreview && (
        <pre className="mt-2 text-[10px] font-mono text-neutral-400 leading-[1.5] bg-black/40 rounded-[3px] p-2 overflow-x-auto">
          {pemPreview}
        </pre>
      )}
    </div>
  );
}

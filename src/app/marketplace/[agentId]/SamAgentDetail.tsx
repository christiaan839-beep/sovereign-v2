/**
 * SamAgentDetail — server-rendered view for SAM v1.0 agents retrieved
 * from marketplace_agents. No client JavaScript needed for the
 * first paint; interactivity (copy reference, download manifest) is
 * handled by a small client island (ManifestTools).
 *
 * Design language: editorial-dark, matches /creators/apply and the
 * rest of the Sovereign Matrix narrative. Hierarchy:
 *
 *   1. Masthead       — name + verified chip + purpose
 *   2. Metadata row   — category · pricing · creator
 *   3. Invoke CTA     — primary action
 *   4. Guarantees     — bullet list from manifest
 *   5. Technical      — manifest JSON + download
 *   6. Provenance     — reference ID + created-at
 *
 * TODO(seo): add JSON-LD SoftwareApplication structured data. Deferred
 * because safe emission requires script-terminator escapes (see the
 * `\u003c` trick) + a dangerouslySetInnerHTML call site that wants its
 * own review. Non-blocking for shipping the page today.
 */

import Link from "next/link";
import type { MarketplaceAgentView } from "@/lib/marketplace-query";
import { InvokePanel } from "./InvokePanel";
import { ManifestTools } from "./ManifestTools";
import { ViewTracker } from "./ViewTracker";

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢ / invocation`;
  return `$${(cents / 100).toFixed(2)} / invocation`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Partially redact the author email — "john@example.com" → "j***@example.com".
// The domain is public information (it's in DNS); the local part identifies
// a specific person and shouldn't be harvestable from a public page.
function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "—";
  const first = local[0] ?? "";
  return `${first}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export function SamAgentDetail({ agent }: { agent: MarketplaceAgentView }) {
  const categoryLabel = agent.samCategory ?? agent.category;
  const manifestJson = JSON.stringify(agent.manifestRaw ?? {}, null, 2);

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      {/* Privacy-minimal view tracking — anonymous UUID, no cookies. */}
      <ViewTracker agentId={agent.id} slug={agent.slug} />
      <article className="max-w-5xl mx-auto px-6 pt-14 pb-24">
        {/* Breadcrumb */}
        <nav className="ed-caption mb-10">
          <Link
            href="/marketplace"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Marketplace
          </Link>
        </nav>

        {/* Masthead */}
        <header className="mb-10">
          <div className="flex items-baseline gap-4 flex-wrap mb-4">
            <h1 className="ed-display text-6xl" style={{ color: "var(--ed-ink)" }}>
              {agent.name}
            </h1>
            <span
              className="ed-label px-2 py-1"
              style={{
                color: "var(--ed-copper)",
                background: "var(--ed-copper-wash)",
                borderRadius: "2px",
              }}
            >
              ✓ 5-Layer Verified
            </span>
          </div>
          <p className="ed-body text-xl max-w-3xl" style={{ color: "var(--ed-ink-soft)" }}>
            {agent.description}
          </p>
        </header>

        {/* Metadata row */}
        <dl
          className="flex flex-wrap gap-x-10 gap-y-4 pb-8 mb-10"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <div>
            <dt className="ed-label mb-1">Category</dt>
            <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
              {categoryLabel}
            </dd>
          </div>
          <div>
            <dt className="ed-label mb-1">Pricing</dt>
            <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
              {formatPrice(agent.pricingCents)}
            </dd>
          </div>
          <div>
            <dt className="ed-label mb-1">Creator</dt>
            <dd className="ed-mono text-sm" style={{ color: "var(--ed-ink)" }}>
              {redactEmail(agent.authorEmail)}
            </dd>
          </div>
          <div>
            <dt className="ed-label mb-1">Published</dt>
            <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
              {formatDate(agent.verifiedAt ?? agent.createdAt)}
            </dd>
          </div>
          {agent.submissionSource === "sam-v1" && (
            <div>
              <dt className="ed-label mb-1">Spec</dt>
              <dd className="ed-mono text-sm" style={{ color: "var(--ed-copper)" }}>
                <Link
                  href="/spec/agent-manifest"
                  className="transition-opacity hover:opacity-75"
                >
                  SAM v1.0 →
                </Link>
              </dd>
            </div>
          )}
        </dl>

        {/* Primary CTA */}
        <div className="mb-14">
          <Link
            href={`/playground?agent=${agent.slug ?? agent.id}`}
            className="inline-block px-6 py-3 ed-mono text-base transition-opacity hover:opacity-80"
            style={{
              background: "var(--ed-copper)",
              color: "var(--ed-bg)",
              borderRadius: "2px",
            }}
          >
            Invoke this agent →
          </Link>
          <span className="ml-5 ed-caption">
            70% of every invocation goes to the creator.
          </span>
        </div>

        {/* Invoke panel — the revenue-making moment of the marketplace. */}
        <InvokePanel
          slugOrId={agent.slug ?? agent.id}
          agentName={agent.name}
          pricingCents={agent.pricingCents}
        />

        {/* Guarantees */}
        {agent.guarantees.length > 0 && (
          <section className="mb-14">
            <h2 className="ed-label mb-5">Guarantees</h2>
            <ul className="space-y-3">
              {agent.guarantees.map((g, i) => (
                <li
                  key={i}
                  className="flex gap-4 ed-body"
                  style={{ color: "var(--ed-ink)" }}
                >
                  <span
                    className="ed-mono flex-shrink-0"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Technical — manifest JSON */}
        <section className="mb-14">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="ed-label">Manifest (SAM v1.0)</h2>
            <ManifestTools manifestJson={manifestJson} slug={agent.slug ?? agent.id} />
          </div>
          <pre
            className="p-5 ed-mono text-[12px] overflow-auto"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              color: "var(--ed-ink-soft)",
              borderRadius: "2px",
              maxHeight: "420px",
            }}
          >
            {manifestJson}
          </pre>
        </section>

        {/* Provenance */}
        {agent.referenceId && (
          <footer
            className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
            style={{ borderTop: "1px solid var(--ed-rule)" }}
          >
            <span>
              Reference:{" "}
              <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>
                {agent.referenceId}
              </span>
            </span>
            <Link
              href="/spec/agent-manifest"
              className="transition-colors hover:text-[var(--ed-copper)]"
            >
              Learn about SAM v1.0 →
            </Link>
            <Link
              href="/creators/apply"
              className="transition-colors hover:text-[var(--ed-copper)]"
            >
              Publish your own agent →
            </Link>
          </footer>
        )}
      </article>
    </div>
  );
}

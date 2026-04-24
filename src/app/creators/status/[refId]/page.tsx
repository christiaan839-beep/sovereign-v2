/**
 * /creators/status/[refId] — public submission status page.
 *
 * Anyone with a reference ID (SAM-xxxxxxxx-xxxx) can see the status
 * of that submission: pending / verified / rejected, plus the
 * reason if applicable. No auth required — reference IDs are
 * capability tokens (knowing one = permitted to see status).
 *
 * Useful for:
 *   - A creator who clicked away from the apply page before saving
 *     the reference ID and needs to check back
 *   - Support conversations: "I submitted X, what's the state?"
 *     becomes a shareable URL
 *   - Public accountability: reviewers' decisions are visible to
 *     anyone who has the reference. Implicit review-time SLA.
 *
 * Privacy: we surface the minimum — name, status, reason (if
 * rejected), timestamps. NOT the full manifest, NOT the creator's
 * email, NOT safety scores. Anyone who needs more has the reference
 * + is probably the creator themselves → /dashboard/creator.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";

type RouteParams = Promise<{ refId: string }>;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { refId } = await params;
  return {
    title: `Submission ${refId} — Sovereign Matrix`,
    description: "Public status of a SAM v1.0 submission. Reference IDs are capability tokens.",
    // Noindex — status pages are shareable-by-link, not crawlable.
    robots: { index: false, follow: false },
  };
}

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

async function fetchByReference(refId: string) {
  if (!databaseIsConfigured() || !refId) return null;
  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        category: marketplaceAgents.category,
        verificationStatus: marketplaceAgents.verificationStatus,
        rejectionReason: marketplaceAgents.rejectionReason,
        submissionPolicy: marketplaceAgents.submissionPolicy,
        submissionReason: marketplaceAgents.submissionReason,
        verifiedAt: marketplaceAgents.verifiedAt,
        createdAt: marketplaceAgents.createdAt,
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.referenceId, refId))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function statusBadge(status: string): { label: string; tone: "ok" | "warn" | "fail" } {
  switch (status) {
    case "verified":
      return { label: "Approved — live on the marketplace", tone: "ok" };
    case "pending":
      return { label: "Awaiting operator review", tone: "warn" };
    case "in_review":
      return { label: "Under review", tone: "warn" };
    case "rejected":
      return { label: "Not approved", tone: "fail" };
    case "suspended":
      return { label: "Suspended", tone: "fail" };
    default:
      return { label: status, tone: "warn" };
  }
}

export default async function Page({ params }: { params: RouteParams }) {
  const { refId } = await params;
  const row = await fetchByReference(refId);

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-3xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/creators/apply"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Creator apply
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Submission status
          </p>
          <h1
            className="ed-mono text-3xl mb-3"
            style={{ color: "var(--ed-ink)" }}
          >
            {refId}
          </h1>
        </header>

        {!row ? (
          <div
            className="p-8"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              borderRadius: "2px",
            }}
          >
            <p className="ed-body mb-3" style={{ color: "var(--ed-ink)" }}>
              No submission found with this reference.
            </p>
            <p className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
              Reference IDs look like <span className="ed-mono">SAM-xxxxxxxx-xxxx</span>.
              They&apos;re issued on every creator submission. Check your confirmation
              email or your creator dashboard.
            </p>
          </div>
        ) : (
          <>
            {/* Status card */}
            {(() => {
              const s = statusBadge(row.verificationStatus);
              return (
                <div
                  className="p-6 mb-10"
                  style={{
                    border:
                      s.tone === "ok"
                        ? "1px solid var(--ed-copper)"
                        : "1px solid var(--ed-rule)",
                    background:
                      s.tone === "ok" ? "var(--ed-copper-wash)" : "var(--ed-bg-raised)",
                    borderRadius: "2px",
                  }}
                >
                  <p
                    className="ed-label mb-2"
                    style={{
                      color:
                        s.tone === "ok" ? "var(--ed-copper)" : "var(--ed-ink-soft)",
                    }}
                  >
                    {s.tone === "ok" ? "✓" : s.tone === "fail" ? "✗" : "⏱"} {s.label}
                  </p>
                  <p
                    className="ed-display text-3xl"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {row.name}
                  </p>
                  <p
                    className="ed-caption mt-2"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {row.category}
                    {row.verifiedAt && (
                      <>
                        {" · "}
                        Published{" "}
                        {new Date(row.verifiedAt).toLocaleDateString(
                          "en-US",
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </>
                    )}
                  </p>
                  {row.verificationStatus === "verified" && row.slug && (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--ed-rule)" }}>
                      <Link
                        href={`/marketplace/${row.slug}`}
                        className="ed-mono text-sm transition-colors hover:opacity-75"
                        style={{ color: "var(--ed-copper)" }}
                      >
                        View on marketplace →
                      </Link>
                    </div>
                  )}
                  {row.verificationStatus === "rejected" && row.rejectionReason && (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--ed-rule)" }}>
                      <p
                        className="ed-label mb-1"
                        style={{ color: "var(--ed-ink-soft)" }}
                      >
                        Reviewer&apos;s reason
                      </p>
                      <p className="ed-body" style={{ color: "var(--ed-ink)" }}>
                        {row.rejectionReason}
                      </p>
                      <p className="ed-caption mt-3" style={{ color: "var(--ed-ink-soft)" }}>
                        You can revise the manifest and resubmit via{" "}
                        <Link
                          href="/creators/apply"
                          className="transition-colors hover:text-[var(--ed-copper)]"
                        >
                          /creators/apply
                        </Link>
                        .
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Metadata detail */}
            <section className="mb-10">
              <h2 className="ed-label mb-5">Submission detail</h2>
              <dl
                className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5"
                style={{
                  border: "1px solid var(--ed-rule)",
                  background: "var(--ed-bg-raised)",
                  borderRadius: "2px",
                }}
              >
                <div>
                  <dt
                    className="ed-label mb-1"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    Received
                  </dt>
                  <dd
                    className="ed-body"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt
                    className="ed-label mb-1"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    Policy at receipt
                  </dt>
                  <dd
                    className="ed-mono text-sm"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {row.submissionPolicy ?? "unknown"}
                  </dd>
                </div>
                {row.submissionReason && (
                  <div className="md:col-span-2">
                    <dt
                      className="ed-label mb-1"
                      style={{ color: "var(--ed-ink-soft)" }}
                    >
                      Policy decision reason
                    </dt>
                    <dd className="ed-body" style={{ color: "var(--ed-ink)" }}>
                      {row.submissionReason}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          </>
        )}

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/creators/apply"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Submit another →
          </Link>
          <Link
            href="/dashboard/creator"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Your creator home →
          </Link>
          <Link
            href="/spec/agent-manifest"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            SAM v1.0 spec →
          </Link>
        </footer>
      </div>
    </div>
  );
}

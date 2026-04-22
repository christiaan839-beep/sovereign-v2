/**
 * /admin/creator-submissions — SAM v1.0 review dashboard.
 *
 * Server component. Uses requireAdmin() to reject non-admins at the
 * gate (404 via the API's non-revealing pattern; for the page, we
 * render a generic "not found" state so the URL's existence isn't
 * leaked either).
 *
 * Hierarchy:
 *   - Status filter tabs (pending | verified | rejected | all)
 *   - Submission table: slug | name | submitted | policy | email | actions
 *   - Row expands to show full manifest on click (client island)
 *
 * Data is SSR'd — the first paint shows real rows. The client island
 * handles approve/reject actions via the REST endpoints.
 */

import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  listSamSubmissions,
  type AdminSubmissionFilter,
} from "@/lib/admin-submissions";
import { AdminReviewClient } from "./AdminReviewClient";

type Search = Promise<{ status?: string }>;

export const metadata = {
  title: "Creator Submissions — Admin",
  robots: { index: false, follow: false },
};

function parseStatus(raw: string | undefined): NonNullable<AdminSubmissionFilter["status"]> {
  const allowed: NonNullable<AdminSubmissionFilter["status"]>[] = [
    "pending",
    "verified",
    "rejected",
    "in_review",
    "suspended",
    "all",
  ];
  if (raw && (allowed as string[]).includes(raw)) {
    return raw as NonNullable<AdminSubmissionFilter["status"]>;
  }
  return "pending";
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    // Mirror the API's "don't reveal the URL exists" posture.
    notFound();
  }

  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const rows = await listSamSubmissions({ status, limit: 100 });

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-24">
        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Admin
          </p>
          <h1 className="ed-display text-5xl mb-3" style={{ color: "var(--ed-ink)" }}>
            Creator Submissions
          </h1>
          <p className="ed-body text-lg max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            SAM v1.0 manifests awaiting review. Approve to publish to the
            marketplace. Reject with a reason the creator can read.
          </p>
        </header>

        {/* Status filter */}
        <nav className="flex gap-6 mb-10" style={{ borderBottom: "1px solid var(--ed-rule)" }}>
          {(["pending", "verified", "rejected", "all"] as const).map((s) => (
            <a
              key={s}
              href={`/admin/creator-submissions?status=${s}`}
              className="ed-label pb-3 transition-colors"
              style={{
                color: status === s ? "var(--ed-copper)" : "var(--ed-ink-soft)",
                borderBottom:
                  status === s ? "2px solid var(--ed-copper)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {s}
            </a>
          ))}
        </nav>

        {/* Count */}
        <p className="ed-caption mb-6">
          {rows.length === 0
            ? `No submissions with status "${status}".`
            : `${rows.length} submission${rows.length === 1 ? "" : "s"}`}
        </p>

        {/* Client island: interactive approve / reject per row. */}
        <AdminReviewClient rows={rows} status={status} />
      </div>
    </div>
  );
}

/**
 * /admin/bundles — admin bundle curator.
 *
 * Two panes in one page:
 *   1. List: every bundle (draft + public), click to manage
 *   2. Create: form to mint a new bundle from N marketplace agents
 *
 * Clerk-gated via isAdmin() with the same 404-for-non-admins posture
 * as the rest of /admin.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentBundles } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { BundleCuratorClient } from "./BundleCuratorClient";

export const metadata: Metadata = {
  title: "Bundles — Admin",
  robots: { index: false, follow: false },
};

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

async function listAll() {
  if (!databaseIsConfigured()) return [];
  try {
    return await db
      .select()
      .from(agentBundles)
      .orderBy(desc(agentBundles.createdAt));
  } catch {
    return [];
  }
}

export default async function Page() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  const bundles = await listAll();

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Admin
          </p>
          <h1
            className="ed-display text-5xl mb-3"
            style={{ color: "var(--ed-ink)" }}
          >
            Bundle curator
          </h1>
          <p
            className="ed-body max-w-2xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Compose 2+ marketplace agents into a single purchasable bundle.
            Member shares must sum to 100. Bundles start as drafts; publish
            flips them to the public index.
          </p>
        </header>

        <BundleCuratorClient initialBundles={bundles} />
      </div>
    </div>
  );
}

/**
 * scripts/seed-public-demo-data.ts
 *
 * Seeds public-demo playbook runs + tenant memories scoped to
 * PUBLIC_DEMO_USER_ID so the landing v2 live demo sections
 * (memory-demo, router-demo, verify-demo) have real data to show.
 *
 * Skeleton — only verifies the invariant + DB connectivity. Extended
 * in Task 14 to insert 3 real playbook runs + 3 recalled-context
 * tenant_memories rows.
 *
 * Run: npx tsx scripts/seed-public-demo-data.ts
 */

import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PUBLIC_DEMO_USER_ID } from "@/lib/tenant-scope";

async function main(): Promise<void> {
  console.log(`Public demo user id: ${PUBLIC_DEMO_USER_ID}`);

  // Probe query — confirms DB connectivity and that the user_id
  // column exists on playbook_runs.
  const existing = await db
    .select({ id: playbookRuns.id })
    .from(playbookRuns)
    .where(eq(playbookRuns.userId, PUBLIC_DEMO_USER_ID))
    .limit(5);

  console.log(
    `Existing public-demo runs: ${existing.length}. Extended seed lands in Task 14.`,
  );
}

main().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

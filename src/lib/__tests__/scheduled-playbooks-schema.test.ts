import { describe, it, expect } from "vitest";
import { scheduledPlaybooks } from "@/db/schema";

describe("scheduled_playbooks Drizzle table", () => {
  it("is exported and shaped for schedule dispatch", () => {
    expect(scheduledPlaybooks).toBeDefined();
    // The service layer (scheduled-playbooks.ts) relies on these columns.
    // TypeScript won't catch a missing column here, but a renamed column
    // would still compile; this test pins the set.
    const columns = Object.keys(scheduledPlaybooks as unknown as Record<string, unknown>);
    for (const expected of [
      "id", "userId", "playbookId", "inputs",
      "cronExpression", "timezone", "active",
      "nextRunAt", "lastRunAt", "runCount",
      "failureCount",
    ]) {
      expect(columns, `missing column ${expected}`).toContain(expected);
    }
  });
});

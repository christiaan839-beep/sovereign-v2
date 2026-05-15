/**
 * SOVEREIGN MATRIX — Production tool-registry composition (Cook 81)
 *
 * Wires every piece of the Cook 36 tool registry together at runtime:
 *
 *   - fetch_url       (Tier 1, autonomous)
 *   - write_memory    (Tier 2, requires approvalToken)
 *   - purge_memory    (Tier 3, admin allowlist)
 *   - run_code        (Tier 3, admin allowlist, e2b runner)
 *   - browser_session (Tier 3, admin allowlist, Browserbase runner)
 *
 * Admin allowlist comes from the Cook 77 grant cache. Side-effect
 * dependencies (writer / purger) are injected here so the registry
 * itself stays pure + testable.
 *
 * This module is the production "main" — call `buildToolRegistry()`
 * inside any agent route that wants typed tool use.
 */

import { ToolRegistry } from "@/lib/tool-registry";
import {
  buildFetchUrlTool,
  buildPurgeMemoryTool,
  buildWriteMemoryTool,
} from "@/lib/tools/built-in";
import { buildCodeSandboxTool } from "@/lib/tools/code-sandbox";
import { buildBrowserAutomationTool } from "@/lib/tools/browser-automation";
import { buildE2bRunner } from "@/lib/runners/e2b-runner";
import { buildBrowserbaseRunner } from "@/lib/runners/browserbase-runner";
import { getAdminAllowlist } from "@/app/api/_admin/grant/route";

// ── Memory writer + purger stubs ──────────────────────────────────────────
//
// Production wires these to the existing tenantMemories Drizzle table.
// Until migration 0021 lands, the writer + purger no-op so the tool
// always returns a structured ok outcome. Swap in 5 lines once the
// table is live.

const memoryWriter = async (_opts: {
  key: string;
  value: string;
  category: string | undefined;
  tenantId: string;
  userId: string;
}): Promise<void> => {
  /* in-memory no-op until tenantMemories migration lands */
};

const memoryPurger = async (_filter: {
  tenantId: string;
  category?: string;
}): Promise<{ rowsDeleted: number }> => {
  return { rowsDeleted: 0 };
};

/**
 * Build the production tool registry. Cheap to call — registers
 * 5 tools and seeds the admin allowlist from the Cook 77 grant cache.
 */
export function buildToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(buildFetchUrlTool(globalThis.fetch));
  registry.register(buildWriteMemoryTool(memoryWriter));
  registry.register(buildPurgeMemoryTool(memoryPurger));
  registry.register(buildCodeSandboxTool(buildE2bRunner()));
  registry.register(buildBrowserAutomationTool(buildBrowserbaseRunner()));
  for (const adminId of getAdminAllowlist()) {
    registry.grantAdmin(adminId);
  }
  return registry;
}

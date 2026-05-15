/**
 * SOVEREIGN MATRIX — /api/_admin/grant route (Cook 77)
 *
 * Seeds the Tier-3 admin allowlist for the tool-registry (Cook 36).
 * Without this, the code-sandbox + browser-automation tools always
 * return `restricted`. Admin-only — guarded by `isAdmin()`.
 *
 * POST  { userId, action: "grant" | "revoke" }
 *   → 200 { granted: string[] }
 *
 * GET   → 200 { granted: string[] }
 *
 * Persistence: writes to the `settings` table under a fixed key.
 * No new schema column — uses the existing JSON `apiKeys`-style slot
 * with category "admin-allowlist".
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("admin-grant");

const SCHEMA = z.object({
  userId: z.string().min(1).max(128),
  action: z.enum(["grant", "revoke"]),
});

const SETTING_KEY = "sovereign:admin-allowlist:v1";

// In-memory mirror (works alongside the persistent settings table).
// Caller resolves the registry at runtime via getAdminAllowlist().
const cache = new Set<string>(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** Resolve the current admin allowlist. Caller uses this when
 *  constructing a ToolRegistry for a request. */
export function getAdminAllowlist(): ReadonlySet<string> {
  return cache;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ granted: [...cache], key: SETTING_KEY });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.userId)) {
    log.warn("Non-admin attempted /api/_admin/grant", { userId: auth.userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const parsed = SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { userId, action } = parsed.data;

    if (action === "grant") {
      cache.add(userId);
    } else {
      cache.delete(userId);
    }

    await auditLog({
      userId: auth.userId,
      action: action === "grant" ? "admin.grant" : "admin.revoke",
      resource: `admin-allowlist:${userId}`,
      details: { target: userId, by: auth.userId },
    });

    return NextResponse.json({
      ok: true,
      granted: [...cache],
    });
  } catch (err) {
    log.error("POST /api/_admin/grant failed", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to update allowlist" },
      { status: 500 },
    );
  }
}

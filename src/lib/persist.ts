/**
 * PERSISTENCE LAYER — Dual-mode storage.
 * 
 * Mode 1 (Default): File-based /tmp storage for Vercel serverless.
 * Mode 2 (Production): Supabase PostgreSQL when DATABASE_URL is set.
 * 
 * Auto-detects which mode to use. Zero code changes needed when upgrading.
 * 
 * To upgrade to Supabase:
 * 1. Create a Supabase project at supabase.com
 * 2. Run this SQL in the SQL Editor:
 *    CREATE TABLE persist (
 *      key TEXT PRIMARY KEY,
 *      data JSONB NOT NULL DEFAULT '[]',
 *      updated_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 * 3. Add these env vars to Vercel:
 *    SUPABASE_URL=https://your-project.supabase.co
 *    SUPABASE_KEY=your-anon-key
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const PERSIST_DIR = join("/tmp", "sovereign-persist");
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

function ensureDir() {
  if (!existsSync(PERSIST_DIR)) {
    mkdirSync(PERSIST_DIR, { recursive: true });
  }
}

// ── Supabase helpers (only called when env vars are set) ──

async function supabaseWrite(key: string, data: unknown): Promise<void> {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/persist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_KEY!,
        "Authorization": `Bearer ${process.env.SUPABASE_KEY!}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }),
    });
  } catch {
    // Fallback to file if Supabase fails
    fileWrite(key, data);
  }
}

async function supabaseRead<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/persist?key=eq.${key}&select=data`,
      {
        headers: {
          "apikey": process.env.SUPABASE_KEY!,
          "Authorization": `Bearer ${process.env.SUPABASE_KEY!}`,
        },
      }
    );
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0].data as T;
    }
    return fallback;
  } catch {
    return fileRead(key, fallback);
  }
}

// ── File helpers (always available as fallback) ──

function fileWrite(key: string, data: unknown): void {
  try {
    ensureDir();
    const safeKey = sanitizeKey(key);
    writeFileSync(join(PERSIST_DIR, `${safeKey}.json`), JSON.stringify(data), "utf-8");
  } catch {
    // Silent fail
  }
}

/** Sanitize key to prevent path traversal (../../../etc/passwd) */
function sanitizeKey(key: string): string {
  // Strip directory separators and parent references
  return key.replace(/[\/\\]/g, "_").replace(/\.\./g, "_");
}

function fileRead<T>(key: string, fallback: T): T {
  try {
    ensureDir();
    const safeKey = sanitizeKey(key);
    const path = join(PERSIST_DIR, `${safeKey}.json`);
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// ── Public API (auto-detects mode) ──

export function persistWrite<T>(key: string, data: T): void {
  if (USE_SUPABASE) {
    supabaseWrite(key, data).catch(() => fileWrite(key, data));
  } else {
    fileWrite(key, data);
  }
}

export function persistRead<T>(key: string, fallback: T): T {
  // Sync read — uses file mode only (Supabase is async)
  // For Supabase reads, use persistReadAsync
  return fileRead(key, fallback);
}

export async function persistReadAsync<T>(key: string, fallback: T): Promise<T> {
  if (USE_SUPABASE) {
    return supabaseRead(key, fallback);
  }
  return fileRead(key, fallback);
}

export function persistAppend<T>(key: string, item: T, maxItems: number = 1000): void {
  const existing = fileRead<T[]>(key, []);
  existing.push(item);
  if (existing.length > maxItems) {
    existing.splice(0, existing.length - maxItems);
  }
  persistWrite(key, existing);
}

export function persistDelete(key: string): void {
  fileWrite(key, []);
  if (USE_SUPABASE) {
    supabaseWrite(key, []).catch(() => {});
  }
}

export function getPersistMode(): string {
  return USE_SUPABASE ? "supabase" : "file";
}

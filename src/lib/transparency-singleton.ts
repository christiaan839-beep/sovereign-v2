/**
 * Process-wide TransparencyLog singleton.
 *
 * Backed by EITHER an in-memory store (the default; deterministic,
 * survives within a single function invocation) OR an Upstash-backed
 * store (when UPSTASH_REDIS_REST_{URL,TOKEN} are configured; durable
 * across function restarts AND consistent across regional replicas).
 *
 * Initialization is lazy + async — the singleton's first request
 * awaits warmup of the persistent backend. Subsequent calls return
 * the cached instance synchronously.
 *
 * Seeding: regardless of backend, the singleton seeds itself once
 * from public/sample-bundle.json so a fresh deployment renders a
 * non-empty STH on day one. Once leaves are persisted in Upstash,
 * subsequent appends accumulate on top.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TransparencyLog,
  InMemoryLogStore,
  type LogStore,
} from "@sovereign-matrix/verifiable-receipts/log-store";
import { leafHash } from "@sovereign-matrix/verifiable-receipts/transparency";
import { createLogger } from "@/lib/logger";
import {
  buildUpstashLogStore,
  isPersistenceEnabled,
} from "@/lib/upstash-log-store";

const log = createLogger("transparency-singleton");

const LOG_ID = "demo.sovereignmatrix.agency";

interface SampleManifest {
  receipts?: Array<{
    id?: string;
    signature?: string;
  }>;
}

let singleton: TransparencyLog | null = null;
let initPromise: Promise<TransparencyLog> | null = null;

function seedFromSampleBundle(tlog: TransparencyLog): void {
  const samplePath = join(process.cwd(), "public", "sample-bundle.json");
  if (!existsSync(samplePath)) {
    log.info("public/sample-bundle.json not present; demo log starts empty");
    return;
  }
  try {
    const raw = readFileSync(samplePath, "utf8");
    const parsed = JSON.parse(raw) as SampleManifest;
    const receipts = Array.isArray(parsed.receipts) ? parsed.receipts : [];
    for (const r of receipts) {
      const identity = `${r.id ?? "anon"}|${r.signature ?? ""}`;
      const hash = leafHash(identity);
      // Only seed if not already present — re-seeding a persistent log
      // would duplicate leaves on every cold-start.
      const existing = tlog.size();
      let present = false;
      for (let i = 0; i < existing; i++) {
        if (tlog.leafAt(i) === hash) {
          present = true;
          break;
        }
      }
      if (!present) {
        tlog.append(hash, { alreadyHashed: true });
      }
    }
  } catch (err) {
    log.warn("Failed to seed demo log from sample-bundle.json", {
      error: String(err),
    });
  }
}

/**
 * Async-init the demo TransparencyLog. Prefers Upstash-backed
 * persistence when configured; falls back to in-memory.
 */
export async function getDemoTransparencyLog(): Promise<TransparencyLog> {
  if (singleton) return singleton;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let store: LogStore = new InMemoryLogStore();
    if (isPersistenceEnabled()) {
      const upstash = await buildUpstashLogStore(LOG_ID);
      if (upstash) {
        store = upstash;
        log.info("Transparency log: using Upstash persistence");
      } else {
        log.warn("Upstash configured but warmup failed — using in-memory");
      }
    } else {
      log.info("Transparency log: using in-memory store (no Upstash config)");
    }
    const tlog = new TransparencyLog(LOG_ID, store);
    seedFromSampleBundle(tlog);
    singleton = tlog;
    return tlog;
  })();

  return initPromise;
}

/**
 * Test helper — clear the singleton + init promise. NEVER call in prod.
 */
export function _resetTransparencySingleton(): void {
  singleton = null;
  initPromise = null;
}

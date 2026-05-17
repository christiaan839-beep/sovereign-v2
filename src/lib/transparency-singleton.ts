/**
 * Process-wide TransparencyLog singleton, pre-seeded with the
 * public sample-bundle receipts at module load.
 *
 * This is the demo log that backs /api/transparency/*. It's
 * intentionally in-memory: serverless deployments don't persist
 * /tmp across invocations, and a public demo endpoint that lies
 * about its tree state (because two replicas seeded differently)
 * would be a regression of the project's central promise. By
 * pre-seeding from a deterministic, public source, every replica
 * boots with the same root.
 *
 * A real, durable transparency log would back the TransparencyLog
 * with a Neon-backed LogStore impl that the platform appends to
 * on every receipt issuance. That work is tracked in the
 * transparency-log spec roadmap as v0.3.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TransparencyLog,
  InMemoryLogStore,
} from "@sovereign-matrix/verifiable-receipts/log-store";
import { leafHash } from "@sovereign-matrix/verifiable-receipts/transparency";
import { createLogger } from "@/lib/logger";

const log = createLogger("transparency-singleton");

interface SampleManifest {
  receipts?: Array<{
    id?: string;
    signature?: string;
  }>;
}

let singleton: TransparencyLog | null = null;

/**
 * Lazy-init the demo TransparencyLog. Reads public/sample-bundle.json
 * and appends each receipt's signature as a leaf — so the demo log's
 * leaves correspond 1:1 with what `/pilot` exposes for download.
 *
 * If the sample bundle is missing (CI without /public), returns an
 * empty log rather than failing. That keeps /api/health/ready green
 * on environments where the bundle hasn't been generated yet.
 */
export function getDemoTransparencyLog(): TransparencyLog {
  if (singleton) return singleton;

  const samplePath = join(process.cwd(), "public", "sample-bundle.json");
  const tlog = new TransparencyLog(
    "demo.sovereignmatrix.agency",
    new InMemoryLogStore(),
  );

  if (existsSync(samplePath)) {
    try {
      const raw = readFileSync(samplePath, "utf8");
      const parsed = JSON.parse(raw) as SampleManifest;
      const receipts = Array.isArray(parsed.receipts) ? parsed.receipts : [];
      for (const r of receipts) {
        const identity = `${r.id ?? "anon"}|${r.signature ?? ""}`;
        tlog.append(leafHash(identity), { alreadyHashed: true });
      }
    } catch (err) {
      // Defensive — never crash the singleton at first use. Log and
      // continue with an empty log so the endpoints stay live.
      log.warn("Failed to seed demo log from sample-bundle.json", {
        error: String(err),
      });
    }
  } else {
    log.info("public/sample-bundle.json not present; demo log starts empty");
  }

  singleton = tlog;
  return tlog;
}

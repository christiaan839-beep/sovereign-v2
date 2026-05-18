/**
 * Append-on-receipt-issuance helper.
 *
 * Glue between the platform's signRun() code path and the demo
 * TransparencyLog. Call this after a receipt has been signed to push
 * its leaf hash onto the public log. Fire-and-forget — if the append
 * fails (Upstash down, replica restart), the receipt itself is still
 * valid + the operator gets a structured warning.
 *
 * Why a separate module: this function MUST NOT be imported by
 * signRun() itself (would create a circular dep). The call site is
 * `src/lib/agent-runs.ts`-adjacent or wherever a receipt is
 * persisted/returned. A future wave wires every issuance through
 * this helper; for now it's an explicit opt-in per call site so we
 * can stage the rollout without breaking the existing receipt API.
 */
import { getDemoTransparencyLog } from "@/lib/transparency-singleton";
import { leafHash } from "@sovereign-matrix/verifiable-receipts/transparency";
import { createLogger } from "@/lib/logger";
import { isPersistenceEnabled } from "@/lib/upstash-log-store";

const log = createLogger("transparency-append");

export interface ReceiptLeaf {
  /** Receipt id (or any stable identifier). */
  id: string;
  /** The signature wire-string (v1=/v2=/v3=...). */
  signature: string;
}

/**
 * Compute the leaf hash that this helper would push for a given
 * receipt. Exposed so a caller can include the leaf hash in their own
 * audit trail BEFORE the async append completes.
 */
export function receiptLeafHash(r: ReceiptLeaf): string {
  return leafHash(`${r.id}|${r.signature}`);
}

/**
 * Push the receipt's leaf hash onto the demo transparency log.
 * Awaits the singleton init but the append itself is best-effort:
 * any throw is logged and swallowed so an Upstash blip never blocks
 * a receipt from being issued.
 *
 * Returns the leaf hash + the (post-append) tree size so the caller
 * can include them in their response payload to the client.
 */
export async function appendReceiptToTransparencyLog(
  r: ReceiptLeaf,
): Promise<{ leafHash: string; treeSize: number; persistent: boolean }> {
  const hash = receiptLeafHash(r);
  try {
    const tlog = await getDemoTransparencyLog();
    tlog.append(hash, { alreadyHashed: true });
    return {
      leafHash: hash,
      treeSize: tlog.size(),
      persistent: isPersistenceEnabled(),
    };
  } catch (err) {
    log.warn("transparency log append failed (receipt still valid)", {
      error: String(err),
      receiptId: r.id,
    });
    return { leafHash: hash, treeSize: 0, persistent: false };
  }
}

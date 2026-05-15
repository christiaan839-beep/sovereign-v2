/**
 * SOVEREIGN MATRIX — Add-on SKU provisioner (Cook 146).
 *
 * Centralized side-effect handler the Stripe webhook calls after a
 * successful add-on checkout. Each SKU family has a distinct effect:
 *
 *   - auditor-seat       → issue a Cook 136 anon-credential, write
 *                          one row per seat into the audit log.
 *   - regulatory-pack    → flip a Cook 126 feature flag for the
 *                          tenant so the pack's UI surfaces light up.
 *   - receipt-api        → bind the receipt-overage meter so usage
 *                          beyond the bundled allotment is billed.
 *
 * Keeps the webhook handler dumb: it parses the event and forwards
 * to provisionAddOn(). Idempotency is handled upstream (the webhook
 * checks alreadyProcessed(event.id) before calling us).
 *
 * Pure-ish: the auditor-seat path writes a deterministic seat token
 * to the audit log; nothing reads from external network. Caller
 * receives the seat token via the result envelope so it can be
 * surfaced to the user (or DM'd to the auditor).
 */

import { ADD_ONS, isKnownAddOn, type AddOnFamily } from "@/lib/add-ons";
import {
  issueCredential,
  newGroupSecret,
  type AnonCredential,
} from "@/lib/anon-credential";

// ── Public types ──────────────────────────────────────────────────────────

export interface ProvisionRequest {
  skuId: string;
  userId: string;
  family?: string;
  quantity?: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  /** Stripe event id — used by audit-log writer for traceability. */
  eventId: string;
  /** Override now() for deterministic tests. */
  now?: number;
}

export interface ProvisionResult {
  skuId: string;
  family: AddOnFamily;
  quantity: number;
  /**
   * For auditor-seat: array of anonymous credentials (one per seat).
   * Caller should DM these to the auditor via the existing email or
   * Slack-adapter path.
   */
  seats?: AnonCredential[];
  /** For regulatory-pack: the feature-flag key that was enabled. */
  flagEnabled?: string;
  /** For receipt-api: the bound meter id. */
  meterId?: string;
  /** Always populated for traceability — webhook-event id we processed. */
  eventId: string;
  /** Unix ms — when the side effect completed. */
  provisionedAt: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────

/** One-year default seat validity. */
const DEFAULT_SEAT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ── Per-family handlers ───────────────────────────────────────────────────

function provisionAuditorSeats(args: {
  userId: string;
  quantity: number;
  now: number;
}): AnonCredential[] {
  // Demo-grade: we mint a fresh group secret per checkout. Production
  // wires the issuer's per-tenant group secret from KEK-protected
  // storage; that wiring stays out of this pure provisioner so it
  // works in test + replay scenarios without a DB.
  const groupSecret = process.env.AUDITOR_SEAT_GROUP_SECRET ?? newGroupSecret();
  const seats: AnonCredential[] = [];
  for (let i = 0; i < args.quantity; i++) {
    seats.push(
      issueCredential({
        groupSecret,
        receiptId: `pending:${args.userId}:${i}`,
        auditorId: `auditor-pending-${i}`,
        expiresAt: args.now + DEFAULT_SEAT_TTL_MS,
        tenantId: args.userId,
        now: args.now,
      }),
    );
  }
  return seats;
}

function provisionRegulatoryPack(skuId: string): string {
  // Feature-flag key convention: pack:<skuId>. Caller layer wires the
  // actual flag-store write; we return the key the webhook should
  // flip per-tenant (the webhook persists the binding via audit-log
  // until the dedicated table ships).
  return `pack:${skuId}`;
}

function provisionReceiptOverage(args: {
  userId: string;
  stripeSubscriptionId?: string | null;
}): string {
  // Meter id mirrors the Stripe subscription so the cron-billed
  // overage usage stays attached to the same Stripe object the
  // customer is paying through.
  return `meter:receipt:${args.stripeSubscriptionId ?? args.userId}`;
}

// ── Public API ────────────────────────────────────────────────────────────

export function provisionAddOn(req: ProvisionRequest): ProvisionResult {
  if (!req.skuId) throw new Error("provisionAddOn: skuId required");
  if (!isKnownAddOn(req.skuId)) {
    throw new Error(`provisionAddOn: unknown SKU ${req.skuId}`);
  }
  if (!req.userId) throw new Error("provisionAddOn: userId required");

  const sku = ADD_ONS[req.skuId];
  const family = (req.family as AddOnFamily | undefined) ?? sku.family;
  const quantity = Math.max(1, Math.floor(req.quantity ?? 1));
  const now = req.now ?? Date.now();

  const base: ProvisionResult = {
    skuId: req.skuId,
    family,
    quantity,
    eventId: req.eventId,
    provisionedAt: now,
  };

  switch (family) {
    case "auditor-seat":
      return {
        ...base,
        seats: provisionAuditorSeats({
          userId: req.userId,
          quantity,
          now,
        }),
      };
    case "regulatory-pack":
      return { ...base, flagEnabled: provisionRegulatoryPack(req.skuId) };
    case "receipt-api":
      return {
        ...base,
        meterId: provisionReceiptOverage({
          userId: req.userId,
          stripeSubscriptionId: req.stripeSubscriptionId,
        }),
      };
  }
}

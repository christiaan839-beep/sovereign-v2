/**
 * Telecom compliance helpers for OUTBOUND voice / SMS.
 *
 * These DO NOT apply to inbound calls (someone called us). They apply
 * to anything that INITIATES a call or SMS to a consumer number.
 *
 * Relevant law (US):
 *   - TCPA §227(b)(1)(A) — prior express consent required for
 *     autodialed/prerecorded calls to cell numbers
 *   - TSR §310.4(b) — Do-Not-Call registry check required before
 *     telemarketing calls to consumer numbers (residential and cell)
 *   - FCC Order 19-73 / AI-voice rule — AI-generated voice must
 *     disclose its nature at the start of every call
 *
 * Non-US: most EU countries require explicit opt-in; POPIA (SA) requires
 * consent; CASL (Canada) requires express consent + identification.
 *
 * THIS MODULE IS A SCAFFOLD. It does not ship a full DNC database.
 * Customers who use our outbound voice/SMS agents must provide their
 * own DNC list upload via /dashboard/settings/dnc (to be built) OR
 * integrate their own DNC lookup service.
 *
 * The intent is that every outbound code path calls `guardOutbound()`
 * before dialing / sending. The guard returns an allow/deny result;
 * the caller MUST respect it.
 */

import { db } from "@/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("telecom-compliance");

export interface GuardResult {
  allow: boolean;
  reason?:
    | "dnc_listed"
    | "no_consent_on_file"
    | "quiet_hours"
    | "test_mode_block"
    | "customer_dnc_not_configured";
  evidence?: Record<string, unknown>;
}

/**
 * Guard function every outbound voice/SMS call MUST pass through.
 *
 *   const guard = await guardOutbound({ userId, phoneE164, kind: "voice" });
 *   if (!guard.allow) throw new Error(`Cannot dial: ${guard.reason}`);
 *
 * Checks (when implemented):
 *   1. Customer-provided DNC list for this tenant
 *   2. Platform-level DNC list (uploaded users who unsubscribed)
 *   3. Quiet hours (21:00–08:00 recipient-local for TSR compliance)
 *   4. Consent table — prior express written consent exists
 *
 * Fail-closed: if any of the data sources errors, we return allow=false
 * with a descriptive reason. Do NOT silently allow the call when the
 * DNC check fails — that's exactly the TCPA violation pattern that
 * generates $500–$1500-per-call statutory damages.
 */
export async function guardOutbound(params: {
  userId: string;
  phoneE164: string;
  kind: "voice" | "sms";
}): Promise<GuardResult> {
  const { userId, phoneE164 } = params;

  // Minimal E.164 shape check — full validation is out of scope but this
  // catches the common "+1 (555) 123-4567" mistake.
  if (!/^\+[1-9]\d{6,14}$/.test(phoneE164)) {
    return { allow: false, reason: "customer_dnc_not_configured", evidence: { phoneE164, note: "invalid E.164 shape" } };
  }

  // Without a configured DNC source, we fail-closed. This is the intended
  // behavior: customers must explicitly opt in to outbound voice/SMS by
  // uploading their DNC list OR configuring a DNC API (Possible, NumVerify,
  // etc) via the dashboard.
  //
  // TODO before shipping any outbound voice agent:
  //   1. Build /dashboard/settings/dnc UI for CSV upload
  //   2. Create `dnc_entries` table (tenant-scoped, RLS-enabled)
  //   3. Query that table here; fall through to allow only if a list
  //      exists for the tenant AND the number isn't on it
  //   4. Integrate a real-time TSR DNC checker for US numbers
  //
  // Until then:
  if (!process.env.DNC_ENABLED) {
    log.warn("guardOutbound called but DNC_ENABLED env not set — denying", {
      userId,
      phoneE164: phoneE164.slice(0, 4) + "***",
    });
    return {
      allow: false,
      reason: "customer_dnc_not_configured",
      evidence: {
        required: "Customer must upload DNC list OR set DNC_ENABLED=1 after configuring an API checker",
      },
    };
  }

  // Placeholder for future real DNC lookup. Expects a
  // `dnc_entries` table with (user_id, phone_e164, source, created_at).
  // Not querying `db` here by design — the caller provides a configured
  // DNC source through future composition.
  void db;

  return { allow: true };
}

/**
 * TCPA / FCC AI disclosure string — use as the first sentence of any
 * outbound AI voice call. Do not remove or shorten; consumers must
 * recognize they're not speaking with a human.
 */
export const AI_VOICE_DISCLOSURE =
  "Hello. This call is handled by an A I assistant — you are not speaking with a human. You can ask to be transferred to a human operator at any time.";

/**
 * CAN-SPAM (US 15 U.S.C. §7704) + EU CASL + POPIA all require:
 *  - physical postal address of the sender
 *  - clear one-click unsubscribe
 *  - no deceptive subject line
 * Call this before sending any outbound email.
 */
export function appendComplianceFooter(bodyHtml: string, params: { email: string }): string {
  const unsubscribe = `https://sovereignmatrix.agency/unsubscribe?email=${encodeURIComponent(params.email)}`;
  const footer = `
    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;" />
    <p style="font-size: 11px; color: #8a8a8a; line-height: 1.6; font-family: system-ui, sans-serif;">
      Sovereign Matrix · Cape Town, South Africa<br />
      You're receiving this because you signed up at sovereignmatrix.agency.
      <br />
      <a href="${unsubscribe}" style="color: #8a8a8a;">Unsubscribe</a> · one-click, no questions.
    </p>
  `.trim();
  return bodyHtml + footer;
}

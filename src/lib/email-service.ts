/**
 * SOVEREIGN MATRIX — Email Deliverability Infrastructure
 *
 * Wraps email sending with deliverability best practices:
 * - Warmup tracking (gradual ramp-up per domain)
 * - Bounce tracking with auto-suppression
 * - Rate limiting (50/hr for new accounts, scaling over 2 weeks)
 * - Bulk sending with template support
 */

import { createLogger } from "@/lib/logger";
import { resendBreaker } from "@/lib/circuit-breaker";
import { appendComplianceFooter } from "@/lib/telecom-compliance";

const log = createLogger("email-service");

// ── Types ──

export interface EmailOptions {
  replyTo?: string;
  from?: string;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  reason?: string;
}

export interface BulkEmailResult {
  success: boolean;
  sent: number;
  failed: number;
  suppressed: number;
  results: EmailResult[];
}

export interface EmailTemplate {
  subject: string;
  html: string;
  /** Placeholders like {{name}}, {{company}} will be replaced per-recipient */
  placeholders?: Record<string, string>;
}

export interface BulkRecipient {
  email: string;
  data?: Record<string, string>;
}

// ── In-Memory Tracking Stores ──
// In production, these would be backed by a database.

interface DomainSendRecord {
  domain: string;
  date: string;
  count: number;
}

interface BounceRecord {
  email: string;
  count: number;
  lastBounce: string;
}

const domainSendLog: DomainSendRecord[] = [];
const bounceLog: Map<string, BounceRecord> = new Map();
const suppressionList: Set<string> = new Set();

/** Tracks total sends for rate limiting (resets hourly) */
let hourlySendCount = 0;
let hourlySendResetAt = Date.now() + 3_600_000;

/** Account age in days — controls warmup rate limit scaling */
const ACCOUNT_CREATED_AT = new Date(process.env.EMAIL_ACCOUNT_CREATED_AT || Date.now().toString());

// ── Warmup Configuration ──

const WARMUP_SCHEDULE: Record<number, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 100,
  5: 150,
  6: 200,
  7: 300,
  8: 400,
  9: 500,
  10: 700,
  11: 900,
  12: 1200,
  13: 1500,
  14: 2000,
};

const MAX_BOUNCES_BEFORE_SUPPRESS = 2;
const BASE_HOURLY_LIMIT = 50;

// ── Helpers ──

function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}

function getDomainFromEmail(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "unknown";
}

function getAccountAgeDays(): number {
  const now = new Date();
  const diff = now.getTime() - ACCOUNT_CREATED_AT.getTime();
  return Math.max(1, Math.floor(diff / 86_400_000));
}

function getCurrentHourlyLimit(): number {
  const ageDays = getAccountAgeDays();
  if (ageDays >= 14) return 2000;
  return WARMUP_SCHEDULE[ageDays] ?? BASE_HOURLY_LIMIT;
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getDomainSendsToday(domain: string): number {
  const today = getTodayKey();
  const record = domainSendLog.find((r) => r.domain === domain && r.date === today);
  return record?.count ?? 0;
}

function recordDomainSend(domain: string): void {
  const today = getTodayKey();
  const record = domainSendLog.find((r) => r.domain === domain && r.date === today);
  if (record) {
    record.count++;
  } else {
    domainSendLog.push({ domain, date: today, count: 1 });
  }
}

function resetHourlyCounterIfNeeded(): void {
  if (Date.now() >= hourlySendResetAt) {
    hourlySendCount = 0;
    hourlySendResetAt = Date.now() + 3_600_000;
  }
}

function applyTemplate(html: string, data: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ── Bounce Management ──

export function recordBounce(email: string): void {
  const existing = bounceLog.get(email);
  if (existing) {
    existing.count++;
    existing.lastBounce = new Date().toISOString();
    if (existing.count >= MAX_BOUNCES_BEFORE_SUPPRESS) {
      suppressionList.add(email);
      log.warn("Email suppressed after repeated bounces", { email: email.slice(0, 4) + "***", bounces: existing.count });
    }
  } else {
    bounceLog.set(email, { email, count: 1, lastBounce: new Date().toISOString() });
  }
}

export function isSuppressed(email: string): boolean {
  return suppressionList.has(email);
}

export function getSuppressionList(): string[] {
  return Array.from(suppressionList);
}

// ── Core Send Function ──

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: EmailOptions = {}
): Promise<EmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { success: false, reason: "RESEND_API_KEY not configured" };
  }

  // Check suppression
  if (isSuppressed(to)) {
    return { success: false, reason: "Recipient is on the suppression list (repeated bounces)" };
  }

  // Rate limiting
  resetHourlyCounterIfNeeded();
  const hourlyLimit = getCurrentHourlyLimit();
  if (hourlySendCount >= hourlyLimit) {
    return { success: false, reason: `Hourly send limit reached (${hourlyLimit}/hr). Retry next hour.` };
  }

  // Warmup tracking: limit sends per domain per day
  const domain = getDomainFromEmail(to);
  const domainSendsToday = getDomainSendsToday(domain);
  const ageDays = getAccountAgeDays();
  const domainDailyLimit = ageDays >= 14 ? 500 : Math.min(50, ageDays * 5);

  if (domainSendsToday >= domainDailyLimit) {
    return {
      success: false,
      reason: `Domain warmup limit reached for ${domain} (${domainDailyLimit}/day). Sending more tomorrow.`,
    };
  }

  // Send via Resend API — wrapped in a circuit breaker so 3 consecutive
  // failures open the circuit for 30s, preventing cascading slowness
  // when Resend has a regional outage.
  try {
    const response = await resendBreaker.execute(() =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        // Resend p99 ~2s; hard-cap at 8s to prevent Vercel function timeout.
        signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from || process.env.EMAIL_FROM || "Sovereign Matrix <noreply@sovereign.email>",
          to,
          subject,
          // CAN-SPAM / CASL / POPIA compliance: every outbound email
          // includes the sender's physical address and a one-click
          // unsubscribe link. Helper is in src/lib/telecom-compliance.
          html: appendComplianceFooter(html, { email: to }),
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
          ...(options.tags ? { tags: options.tags.map((t) => ({ name: t })) } : {}),
          ...(options.headers ? { headers: options.headers } : {}),
        }),
      }),
    );

    if (!response.ok) {
      const errorBody = await response.text();
      log.error("Resend API error", { status: response.status, body: errorBody });

      // Check for bounce indication
      if (response.status === 400 && errorBody.includes("bounce")) {
        recordBounce(to);
      }

      return { success: false, reason: `Resend API returned ${response.status}` };
    }

    const data = (await response.json()) as { id?: string };

    // Track successful send
    hourlySendCount++;
    recordDomainSend(domain);

    log.info("Email sent", { to: to.slice(0, 4) + "***", domain, messageId: data.id });

    return { success: true, messageId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Email send failed", { error: message });
    return { success: false, reason: message };
  }
}

// ── Bulk Send Function ──

export async function sendBulkEmail(
  recipients: BulkRecipient[],
  template: EmailTemplate
): Promise<BulkEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      success: false,
      sent: 0,
      failed: recipients.length,
      suppressed: 0,
      results: recipients.map(() => ({ success: false, reason: "RESEND_API_KEY not configured" })),
    };
  }

  const results: EmailResult[] = [];
  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const recipient of recipients) {
    // Check suppression before sending
    if (isSuppressed(recipient.email)) {
      results.push({ success: false, reason: "Suppressed" });
      suppressed++;
      continue;
    }

    // Apply per-recipient template placeholders
    const mergedData = { ...template.placeholders, ...recipient.data };
    const personalizedHtml = applyTemplate(template.html, mergedData);
    const personalizedSubject = applyTemplate(template.subject, mergedData);

    const result = await sendEmail(recipient.email, personalizedSubject, personalizedHtml);
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Small delay between sends to avoid burst detection
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    success: failed === 0 && suppressed === 0,
    sent,
    failed,
    suppressed,
    results,
  };
}

// ── Diagnostics ──

export function getDeliverabilityStats(): {
  accountAgeDays: number;
  currentHourlyLimit: number;
  hourlySendsUsed: number;
  suppressedAddresses: number;
  bouncedAddresses: number;
} {
  resetHourlyCounterIfNeeded();
  return {
    accountAgeDays: getAccountAgeDays(),
    currentHourlyLimit: getCurrentHourlyLimit(),
    hourlySendsUsed: hourlySendCount,
    suppressedAddresses: suppressionList.size,
    bouncedAddresses: bounceLog.size,
  };
}

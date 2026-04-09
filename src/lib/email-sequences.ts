/**
 * SOVEREIGN MATRIX — Email Sequence Trigger Engine
 *
 * Handles trigger-based email sequences: when an event fires (stripe_checkout,
 * lead_qualified, booking_confirmed, or manual), this engine finds all active
 * sequences matching that trigger, enqueues every step, and sends emails via
 * Resend. Steps with delayDays > 0 are stored with a calculated sendAt
 * timestamp for a cron job to pick up later.
 */

import { db } from "@/db";
import { emailSequences, sequenceSteps } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { createLogger } from "@/lib/logger";

const log = createLogger("email-sequences");

// ─── Types ────────────────────────────────────────────────────

export interface QueuedStep {
  stepId: string;
  sequenceId: string;
  sequenceName: string;
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  sendAt: Date;
  recipientEmail: string;
}

export interface SequenceWithSteps {
  id: string;
  name: string;
  trigger: string;
  status: string;
  totalSteps: string | null;
  createdAt: Date | null;
  steps: {
    id: string;
    stepNumber: string;
    subject: string;
    body: string;
    delayDays: string;
    createdAt: Date | null;
  }[];
}

// ─── Graceful 42P01 Handler ───────────────────────────────────

function isTableMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("42P01") || msg.includes("does not exist");
}

// ─── triggerSequence ──────────────────────────────────────────

/**
 * Find all active sequences matching the given trigger for the user,
 * then queue (and optionally send) every step.
 *
 * Steps with delayDays === 0 are sent immediately.
 * Steps with delayDays > 0 return a QueuedStep with a sendAt timestamp
 * for a cron job to process later.
 *
 * @returns Array of queued steps (including those already sent)
 */
export async function triggerSequence(
  userEmail: string,
  trigger: string
): Promise<{ sent: number; queued: QueuedStep[] }> {
  try {
    // 1. Find active sequences matching this trigger for this user
    const sequences = await db
      .select()
      .from(emailSequences)
      .where(
        and(
          eq(emailSequences.userEmail, userEmail),
          eq(emailSequences.trigger, trigger),
          eq(emailSequences.status, "active")
        )
      );

    if (sequences.length === 0) {
      log.debug("No active sequences found for trigger", { userEmail, trigger });
      return { sent: 0, queued: [] };
    }

    let totalSent = 0;
    const allQueued: QueuedStep[] = [];
    const now = new Date();

    for (const seq of sequences) {
      // 2. Fetch steps for each sequence, ordered by stepNumber
      const steps = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, seq.id))
        .orderBy(asc(sequenceSteps.stepNumber));

      if (steps.length === 0) continue;

      // 3. Accumulate delay days to compute absolute send times
      let cumulativeDelayDays = 0;

      for (const step of steps) {
        const delayDays = parseInt(step.delayDays, 10) || 0;
        cumulativeDelayDays += delayDays;

        const sendAt = new Date(now.getTime() + cumulativeDelayDays * 86_400_000);

        const queued: QueuedStep = {
          stepId: step.id,
          sequenceId: seq.id,
          sequenceName: seq.name,
          stepNumber: parseInt(step.stepNumber, 10) || 1,
          subject: step.subject,
          body: step.body,
          delayDays: cumulativeDelayDays,
          sendAt,
          recipientEmail: userEmail,
        };

        allQueued.push(queued);

        // Send immediately if no cumulative delay
        if (cumulativeDelayDays === 0) {
          const result = await processSequenceStep(step.id, userEmail);
          if (result.success) totalSent++;
        }
      }
    }

    log.info("Sequence triggered", {
      userEmail,
      trigger,
      sequencesMatched: sequences.length,
      stepsSent: totalSent,
      stepsQueued: allQueued.length - totalSent,
    });

    return { sent: totalSent, queued: allQueued };
  } catch (err) {
    if (isTableMissing(err)) {
      log.warn("email_sequences table not yet created — skipping trigger");
      return { sent: 0, queued: [] };
    }
    log.error("Failed to trigger sequence", {
      error: err instanceof Error ? err.message : "unknown",
      userEmail,
      trigger,
    });
    throw err;
  }
}

// ─── processSequenceStep ──────────────────────────────────────

/**
 * Send a single sequence step email via Resend.
 * Called immediately for delayDays=0 steps, or by the cron job for delayed steps.
 */
export async function processSequenceStep(
  stepId: string,
  recipientEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the step with its sequence info
    const [step] = await db
      .select({
        id: sequenceSteps.id,
        subject: sequenceSteps.subject,
        body: sequenceSteps.body,
        stepNumber: sequenceSteps.stepNumber,
        sequenceId: sequenceSteps.sequenceId,
      })
      .from(sequenceSteps)
      .where(eq(sequenceSteps.id, stepId))
      .limit(1);

    if (!step) {
      log.warn("Sequence step not found", { stepId });
      return { success: false, error: "Step not found" };
    }

    // Fetch the parent sequence to check it's still active
    const [sequence] = await db
      .select({ status: emailSequences.status, name: emailSequences.name })
      .from(emailSequences)
      .where(eq(emailSequences.id, step.sequenceId))
      .limit(1);

    if (!sequence || sequence.status !== "active") {
      log.info("Sequence no longer active — skipping step", {
        stepId,
        sequenceId: step.sequenceId,
        status: sequence?.status,
      });
      return { success: false, error: "Sequence is not active" };
    }

    // Send via Resend using the shared email utility
    const result = await sendEmail({
      to: recipientEmail,
      subject: step.subject,
      html: step.body,
      from: process.env.RESEND_FROM_EMAIL || "Sovereign Matrix <hello@sovereignmatrix.agency>",
    });

    if (result.success) {
      log.info("Sequence step sent", {
        stepId,
        stepNumber: step.stepNumber,
        sequenceName: sequence.name,
        recipient: recipientEmail,
        resendId: result.id,
      });
    } else {
      log.error("Sequence step send failed", {
        stepId,
        error: result.error,
        recipient: recipientEmail,
      });
    }

    return { success: result.success, error: result.error };
  } catch (err) {
    if (isTableMissing(err)) {
      log.warn("sequence_steps table not yet created");
      return { success: false, error: "Table not migrated" };
    }
    const message = err instanceof Error ? err.message : "unknown";
    log.error("processSequenceStep crashed", { stepId, error: message });
    return { success: false, error: message };
  }
}

// ─── getActiveSequences ───────────────────────────────────────

/**
 * Return all sequences owned by this user, each with its steps attached.
 */
export async function getActiveSequences(
  userEmail: string
): Promise<SequenceWithSteps[]> {
  try {
    const sequences = await db
      .select()
      .from(emailSequences)
      .where(eq(emailSequences.userEmail, userEmail))
      .orderBy(asc(emailSequences.createdAt));

    if (sequences.length === 0) return [];

    const result: SequenceWithSteps[] = [];

    for (const seq of sequences) {
      const steps = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, seq.id))
        .orderBy(asc(sequenceSteps.stepNumber));

      result.push({
        id: seq.id,
        name: seq.name,
        trigger: seq.trigger,
        status: seq.status,
        totalSteps: seq.totalSteps,
        createdAt: seq.createdAt,
        steps: steps.map((s) => ({
          id: s.id,
          stepNumber: s.stepNumber,
          subject: s.subject,
          body: s.body,
          delayDays: s.delayDays,
          createdAt: s.createdAt,
        })),
      });
    }

    return result;
  } catch (err) {
    if (isTableMissing(err)) {
      log.warn("email_sequences table not yet created — returning empty");
      return [];
    }
    throw err;
  }
}

/**
 * SOVEREIGN MATRIX — Referral System
 *
 * "Invite a friend, both get 50 free runs."
 *
 * Generates unique referral codes, tracks invites, and awards
 * bonus runs to both the referrer and the new user.
 *
 * In-memory store — back with a database in production.
 */

import { addBonusRuns, REFERRAL_BONUS_RUNS } from "@/lib/free-tier";

// ── Constants ──

const BONUS_RUNS_PER_REFERRAL = REFERRAL_BONUS_RUNS; // 50

// ── Types ──

export interface ReferralResult {
  success: boolean;
  bonusRuns: number;
  error?: string;
}

export interface ReferralStats {
  code: string;
  invites: number;
  bonusEarned: number;
}

interface ReferralRecord {
  /** The user who owns the referral code */
  referrerId: string;
  /** User IDs who signed up with this code */
  referees: string[];
  /** Total bonus runs earned from referrals */
  bonusEarned: number;
}

// ── In-Memory Stores ──

/** Maps referral code → referral record */
const referralStore = new Map<string, ReferralRecord>();

/** Maps userId → their referral code */
const userCodeStore = new Map<string, string>();

/** Tracks which users have already been referred (cannot use a code twice) */
const redeemedUsers = new Set<string>();

// ── Helpers ──

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "SV-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Public API ──

/**
 * Generate (or retrieve) a unique referral code for a user.
 * Calling multiple times for the same user returns the same code.
 */
export function generateReferralCode(userId: string): string {
  const existing = userCodeStore.get(userId);
  if (existing) return existing;

  // Generate a unique code (retry on collision)
  let code = generateCode();
  let attempts = 0;
  while (referralStore.has(code) && attempts < 10) {
    code = generateCode();
    attempts++;
  }

  userCodeStore.set(userId, code);
  referralStore.set(code, {
    referrerId: userId,
    referees: [],
    bonusEarned: 0,
  });

  return code;
}

/**
 * Apply a referral code for a new user.
 * Awards bonus runs to both the referrer and the new user.
 *
 * Returns { success: true, bonusRuns: 50 } on success.
 * Returns { success: false, bonusRuns: 0, error: "..." } on failure.
 */
export function applyReferral(
  newUserId: string,
  referralCode: string
): ReferralResult {
  // Validate: user hasn't already redeemed a code
  if (redeemedUsers.has(newUserId)) {
    return {
      success: false,
      bonusRuns: 0,
      error: "You have already used a referral code.",
    };
  }

  // Validate: code exists
  const record = referralStore.get(referralCode.toUpperCase());
  if (!record) {
    return {
      success: false,
      bonusRuns: 0,
      error: "Invalid referral code.",
    };
  }

  // Validate: can't refer yourself
  if (record.referrerId === newUserId) {
    return {
      success: false,
      bonusRuns: 0,
      error: "You cannot use your own referral code.",
    };
  }

  // Award bonus runs to both parties
  addBonusRuns(record.referrerId, BONUS_RUNS_PER_REFERRAL);
  addBonusRuns(newUserId, BONUS_RUNS_PER_REFERRAL);

  // Update tracking
  record.referees.push(newUserId);
  record.bonusEarned += BONUS_RUNS_PER_REFERRAL;
  redeemedUsers.add(newUserId);

  return {
    success: true,
    bonusRuns: BONUS_RUNS_PER_REFERRAL,
  };
}

/**
 * Get referral statistics for a user.
 * If the user has no code yet, one is generated automatically.
 */
export function getReferralStats(userId: string): ReferralStats {
  const code = generateReferralCode(userId);
  const record = referralStore.get(code);

  return {
    code,
    invites: record?.referees.length ?? 0,
    bonusEarned: record?.bonusEarned ?? 0,
  };
}

/**
 * Tests for src/lib/lead-scorer.ts — lead prioritization business logic
 *
 * The scoring algorithm decides which leads get called immediately vs.
 * nurtured vs. enriched-before-outreach. Every reward/penalty encoded here
 * is a business decision about what signals are valuable. Changing a
 * weight without updating these tests risks silent drift in how the
 * sales team allocates attention.
 *
 * Score reference (applied additively, then clamped 0-100):
 *   Contact:    both email+phone +20, one +10, neither -10
 *   Business:   has name +10, missing -10
 *   Source:     referral/inbound +15, organic/website +8, paid +5
 *   External:   score * 20/100 (capped at 20)
 *   Recency:    <=7d +10, 8-30d +3, >30d 0
 *   Notes:      +15
 *   Status:     qualified +10, booked +8, contacted +5, lost -15
 *   Name miss:  -10
 *
 * Tier boundaries: hot (>=70), warm (40-69), cold (<40)
 *
 * NOTE: Because the score clamps to 0 at the floor, delta-based tests
 * use a SAFE BASELINE (+20 contacts + +10 biz = 30) so added/subtracted
 * signals land in the middle of the 0-100 range and don't get masked
 * by clamping.
 */
import type { LeadInput } from "@/lib/lead-scorer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scoreLead } from "@/lib/lead-scorer";

// Non-clamped baseline: +20 contacts + +10 biz = 30
const BASE: LeadInput = {
  name: "Test",
  email: "a@b.com",
  phone: "555-1234",
  businessName: "Acme",
};

describe("scoreLead", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("contact completeness", () => {
    it("awards +20 for both email and phone", () => {
      const result = scoreLead({ name: "Alice", email: "a@b.com", phone: "555-1234", businessName: "B" });
      expect(result.signals.some(s => s.includes("full contact"))).toBe(true);
      // +20 contacts + +10 biz = 30
      expect(result.score).toBe(30);
    });

    it("awards +10 for email only (half the reward of both)", () => {
      const both = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234", businessName: "B" });
      const emailOnly = scoreLead({ name: "A", email: "a@b.com", businessName: "B" });
      expect(both.score - emailOnly.score).toBe(10);
      expect(emailOnly.signals.some(s => s.includes("email only"))).toBe(true);
    });

    it("awards +10 for phone only (half the reward of both)", () => {
      const both = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234", businessName: "B" });
      const phoneOnly = scoreLead({ name: "A", phone: "555-1234", businessName: "B" });
      expect(both.score - phoneOnly.score).toBe(10);
      expect(phoneOnly.signals.some(s => s.includes("phone only"))).toBe(true);
    });

    it("penalizes -10 for missing both (30 point swing from +20)", () => {
      const withBoth = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234", businessName: "B" });
      const noContacts = scoreLead({ name: "A", businessName: "B" });
      // both (+20) vs neither (-10) = 30 point swing
      expect(withBoth.score - noContacts.score).toBe(30);
      expect(noContacts.signals.some(s => s.includes("critical data gap"))).toBe(true);
    });

    it("treats whitespace-only email as missing", () => {
      const result = scoreLead({ name: "A", email: "   ", businessName: "B" });
      expect(result.signals.some(s => s.includes("critical data gap"))).toBe(true);
    });

    it("treats null email as missing", () => {
      const result = scoreLead({ name: "A", email: null, businessName: "B" });
      expect(result.signals.some(s => s.includes("critical data gap"))).toBe(true);
    });
  });

  describe("business name", () => {
    it("awards +10 for business name (20 point swing vs missing)", () => {
      const withBiz = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234", businessName: "Acme" });
      const noBiz = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234" });
      // +10 vs -10 = 20
      expect(withBiz.score - noBiz.score).toBe(20);
    });

    it("penalizes -10 for missing business name", () => {
      const result = scoreLead({ name: "A", email: "a@b.com", phone: "555-1234" });
      expect(result.signals.some(s => s.includes("No company name"))).toBe(true);
    });
  });

  describe("source quality", () => {
    it("awards +15 for referral source", () => {
      const ref = scoreLead({ ...BASE, source: "referral" });
      expect(ref.score - 30).toBe(15); // 30 baseline
    });

    it("awards +15 for inbound source", () => {
      const inb = scoreLead({ ...BASE, source: "inbound" });
      expect(inb.score - 30).toBe(15);
    });

    it("awards +8 for organic source", () => {
      const org = scoreLead({ ...BASE, source: "organic" });
      expect(org.score - 30).toBe(8);
    });

    it("awards +8 for website source", () => {
      const web = scoreLead({ ...BASE, source: "website" });
      expect(web.score - 30).toBe(8);
    });

    it("awards +5 for paid source", () => {
      const paid = scoreLead({ ...BASE, source: "paid" });
      expect(paid.score - 30).toBe(5);
    });

    it("awards 0 for unknown source", () => {
      const unknown = scoreLead({ ...BASE, source: "cold-outbound" });
      expect(unknown.score).toBe(30);
    });

    it("is case-insensitive on source", () => {
      const ref = scoreLead({ ...BASE, source: "REFERRAL" });
      expect(ref.signals.some(s => s.includes("High-intent source"))).toBe(true);
      expect(ref.score - 30).toBe(15);
    });
  });

  describe("external score normalization", () => {
    it("normalizes 100 to +20", () => {
      const withExt = scoreLead({ ...BASE, score: "100" });
      expect(withExt.score - 30).toBe(20);
    });

    it("normalizes 50 to +10", () => {
      const withExt = scoreLead({ ...BASE, score: "50" });
      expect(withExt.score - 30).toBe(10);
    });

    it("caps at 20 even when external > 100", () => {
      const withExt = scoreLead({ ...BASE, score: "999" });
      expect(withExt.score - 30).toBe(20);
    });

    it("skips normalization when external is 0 or unparseable", () => {
      const zeroExt = scoreLead({ ...BASE, score: "0" });
      const badExt = scoreLead({ ...BASE, score: "not-a-number" });
      expect(zeroExt.score).toBe(30);
      expect(badExt.score).toBe(30);
    });
  });

  describe("recency scoring", () => {
    it("awards +10 for leads created today", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
      const lead = scoreLead({ ...BASE, createdAt: new Date("2026-04-05T08:00:00Z") });
      expect(lead.score - 30).toBe(10);
      expect(lead.signals.some(s => s.includes("today"))).toBe(true);
    });

    it("awards +10 for leads 7 days old", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-10T12:00:00Z"));
      const lead = scoreLead({ ...BASE, createdAt: new Date("2026-04-03T12:00:00Z") });
      expect(lead.score - 30).toBe(10);
    });

    it("awards +3 for leads 8-30 days old", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-05T00:00:00Z"));
      const lead = scoreLead({ ...BASE, createdAt: new Date("2026-03-20T00:00:00Z") });
      expect(lead.score - 30).toBe(3);
      expect(lead.signals.some(s => s.includes("stale"))).toBe(true);
    });

    it("awards 0 for leads >30 days old", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-05T00:00:00Z"));
      const lead = scoreLead({ ...BASE, createdAt: new Date("2026-01-01T00:00:00Z") });
      expect(lead.score - 30).toBe(0);
      expect(lead.signals.some(s => s.includes("Aged lead"))).toBe(true);
    });

    it("accepts Date and ISO string interchangeably", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
      const fromDate = scoreLead({ ...BASE, createdAt: new Date("2026-04-05T08:00:00Z") });
      const fromString = scoreLead({ ...BASE, createdAt: "2026-04-05T08:00:00Z" });
      expect(fromDate.score).toBe(fromString.score);
    });
  });

  describe("notes / interaction history", () => {
    it("awards +15 when notes are present", () => {
      const withNotes = scoreLead({ ...BASE, notes: "Followed up after webinar" });
      expect(withNotes.score - 30).toBe(15);
    });

    it("treats whitespace-only notes as missing", () => {
      const blank = scoreLead({ ...BASE, notes: "   " });
      expect(blank.score).toBe(30);
    });
  });

  describe("status qualification", () => {
    it("awards +10 for qualified", () => {
      const q = scoreLead({ ...BASE, status: "qualified" });
      expect(q.score - 30).toBe(10);
    });

    it("awards +8 for booked", () => {
      const b = scoreLead({ ...BASE, status: "booked" });
      expect(b.score - 30).toBe(8);
    });

    it("awards +5 for contacted", () => {
      const c = scoreLead({ ...BASE, status: "contacted" });
      expect(c.score - 30).toBe(5);
    });

    it("penalizes -15 for lost", () => {
      const l = scoreLead({ ...BASE, status: "lost" });
      expect(l.score - 30).toBe(-15);
    });
  });

  describe("name penalty", () => {
    it("penalizes -10 for missing name (10 point swing)", () => {
      const named = scoreLead({ ...BASE, name: "Alice" });
      const unnamed = scoreLead({ ...BASE, name: "" });
      expect(named.score - unnamed.score).toBe(10);
    });

    it("treats whitespace-only name as missing", () => {
      const result = scoreLead({ ...BASE, name: "   " });
      expect(result.signals.some(s => s.includes("Missing lead name"))).toBe(true);
    });
  });

  describe("score clamping", () => {
    it("clamps to max 100", () => {
      // Stack every positive signal
      const result = scoreLead({
        name: "Alice",
        email: "a@b.com",
        phone: "555-1234",
        businessName: "Acme",
        source: "referral",
        score: "100",
        notes: "history",
        status: "qualified",
      });
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("clamps to min 0", () => {
      const result = scoreLead({
        name: "",
        status: "lost",
      });
      // name (-10) + no-contacts (-10) + no-biz (-10) + lost (-15) = -45 → 0
      expect(result.score).toBe(0);
      expect(result.tier).toBe("cold");
    });
  });

  describe("tier boundaries", () => {
    it("tier='hot' at score >= 70", () => {
      const result = scoreLead({
        name: "A",
        email: "a@b.com",
        phone: "555-1234",
        businessName: "Acme",
        source: "referral",
        notes: "Follow-up",
        status: "qualified",
      });
      // 20 + 10 + 15 + 15 + 10 = 70
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.tier).toBe("hot");
    });

    it("tier='warm' at score 40-69", () => {
      const result = scoreLead({
        name: "A",
        email: "a@b.com",
        phone: "555-1234",
        businessName: "B",
        source: "referral",
      });
      // 20 + 10 + 15 = 45 → warm
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.tier).toBe("warm");
    });

    it("tier='cold' at score < 40", () => {
      const result = scoreLead({ name: "" });
      expect(result.score).toBeLessThan(40);
      expect(result.tier).toBe("cold");
    });
  });

  describe("nextAction recommendation", () => {
    it("recommends 'Call immediately' at score >= 80", () => {
      const result = scoreLead({
        name: "Alice",
        email: "a@b.com",
        phone: "555-1234",
        businessName: "Acme",
        source: "referral",
        score: "100",
        notes: "hot",
        status: "qualified",
      });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.nextAction.toLowerCase()).toContain("call immediately");
    });

    it("recommends 'Enrich data' at score < 40", () => {
      const result = scoreLead({ name: "" });
      expect(result.score).toBeLessThan(40);
      expect(result.nextAction.toLowerCase()).toContain("enrich");
    });
  });

  describe("deterministic behavior", () => {
    it("produces identical output for identical input (pure function)", () => {
      const input = {
        name: "A",
        email: "a@b.com",
        businessName: "Acme",
        source: "referral",
        status: "qualified",
      };
      const r1 = scoreLead(input);
      const r2 = scoreLead(input);
      expect(r1.score).toBe(r2.score);
      expect(r1.tier).toBe(r2.tier);
      expect(r1.signals).toEqual(r2.signals);
      expect(r1.nextAction).toBe(r2.nextAction);
    });
  });
});

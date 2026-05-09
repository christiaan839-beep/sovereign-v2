// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// "lead intent scoring" claim; not wired.
// ─── Types ──────────────────────────────────────────────────

export interface LeadInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  source?: string | null;
  status?: string | null;
  score?: string | null;
  notes?: string | null;
  createdAt?: Date | string | null;
}

export interface LeadScore {
  score: number; // 0-100
  tier: "hot" | "warm" | "cold";
  signals: string[];
  nextAction: string;
}

// ─── Scoring Algorithm ──────────────────────────────────────

export function scoreLead(lead: LeadInput): LeadScore {
  let score = 0;
  const signals: string[] = [];

  // ── Contact completeness ──────────────────────────────────
  const hasEmail = !!lead.email && lead.email.trim().length > 0;
  const hasPhone = !!lead.phone && lead.phone.trim().length > 0;

  if (hasEmail && hasPhone) {
    score += 20;
    signals.push("Has both email and phone — full contact data");
  } else if (hasEmail) {
    score += 10;
    signals.push("Has email only");
  } else if (hasPhone) {
    score += 10;
    signals.push("Has phone only");
  } else {
    score -= 10;
    signals.push("Missing both email and phone — critical data gap");
  }

  // ── Business name ─────────────────────────────────────────
  if (lead.businessName && lead.businessName.trim().length > 0) {
    score += 10;
    signals.push("Company name identified");
  } else {
    score -= 10;
    signals.push("No company name — harder to personalize outreach");
  }

  // ── Source quality ────────────────────────────────────────
  const source = (lead.source || "").toLowerCase();
  if (source === "referral" || source === "inbound") {
    score += 15;
    signals.push(`High-intent source: ${source}`);
  } else if (source === "organic" || source === "website") {
    score += 8;
    signals.push(`Organic traffic source: ${source}`);
  } else if (source === "paid") {
    score += 5;
    signals.push("Paid acquisition — intent varies");
  }

  // ── External score (if provided) ──────────────────────────
  const externalScore = parseInt(lead.score || "0", 10);
  if (externalScore > 0) {
    const normalizedExternal = Math.min(Math.round((externalScore / 100) * 20), 20);
    score += normalizedExternal;
    signals.push(`External enrichment score: ${externalScore}/100 (+${normalizedExternal})`);
  }

  // ── Recency (created in last 7 days) ──────────────────────
  if (lead.createdAt) {
    const createdDate = typeof lead.createdAt === "string" ? new Date(lead.createdAt) : lead.createdAt;
    const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation <= 7) {
      score += 10;
      signals.push(`Fresh lead — created ${daysSinceCreation === 0 ? "today" : `${daysSinceCreation}d ago`}`);
    } else if (daysSinceCreation <= 30) {
      score += 3;
      signals.push(`Created ${daysSinceCreation}d ago — getting stale`);
    } else {
      signals.push(`Aged lead — ${daysSinceCreation}d old`);
    }
  }

  // ── Notes / interactions ──────────────────────────────────
  if (lead.notes && lead.notes.trim().length > 0) {
    score += 15;
    signals.push("Has notes/interaction history");
  }

  // ── Status qualification ──────────────────────────────────
  const status = (lead.status || "").toLowerCase();
  if (status === "qualified") {
    score += 10;
    signals.push("Status: qualified — vetted and ready");
  } else if (status === "booked") {
    score += 8;
    signals.push("Status: booked — appointment set");
  } else if (status === "contacted") {
    score += 5;
    signals.push("Status: contacted — in conversation");
  } else if (status === "lost") {
    score -= 15;
    signals.push("Status: lost — previously closed out");
  }

  // ── Missing critical fields penalty ───────────────────────
  if (!lead.name || lead.name.trim().length === 0) {
    score -= 10;
    signals.push("Missing lead name");
  }

  // ── Clamp score to 0-100 ──────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Determine tier ────────────────────────────────────────
  let tier: LeadScore["tier"];
  if (score >= 70) tier = "hot";
  else if (score >= 40) tier = "warm";
  else tier = "cold";

  // ── Next action recommendation ────────────────────────────
  let nextAction: string;
  if (score >= 80) {
    nextAction = "Call immediately \u2014 hot lead with strong signals";
  } else if (score >= 60) {
    nextAction = "Send personalized email sequence";
  } else if (score >= 40) {
    nextAction = "Add to nurture campaign";
  } else {
    nextAction = "Enrich data before outreach";
  }

  return { score, tier, signals, nextAction };
}

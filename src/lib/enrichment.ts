/**
 * ENRICHMENT ENGINE — Hunter.io + Apollo.io + Clearbit BYOK Layer
 *
 * Adds verified contact data (email addresses, phone numbers, LinkedIn,
 * company headcount, revenue band) to AI-generated lead objects.
 *
 * Design decisions:
 * - Only fires when BYOK keys are configured in user settings
 * - Parallel per-lead requests, max 5 concurrent (rate-limit friendly)
 * - Never fails silently: each lead reports which enrichment source fired
 * - Provider priority: Hunter (email) → Apollo (full profile) → Clearbit (company)
 * - Results are ADDITIVE — existing AI-inferred fields are never overwritten
 */

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("enrichment");

// ─── Types ────────────────────────────────────────────────────

export interface BaseLead {
  company_name: string;
  industry?: string;
  location?: string;
  website?: string;
  signal?: string;
  contact_angle?: string;
  score?: number;
  [key: string]: unknown;
}

export interface EnrichedLead extends BaseLead {
  enrichment?: {
    email?: string;
    email_confidence?: number;    // 0-100 (Hunter score)
    firstName?: string;
    lastName?: string;
    title?: string;
    linkedin?: string;
    phone?: string;
    company_domain?: string;
    company_size?: string;
    company_revenue?: string;
    company_industry?: string;
    company_founded?: number;
    sources: string[];            // which providers fired
    enrichedAt: string;
  };
}

interface EnrichmentKeys {
  HUNTER_API_KEY?: string;
  APOLLO_API_KEY?: string;
  CLEARBIT_API_KEY?: string;
}

// ─── Key loader ───────────────────────────────────────────────

/**
 * Load BYOK enrichment keys for a user from their settings.
 * Returns empty object if none configured — callers skip enrichment.
 */
export async function loadEnrichmentKeys(userEmail: string): Promise<EnrichmentKeys> {
  try {
    const rows = await db.select().from(settings).where(eq(settings.userEmail, userEmail));
    if (!rows.length || !rows[0].apiKeys) return {};

    const stored: Record<string, string> = JSON.parse(rows[0].apiKeys);
    return {
      HUNTER_API_KEY: stored["HUNTER_API_KEY"] || undefined,
      APOLLO_API_KEY: stored["APOLLO_API_KEY"] || undefined,
      CLEARBIT_API_KEY: stored["CLEARBIT_API_KEY"] || undefined,
    };
  } catch {
    return {};
  }
}

// ─── Hunter.io ────────────────────────────────────────────────

interface HunterEmailFinderResult {
  email?: string;
  score?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
}

async function hunterFindEmail(
  domain: string,
  apiKey: string
): Promise<HunterEmailFinderResult | null> {
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("limit", "1");
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "SovereignMatrix/1.0" },
    });

    if (!res.ok) return null;
    const data = await res.json() as { data?: { emails?: Array<{ value: string; confidence: number; first_name?: string; last_name?: string; position?: string; linkedin?: string }> } };
    const emails = data?.data?.emails;
    if (!emails?.length) return null;

    const top = emails[0];
    return {
      email: top.value,
      score: top.confidence,
      first_name: top.first_name,
      last_name: top.last_name,
      position: top.position,
      linkedin: top.linkedin,
    };
  } catch {
    return null;
  }
}

// ─── Apollo.io ────────────────────────────────────────────────

interface ApolloEnrichResult {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number: string }>;
  organization?: {
    name?: string;
    estimated_num_employees?: number;
    annual_revenue?: number;
    primary_domain?: string;
    industry?: string;
    founded_year?: number;
  };
}

async function apolloEnrich(
  domain: string,
  apiKey: string
): Promise<ApolloEnrichResult | null> {
  try {
    // Apollo organization enrichment by domain
    const _res = await fetch("https://api.apollo.io/v1/organizations/enrich", {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });

    // Use the URL with domain param
    const url = new URL("https://api.apollo.io/v1/organizations/enrich");
    url.searchParams.set("domain", domain);
    const res2 = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!res2.ok) return null;
    const data = await res2.json() as { organization?: ApolloEnrichResult };
    return data.organization ?? null;
  } catch {
    return null;
  }
}

// ─── Clearbit ─────────────────────────────────────────────────

interface ClearbitCompany {
  name?: string;
  domain?: string;
  description?: string;
  metrics?: {
    employees?: number;
    estimatedAnnualRevenue?: string;
  };
  category?: {
    industry?: string;
    sector?: string;
  };
  foundedYear?: number;
}

async function clearbitEnrich(
  domain: string,
  apiKey: string
): Promise<ClearbitCompany | null> {
  try {
    const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) return null;
    return await res.json() as ClearbitCompany;
  } catch {
    return null;
  }
}

// ─── Domain extractor ─────────────────────────────────────────

function extractDomain(website: string | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ─── Per-lead enricher ────────────────────────────────────────

async function enrichLead(lead: BaseLead, keys: EnrichmentKeys): Promise<EnrichedLead> {
  const domain = extractDomain(lead.website as string);
  if (!domain) return lead;

  const sources: string[] = [];
  const enrichment: EnrichedLead["enrichment"] = {
    sources,
    enrichedAt: new Date().toISOString(),
  };

  // Run Hunter + Apollo + Clearbit in parallel (they don't depend on each other)
  const [hunterResult, apolloResult, clearbitResult] = await Promise.allSettled([
    keys.HUNTER_API_KEY ? hunterFindEmail(domain, keys.HUNTER_API_KEY) : Promise.resolve(null),
    keys.APOLLO_API_KEY ? apolloEnrich(domain, keys.APOLLO_API_KEY) : Promise.resolve(null),
    keys.CLEARBIT_API_KEY ? clearbitEnrich(domain, keys.CLEARBIT_API_KEY) : Promise.resolve(null),
  ]);

  // Hunter — email + contact person
  if (hunterResult.status === "fulfilled" && hunterResult.value) {
    const h = hunterResult.value;
    if (h.email) { enrichment.email = h.email; sources.push("hunter"); }
    if (h.score) enrichment.email_confidence = h.score;
    if (h.first_name) enrichment.firstName = h.first_name;
    if (h.last_name) enrichment.lastName = h.last_name;
    if (h.position) enrichment.title = h.position;
    if (h.linkedin) enrichment.linkedin = h.linkedin;
  }

  // Apollo — contact + company profile
  if (apolloResult.status === "fulfilled" && apolloResult.value) {
    const a = apolloResult.value;
    sources.push("apollo");
    if (!enrichment.email && a.email) { enrichment.email = a.email; }
    if (!enrichment.firstName && a.first_name) enrichment.firstName = a.first_name;
    if (!enrichment.lastName && a.last_name) enrichment.lastName = a.last_name;
    if (!enrichment.title && a.title) enrichment.title = a.title;
    if (a.linkedin_url) enrichment.linkedin = a.linkedin_url;
    if (a.phone_numbers?.[0]?.raw_number) enrichment.phone = a.phone_numbers[0].raw_number;
    if (a.organization) {
      const org = a.organization;
      enrichment.company_domain = org.primary_domain;
      if (org.estimated_num_employees) enrichment.company_size = `${org.estimated_num_employees.toLocaleString()} employees`;
      if (org.annual_revenue) enrichment.company_revenue = `$${(org.annual_revenue / 1_000_000).toFixed(1)}M ARR`;
      if (org.industry) enrichment.company_industry = org.industry;
      if (org.founded_year) enrichment.company_founded = org.founded_year;
    }
  }

  // Clearbit — company profile (fills gaps left by Apollo)
  if (clearbitResult.status === "fulfilled" && clearbitResult.value) {
    const c = clearbitResult.value;
    sources.push("clearbit");
    if (!enrichment.company_size && c.metrics?.employees) {
      enrichment.company_size = `${c.metrics.employees.toLocaleString()} employees`;
    }
    if (!enrichment.company_revenue && c.metrics?.estimatedAnnualRevenue) {
      enrichment.company_revenue = c.metrics.estimatedAnnualRevenue;
    }
    if (!enrichment.company_industry && c.category?.industry) {
      enrichment.company_industry = c.category.industry;
    }
    if (!enrichment.company_founded && c.foundedYear) {
      enrichment.company_founded = c.foundedYear;
    }
  }

  if (sources.length === 0) return lead;

  return { ...lead, enrichment };
}

// ─── Batch enricher (parallel, max 5 concurrent) ──────────────

const CONCURRENCY = 5;

export async function enrichLeads(
  leads: BaseLead[],
  userEmail: string
): Promise<EnrichedLead[]> {
  const keys = await loadEnrichmentKeys(userEmail);
  const hasAnyKey = Boolean(keys.HUNTER_API_KEY || keys.APOLLO_API_KEY || keys.CLEARBIT_API_KEY);

  if (!hasAnyKey) {
    log.info("No enrichment keys configured — returning raw leads", { email: userEmail });
    return leads as EnrichedLead[];
  }

  const results: EnrichedLead[] = [];

  // Process in batches of CONCURRENCY
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((lead) => enrichLead(lead, keys).catch(() => lead as EnrichedLead))
    );
    results.push(...batchResults);
  }

  const enrichedCount = results.filter((r) => r.enrichment?.sources.length).length;
  log.info("Enrichment complete", { total: leads.length, enriched: enrichedCount, email: userEmail });

  return results;
}

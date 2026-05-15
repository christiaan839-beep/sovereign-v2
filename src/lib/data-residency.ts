/**
 * SOVEREIGN MATRIX — Data residency tagger (Cook 119).
 *
 * GDPR Article 44+ / CCPA / India DPDPA all care about WHERE
 * personal data is stored + processed. This module tags every
 * tenant + every agent run with a residency zone so the AI router
 * (Cook 36 tool-registry, Cook 37 orchestration) can refuse to
 * route into an out-of-zone provider.
 *
 * Pure module — caller injects the policy. Returns structured
 * decisions for both storage + processing dimensions.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type ResidencyZone = "eu" | "us" | "uk" | "in" | "global";

export interface ResidencyPolicy {
  /** Where this tenant's data is allowed to LIVE (at rest). */
  storage: ResidencyZone[];
  /** Where this tenant's data is allowed to be PROCESSED (in transit + LLM). */
  processing: ResidencyZone[];
  /** Whether PII redaction is required before any cross-zone transit. */
  redactPiiOnCrossZone: boolean;
}

export interface ProviderZone {
  /** Stable provider id (e.g. "nim", "anthropic-us", "anthropic-eu"). */
  providerId: string;
  zone: ResidencyZone;
}

export interface RoutingDecision {
  allowed: boolean;
  reason?:
    | "storage-zone-disallowed"
    | "processing-zone-disallowed"
    | "no-eligible-provider";
  /** Provider chosen when allowed=true. */
  chosenProvider?: ProviderZone;
  /** Whether the caller must PII-redact before sending. */
  mustRedact: boolean;
  /** Human-readable trace. */
  trace: string[];
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Pick a provider that satisfies the tenant's residency policy.
 * Strategy:
 *   1. Filter providers by policy.processing.
 *   2. If empty + "global" is in policy.processing → allow any.
 *   3. If still empty → no-eligible-provider.
 *   4. If the tenant's storage zone differs from the chosen
 *      processing zone, set mustRedact=true.
 *
 * Provider list MAY be ordered by caller preference; this function
 * returns the FIRST eligible match.
 */
export function pickProvider(
  policy: ResidencyPolicy,
  availableProviders: ProviderZone[],
  primaryStorageZone: ResidencyZone,
): RoutingDecision {
  const trace: string[] = [];

  if (!policy.storage.includes(primaryStorageZone)) {
    return {
      allowed: false,
      reason: "storage-zone-disallowed",
      mustRedact: false,
      trace: [
        ...trace,
        `storage zone '${primaryStorageZone}' not in policy [${policy.storage.join(", ")}]`,
      ],
    };
  }
  trace.push(`storage zone '${primaryStorageZone}' is allowed`);

  let eligible = availableProviders.filter((p) =>
    policy.processing.includes(p.zone),
  );
  if (eligible.length === 0 && policy.processing.includes("global")) {
    eligible = availableProviders;
    trace.push("falling back to global");
  }
  if (eligible.length === 0) {
    return {
      allowed: false,
      reason: "no-eligible-provider",
      mustRedact: false,
      trace: [
        ...trace,
        `no providers match processing zones [${policy.processing.join(", ")}]`,
      ],
    };
  }

  const chosen = eligible[0];
  const crossZone = chosen.zone !== primaryStorageZone;
  const mustRedact = crossZone && policy.redactPiiOnCrossZone;
  trace.push(
    `chose provider '${chosen.providerId}' in zone '${chosen.zone}'${
      crossZone ? " (cross-zone)" : ""
    }${mustRedact ? " — must redact PII" : ""}`,
  );
  return {
    allowed: true,
    chosenProvider: chosen,
    mustRedact,
    trace,
  };
}

/**
 * Default policy presets. Most tenants pick one of these on
 * onboarding; enterprise tenants override on a per-agent basis.
 */
export const POLICY_PRESETS: Record<string, ResidencyPolicy> = {
  "eu-strict": {
    storage: ["eu"],
    processing: ["eu"],
    redactPiiOnCrossZone: true,
  },
  "us-strict": {
    storage: ["us"],
    processing: ["us"],
    redactPiiOnCrossZone: true,
  },
  "uk-strict": {
    storage: ["uk"],
    processing: ["uk", "eu"],
    redactPiiOnCrossZone: true,
  },
  "in-strict": {
    storage: ["in"],
    processing: ["in"],
    redactPiiOnCrossZone: true,
  },
  "global-relaxed": {
    storage: ["eu", "us", "uk", "in", "global"],
    processing: ["eu", "us", "uk", "in", "global"],
    redactPiiOnCrossZone: false,
  },
};

/**
 * Tag an agent run with its derived residency metadata. Embeds in
 * the receipt so an auditor can verify cross-zone compliance later.
 */
export interface ResidencyTag {
  tenantStorageZone: ResidencyZone;
  providerZone: ResidencyZone;
  crossZone: boolean;
  redactionApplied: boolean;
  policyName?: string;
}

export function tagRun(
  decision: RoutingDecision,
  tenantStorageZone: ResidencyZone,
  policyName?: string,
): ResidencyTag {
  const providerZone = decision.chosenProvider?.zone ?? "global";
  return {
    tenantStorageZone,
    providerZone,
    crossZone: providerZone !== tenantStorageZone,
    redactionApplied: decision.mustRedact,
    policyName,
  };
}

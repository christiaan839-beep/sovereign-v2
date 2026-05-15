/**
 * SOVEREIGN MATRIX — Anomalous login detector (Cook 181).
 *
 * Pure-module heuristic scorer over Clerk session events that
 * flags impossible-travel, new-device, and burst-login patterns.
 * Caller wires the persistence (typically writes one row per
 * session-created event into a tenant-scoped `loginEvents` table)
 * and feeds the recent history into scoreLogin().
 *
 * Threat model:
 *   - Stolen-session-cookie replay from a different country/IP.
 *   - Brute-force or credential-stuffing across many accounts.
 *   - Compromised account from a previously-unseen device.
 *
 * Pure: no DB writes, no network. Deterministic over the input
 * history. Caller decides what to do with the verdict (force MFA,
 * notify the user, lock the account).
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface LoginEvent {
  /** Unix ms when the session was created. */
  occurredAt: number;
  /** Best-effort country code from IP geo. */
  country: string | null;
  /** IPv4/IPv6 string. */
  ip: string | null;
  /** Sha256 of user agent. */
  userAgentHash: string | null;
  /** Sha256 of (browser + os + screen) device fingerprint. */
  deviceFingerprint: string | null;
}

export interface ScoreRequest {
  /** The login event being scored (newest). */
  current: LoginEvent;
  /** Previous events for the same user, ordered oldest → newest. */
  history: LoginEvent[];
  now?: number;
}

export type RiskBand = "ok" | "low" | "medium" | "high" | "critical";

export interface AnomalyVerdict {
  riskBand: RiskBand;
  /** Numeric score in [0, 100]. */
  score: number;
  /** Reasons that contributed to the score (for the alert email). */
  signals: AnomalySignal[];
  /** Recommended action — opinionated default. */
  recommendation: "allow" | "step-up-mfa" | "lock-account";
}

export type AnomalySignal =
  | "first-login"
  | "new-device"
  | "new-country"
  | "impossible-travel"
  | "burst-frequency"
  | "tor-or-vpn";

// ── Tunables ──────────────────────────────────────────────────────────────

/** Max plausible kph between two geolocations (commercial flight ~900 kph). */
const MAX_PLAUSIBLE_KPH = 950;
/** Burst window — N logins in this duration triggers the signal. */
const BURST_WINDOW_MS = 60_000;
const BURST_THRESHOLD = 5;
/** How many history events we consider. */
const HISTORY_LOOKBACK = 50;

// Per-signal weights — sum can exceed 100 (we clamp).
const WEIGHTS: Record<AnomalySignal, number> = {
  "first-login": 5,
  "new-device": 25,
  "new-country": 20,
  "impossible-travel": 60,
  "burst-frequency": 35,
  "tor-or-vpn": 25,
};

// Approximate country-centroid lat/lng for the most common cases — used for
// impossible-travel kph calc. Unknowns fall back to "no signal" (we don't
// flip the verdict on missing geo data).
const COUNTRY_LATLNG: Record<string, [number, number]> = {
  ZA: [-30.5595, 22.9375],
  US: [37.0902, -95.7129],
  GB: [55.3781, -3.436],
  DE: [51.1657, 10.4515],
  FR: [46.2276, 2.2137],
  NL: [52.1326, 5.2913],
  CN: [35.8617, 104.1954],
  RU: [61.524, 105.3188],
  IN: [20.5937, 78.9629],
  BR: [-14.235, -51.9253],
  JP: [36.2048, 138.2529],
  CA: [56.1304, -106.3468],
  AU: [-25.2744, 133.7751],
  SG: [1.3521, 103.8198],
};

// ── Helpers ───────────────────────────────────────────────────────────────

function haversineKm(
  a: [number, number] | null,
  b: [number, number] | null,
): number | null {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function bandOf(score: number): RiskBand {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score >= 15) return "low";
  return "ok";
}

function recommendationFor(band: RiskBand): AnomalyVerdict["recommendation"] {
  if (band === "critical") return "lock-account";
  if (band === "high" || band === "medium") return "step-up-mfa";
  return "allow";
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Score a login event against the user's recent history.
 * Returns an opinionated risk band + recommended action.
 */
export function scoreLogin(req: ScoreRequest): AnomalyVerdict {
  const now = req.now ?? Date.now();
  const history = req.history
    .slice(-HISTORY_LOOKBACK)
    .filter((e) => e.occurredAt <= req.current.occurredAt);

  const signals: AnomalySignal[] = [];

  // 1. First-ever login (no history).
  if (history.length === 0) {
    signals.push("first-login");
    const score = WEIGHTS["first-login"];
    return {
      score,
      riskBand: bandOf(score),
      signals,
      recommendation: recommendationFor(bandOf(score)),
    };
  }

  // 2. New device fingerprint.
  if (
    req.current.deviceFingerprint &&
    !history.some((e) => e.deviceFingerprint === req.current.deviceFingerprint)
  ) {
    signals.push("new-device");
  }

  // 3. New country.
  if (
    req.current.country &&
    !history.some((e) => e.country === req.current.country)
  ) {
    signals.push("new-country");
  }

  // 4. Impossible travel — compare against most-recent prior event.
  const prior = history[history.length - 1];
  if (prior && req.current.country && prior.country) {
    const km = haversineKm(
      COUNTRY_LATLNG[req.current.country],
      COUNTRY_LATLNG[prior.country],
    );
    if (km !== null && req.current.occurredAt > prior.occurredAt) {
      const hours = (req.current.occurredAt - prior.occurredAt) / 3_600_000;
      if (hours > 0) {
        const kph = km / hours;
        if (kph > MAX_PLAUSIBLE_KPH) {
          signals.push("impossible-travel");
        }
      }
    }
  }

  // 5. Burst frequency.
  const burstStart = req.current.occurredAt - BURST_WINDOW_MS;
  const recent = history.filter((e) => e.occurredAt >= burstStart);
  if (recent.length + 1 >= BURST_THRESHOLD) {
    signals.push("burst-frequency");
  }

  // 6. Caller-supplied "tor-or-vpn" hint isn't computed here — we rely on
  //    a separate IP-intelligence service. If the caller already knows
  //    the IP is a known anonymising proxy, they can append the signal
  //    by hand. We don't infer it from data alone.

  const rawScore = signals.reduce((acc, s) => acc + WEIGHTS[s], 0);
  const score = Math.min(100, rawScore);

  void now;

  return {
    score,
    riskBand: bandOf(score),
    signals,
    recommendation: recommendationFor(bandOf(score)),
  };
}

/**
 * Inject a `tor-or-vpn` signal when the caller's IP-reputation
 * service flags the IP. Convenience helper that recomposes the
 * verdict.
 */
export function withTorOrVpnSignal(verdict: AnomalyVerdict): AnomalyVerdict {
  if (verdict.signals.includes("tor-or-vpn")) return verdict;
  const signals = [...verdict.signals, "tor-or-vpn"] as AnomalySignal[];
  const score = Math.min(100, verdict.score + WEIGHTS["tor-or-vpn"]);
  const riskBand = bandOf(score);
  return {
    score,
    riskBand,
    signals,
    recommendation: recommendationFor(riskBand),
  };
}

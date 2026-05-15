/**
 * Tests for src/lib/anomalous-login.ts — Cook 181.
 */

import { describe, it, expect } from "vitest";
import {
  scoreLogin,
  withTorOrVpnSignal,
  type LoginEvent,
} from "../anomalous-login";

const HOUR = 3_600_000;
const NOW = 1_700_000_000_000;

function ev(over: Partial<LoginEvent> = {}): LoginEvent {
  return {
    occurredAt: NOW,
    country: "ZA",
    ip: "196.0.0.1",
    userAgentHash: "ua_baseline",
    deviceFingerprint: "fp_baseline",
    ...over,
  };
}

describe("scoreLogin — first-login", () => {
  it("flags first-login on empty history", () => {
    const v = scoreLogin({ current: ev(), history: [] });
    expect(v.signals).toContain("first-login");
    expect(v.recommendation).toBe("allow");
    expect(v.riskBand).toBe("ok");
  });
});

describe("scoreLogin — new device", () => {
  it("flags new-device when fingerprint not in history", () => {
    const v = scoreLogin({
      current: ev({ deviceFingerprint: "fp_new" }),
      history: [ev({ occurredAt: NOW - HOUR })],
    });
    expect(v.signals).toContain("new-device");
  });

  it("does not flag new-device when fingerprint matches a past event", () => {
    const v = scoreLogin({
      current: ev({ deviceFingerprint: "fp_known" }),
      history: [ev({ occurredAt: NOW - HOUR, deviceFingerprint: "fp_known" })],
    });
    expect(v.signals).not.toContain("new-device");
  });
});

describe("scoreLogin — new country", () => {
  it("flags new-country when country not seen before", () => {
    const v = scoreLogin({
      current: ev({ country: "DE" }),
      history: [ev({ occurredAt: NOW - HOUR, country: "ZA" })],
    });
    expect(v.signals).toContain("new-country");
  });
});

describe("scoreLogin — impossible travel", () => {
  it("flags impossible-travel: SA→US in 30 minutes", () => {
    const v = scoreLogin({
      current: ev({ country: "US" }),
      history: [ev({ occurredAt: NOW - HOUR / 2, country: "ZA" })],
    });
    expect(v.signals).toContain("impossible-travel");
    // SA→US in 30 min also fires 'new-country' (US wasn't in history) —
    // total weight is 60 + 20 = 80 → critical band → lock-account.
    expect(v.riskBand).toBe("critical");
    expect(v.recommendation).toBe("lock-account");
  });

  it("does NOT flag impossible-travel: SA→US over 24 hours", () => {
    const v = scoreLogin({
      current: ev({ country: "US" }),
      history: [ev({ occurredAt: NOW - 24 * HOUR, country: "ZA" })],
    });
    expect(v.signals).not.toContain("impossible-travel");
  });

  it("doesn't crash when country missing", () => {
    expect(() =>
      scoreLogin({
        current: ev({ country: null }),
        history: [ev({ occurredAt: NOW - HOUR, country: "ZA" })],
      }),
    ).not.toThrow();
  });
});

describe("scoreLogin — burst frequency", () => {
  it("flags burst when 5+ logins in 1-minute window", () => {
    const history: LoginEvent[] = [];
    for (let i = 0; i < 4; i++) {
      history.push(ev({ occurredAt: NOW - 30_000 + i * 1000 }));
    }
    const v = scoreLogin({ current: ev(), history });
    expect(v.signals).toContain("burst-frequency");
  });

  it("does not flag burst when logins are spread out", () => {
    const history: LoginEvent[] = [
      ev({ occurredAt: NOW - 10 * HOUR }),
      ev({ occurredAt: NOW - 8 * HOUR }),
      ev({ occurredAt: NOW - 5 * HOUR }),
      ev({ occurredAt: NOW - HOUR }),
    ];
    const v = scoreLogin({ current: ev(), history });
    expect(v.signals).not.toContain("burst-frequency");
  });
});

describe("scoreLogin — compound signals", () => {
  it("stacks weights and reaches critical band on new-device + new-country + impossible-travel", () => {
    const v = scoreLogin({
      current: ev({
        country: "US",
        deviceFingerprint: "fp_new",
      }),
      history: [ev({ occurredAt: NOW - HOUR / 2, country: "ZA" })],
    });
    expect(v.signals).toContain("new-device");
    expect(v.signals).toContain("new-country");
    expect(v.signals).toContain("impossible-travel");
    expect(v.riskBand).toBe("critical");
    expect(v.recommendation).toBe("lock-account");
  });

  it("normal returning login (same device, same country, days apart) is OK", () => {
    const v = scoreLogin({
      current: ev(),
      history: [
        ev({ occurredAt: NOW - 7 * 24 * HOUR }),
        ev({ occurredAt: NOW - 24 * HOUR }),
      ],
    });
    expect(v.signals).toHaveLength(0);
    expect(v.riskBand).toBe("ok");
    expect(v.recommendation).toBe("allow");
  });
});

describe("withTorOrVpnSignal", () => {
  it("adds tor-or-vpn to existing verdict", () => {
    const base = scoreLogin({
      current: ev({ deviceFingerprint: "fp_new" }),
      history: [ev({ occurredAt: NOW - HOUR })],
    });
    const next = withTorOrVpnSignal(base);
    expect(next.signals).toContain("tor-or-vpn");
    expect(next.score).toBeGreaterThan(base.score);
  });

  it("is idempotent (calling twice doesn't double-count)", () => {
    const base = scoreLogin({ current: ev(), history: [] });
    const once = withTorOrVpnSignal(base);
    const twice = withTorOrVpnSignal(once);
    expect(twice.score).toBe(once.score);
  });
});

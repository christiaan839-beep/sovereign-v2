import type { User, Campaign, Lead } from "@/types";

/**
 * SOVEREIGN Database Abstraction Layer
 * 
 * In-memory store for development. Swap this single file
 * for Supabase/PlanetScale/Neon when ready for production.
 * Every API route imports from here — zero scatter.
 */

// ─── User Store ──────────────────────────────────────

interface StoredUser extends User {
  passwordHash: string;
  stripeCustomerId?: string;
  createdAt: string;
}

const users = new Map<string, StoredUser>();

// Seed admin account
users.set("admin@umbra.ai", {
  email: "admin@umbra.ai",
  passwordHash: hashPassword("umbra"),
  name: "Sovereign Admin",
  tier: "franchise",
  createdAt: new Date().toISOString(),
});

/** Simple hash for MVP — replace with bcrypt in production */
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const chr = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

export const db = {
  users: {
    findByEmail(email: string): StoredUser | undefined {
      return users.get(email.toLowerCase());
    },

    create(email: string, password: string, name?: string): StoredUser {
      const user: StoredUser = {
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        name: name || email.split("@")[0],
        tier: "sovereign",
        createdAt: new Date().toISOString(),
      };
      users.set(user.email, user);
      return user;
    },

    verifyPassword(email: string, password: string): StoredUser | null {
      const user = users.get(email.toLowerCase());
      if (!user) return null;
      if (user.passwordHash !== hashPassword(password)) return null;
      return user;
    },

    updateTier(email: string, tier: User["tier"]): boolean {
      const user = users.get(email.toLowerCase());
      if (!user) return false;
      user.tier = tier;
      return true;
    },

    setStripeCustomer(email: string, stripeCustomerId: string): boolean {
      const user = users.get(email.toLowerCase());
      if (!user) return false;
      user.stripeCustomerId = stripeCustomerId;
      return true;
    },

    findByStripeCustomer(stripeCustomerId: string): StoredUser | undefined {
      for (const user of users.values()) {
        if (user.stripeCustomerId === stripeCustomerId) return user;
      }
      return undefined;
    },

    count(): number {
      return users.size;
    },
  },

  // ─── Settings Store ──────────────────────────────────

  settings: {
    _store: new Map<string, Record<string, string>>(),

    get(userId: string): Record<string, string> {
      return this._store.get(userId) || {};
    },

    set(userId: string, settings: Record<string, string>): void {
      this._store.set(userId, { ...this.get(userId), ...settings });
    },
  },

  // ─── Campaign Store (per-user) ───────────────────────

  campaigns: {
    _store: new Map<string, Campaign[]>(),

    getForUser(userId: string): Campaign[] {
      if (!this._store.has(userId)) {
        // Seed demo campaigns for new users
        this._store.set(userId, [
          { id: "c1", name: "AI Suite - Pain Point", spend: 340, revenue: 2100, status: "ACTIVE" },
          { id: "c2", name: "Ghost Mode - FOMO", spend: 280, revenue: 190, status: "ACTIVE" },
          { id: "c3", name: "ROI Calculator - Logic", spend: 150, revenue: 890, status: "ACTIVE" },
        ]);
      }
      return this._store.get(userId)!;
    },

    update(userId: string, campaignId: string, data: Partial<Campaign>): boolean {
      const campaigns = this.getForUser(userId);
      const idx = campaigns.findIndex(c => c.id === campaignId);
      if (idx === -1) return false;
      campaigns[idx] = { ...campaigns[idx], ...data };
      return true;
    },

    add(userId: string, campaign: Campaign): void {
      this.getForUser(userId).push(campaign);
    },
  },

  // ─── Leads Store (per-user) ──────────────────────────

  leads: {
    _store: new Map<string, Lead[]>(),

    getForUser(userId: string): Lead[] {
      return this._store.get(userId) || [];
    },

    addMany(userId: string, leads: Lead[]): void {
      const existing = this.getForUser(userId);
      this._store.set(userId, [...existing, ...leads]);
    },
  },
};

/** Extract user email from the session cookie */
export function getUserFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/umbra_session=([^;]+)/);
  if (!match) return null;

  try {
    const decoded = JSON.parse(Buffer.from(match[1], "base64").toString());
    return decoded.email || null;
  } catch {
    return null;
  }
}

---
name: new-api-route
description: "Scaffold a new Next.js App Router API route for Sovereign Matrix following the established security, rate limiting, and error handling patterns. Use this skill when the user says 'new api route', 'create api endpoint', 'add endpoint', 'scaffold route', 'new route', or describes building a new API handler. Make sure to use this skill whenever the user wants a new route under src/app/api/, even if they don't explicitly name it — the scaffolded route gets auth, rate limiting, input validation, graceful DB error handling, and logger wiring for free."
disable-model-invocation: false
---

# New API Route

Scaffold a new App Router API route that follows every Sovereign Matrix convention by default: Clerk auth, rate limiting, input validation, graceful database error handling (PostgreSQL 42P01), structured logging, and generic error responses.

## When to Use

- User asks to "add a new API endpoint"
- User describes functionality that needs a new route
- Before writing any handler code in `src/app/api/**/route.ts`

## Required Information

Before scaffolding, determine:

1. **Path**: Where does the route live? (e.g., `src/app/api/leads/score/route.ts`)
2. **Auth**: Public, authenticated (Clerk), API-key-based, or webhook-signed?
3. **Methods**: GET, POST, PATCH, DELETE, or a combination?
4. **Database touches**: Which tables? (needed for 42P01 handlers)
5. **Rate limit**: Default is `{ interval: 60, limit: 30 }` per IP — adjust if sensitive (keys/payments: lower) or high-volume (search: higher).

If the user doesn't say, pick sensible defaults and make them explicit in the output.

## The Scaffold

### Authenticated route (most common)

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {} from /* your table */ "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const log = createLogger("<route-slug>");
const limiter = rateLimit({ interval: 60, limit: 30 });

export async function POST(req: NextRequest) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // TODO: validate body shape — reject unknown fields / bad types

    // TODO: your query — ALWAYS scope by userId to prevent IDOR
    // const rows = await db.select().from(yourTable).where(eq(yourTable.userId, userId));

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Graceful handling when table doesn't exist yet (42P01)
    if ((err as { code?: string })?.code === "42P01") {
      log.warn("Table not provisioned yet");
      return NextResponse.json(
        { error: "Feature not provisioned" },
        { status: 503 },
      );
    }
    log.error("Handler error", { userId, error: String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Webhook route (signature-verified)

```ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("<webhook-slug>");
const limiter = rateLimit({ interval: 60, limit: 30 });

/**
 * Verify HMAC-SHA256 over the raw request body.
 * Always length-check before timingSafeEqual to avoid RangeError.
 */
function verifySignature(sig: string, secret: string, body: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.<PROVIDER>_WEBHOOK_SECRET;
  if (!secret) {
    log.error("Webhook secret not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-<provider>-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Read raw body once — req.json() would consume it and break signature verification.
  const rawBody = await req.text();
  if (!verifySignature(signature, secret, rawBody)) {
    log.error("Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    // TODO: handle the event
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Handler error", { error: String(err) });
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
```

### Public route (no auth, rate-limited)

```ts
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const log = createLogger("<route-slug>");
// Tighter limit for unauthenticated endpoints.
const limiter = rateLimit({ interval: 60, limit: 10 });

export async function POST(req: NextRequest) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    // TODO: validate body strictly — this is untrusted input
    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("Handler error", { error: String(err) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

## Hard Rules (from the security audit)

Never ship a route without:

1. **Rate limiting** — Every route needs `rateLimit().check(req)` at the top. Zero routes had this before the audit; we don't regress.
2. **Auth check** — If the route accesses any data, verify `userId` from `auth()` and scope every query by it. IDOR is the #1 SaaS vulnerability.
3. **Raw error suppression** — NEVER return `error.message` to the client. Log server-side, return generic "Internal server error".
4. **42P01 handling** — Any DB query needs a catch for PostgreSQL error code `42P01` (table not provisioned). Return 503, not 500.
5. **Input validation** — Never pass `await req.json()` directly to `db.insert()` or `db.update()`. Validate shape first.
6. **Webhook signature verification** — If the route is a webhook, require a secret env var and verify the signature on the raw body (not parsed JSON). Length-check before `timingSafeEqual`.
7. **Logger, not console** — Use `createLogger("<slug>")` not `console.log`.

## After Scaffolding

1. Run the `security-reviewer` agent (or `/security-check` skill) on the new file
2. Run `npm run build` to catch type errors
3. Add a test if the route has non-trivial logic
4. Update `src/app/api/api-catalog/` if the route is publicly documented

## Related Skills

- `/security-check` — verify the new route against the security-reviewer agent
- `/db-migrate` — if the new route needs a new table or column
- `/deploy-check` — final pre-push gate

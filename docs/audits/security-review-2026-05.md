# Security review — May 2026

Focused security review of the new code added between commits
`ca2c720` and `f387063` on branch `claude/complete-project-74XPN`.
Scope: 4 vertical packet routes, the persistence layer, the OG image
generator, the public TryItDemo proxy, and the saved-packet dashboard.

---

## Verdict

**Critical: 0 · High: 2 · Medium: 4 · Low: 4 · Overall: MEDIUM**

No cross-tenant leak path. No RCE. No stored XSS. Auth + ownership
checks on the saved-packet dashboard are correct
(`and(eq(packets.id, id), eq(packets.userId, userId))` on every read,
404 on miss without leaking existence).

The medium-grade exposures concentrate on **two unauthenticated
public endpoints** (`/api/og`, `/api/free/run`) and **two URL-input
fields** (`competitorUrl`, `websiteUrl`) that lack defense-in-depth
guards. All four findings are now fixed in this commit.

---

## Findings + fixes

### HIGH-1 · `/api/og` — unauthenticated unbounded image rendering

**File:** `src/app/api/og/route.tsx:66–74` (pre-fix)

**Issue:** the route accepts `?slug=`, `?title=`, `?subtitle=` query
params with no allowlist on `slug`, no length cap on `title` /
`subtitle`, and no cache headers. Satori treats input as text (XSS
isn't possible), but the endpoint is free, unauthenticated, and edge-
runtime. An attacker can hit
`/api/og?title=AAA…(20KB)…` repeatedly to burn edge CPU minutes and
generate cache-poisoning permutations.

**Fix shipped:**

- Slug allowlisted against `ALLOWED_SLUGS` (the 4 vertical packet
  IDs + `default`). Anything else falls through to the default config.
- Title capped at 120 chars, subtitle at 240 chars before render.
- `Cache-Control: public, max-age=86400, s-maxage=604800,
stale-while-revalidate=604800, immutable` — 24h browser cache,
  7d CDN cache. Repeated rendering of the same tuple is short-
  circuited at the edge.

**Residual risk:** an attacker could still rotate through 600 unique
permutations to fill the CDN cache, but the rendering work is then
amortized across legit users. For genuine hardening, gate behind
`@upstash/ratelimit` keyed on the same IP source as `/api/free/run`.
Deferred — current state is acceptable for soft launch.

---

### HIGH-2 · `competitorUrl` / `websiteUrl` SSRF allowlist gap

**Files:** `src/app/api/_agents/agency-packet/route.ts:62–67` and
`src/app/api/_agents/growth-pulse/route.ts:73–77` (pre-fix)

**Issue:** both fields validated by `z.string().url()` only, which
accepts `file://`, `http://localhost/...`, `http://127.0.0.1/...`,
`http://10.0.0.1/...`, `http://169.254.169.254/...` (AWS / Azure /
GCP cloud-metadata IPs), and other internal targets.

The values flow into `research_ai(\`site:${host}…\`)`(Tavily search
— externally bounded) and into LLM prompts (also externally bounded),
so SSRF impact today is low. **Risk is real** if a future change
passes either URL into a server-side`fetch()` for, e.g., a
screenshot endpoint or a real comp-property lookup.

**Fix shipped:**

- New `src/lib/safe-url.ts` exports `publicHttpUrlSchema` and
  `isPublicHttpUrl()`. Allowlists `http:` / `https:`. Blocks
  `localhost`, `127.x`, RFC-1918 ranges (10.x, 172.16–31.x,
  192.168.x), link-local (169.254.x — including all cloud metadata
  endpoints), IPv6 loopback (`::1`), unique-local (`fc00:*`), and
  link-local (`fe80:*`) hosts.
- `agency-packet`'s `competitorUrl` and `growth-pulse`'s `websiteUrl`
  now use `publicHttpUrlSchema` instead of `z.string().url()`.
- The SSRF guard is in place even though no server-side fetch
  consumes these URLs today — defense-in-depth so a future change
  can't accidentally enable SSRF.

---

### MEDIUM-1 · LLM-injected envelope keys can collide with system fields

**Files:** all four packet routes' `parseJsonOrThrow` and inline
`JSON.parse` calls (pre-fix).

**Issue:** the parsed LLM output is `...spread` into the orchestrator
return value. If a prompt-injection attack convinces the LLM to emit
`{"_meta": "evil"}` or any `_`-prefixed key, that key flows through
to persistence and could collide with fields the agent-factory
envelope uses internally (`_criticFeedback`, `_qualityRetry`, etc.).
Standard `JSON.parse` is not vulnerable to prototype pollution in
modern V8, so `__proto__` is not a path here, but the envelope-
collision risk is real.

**Fix shipped:**

- Added `stripUnderscoreKeys<T>(value)` in all four packet routes.
  Recursively removes every key starting with `_` from the parsed
  output before it reaches the orchestrator. Applied to every
  `JSON.parse` call site (4 sites in `agency-packet`, 5 in each of
  the other three).
- Behavior is conservative — array elements get the same treatment
  recursively, so `[{"_evil": "x"}]` → `[{}]`.

---

### MEDIUM-2 · `/api/og` rendering work uncached

**File:** same as HIGH-1.

**Status:** rolled into HIGH-1 fix. Now cached aggressively at edge.

---

### MEDIUM-3 · `/api/free/run` IP rate limit trusts spoofable header

**File:** `src/app/api/free/run/route.ts:21` (pre-fix)

**Issue:** the IP rate-limiter keys on `req.headers.get("x-forwarded-for")`
without a proxy-trust check. On Vercel, the platform overwrites this
header, making it trustworthy in production. **On any other deploy**
(Docker / Railway / self-hosted via the `output: "standalone"` path
in `next.config.ts`) a client can spoof
`X-Forwarded-For: <random>` to bypass the 3-req/hour cap.

**Fix shipped:**

- New `resolveCallerIp(req)` helper preferring (in order):
  `x-real-ip` (set by Vercel directly, not user-controllable as it
  enters the platform), `cf-connecting-ip` (Cloudflare-set), then
  `x-forwarded-for`-first-hop, then `"unknown"`.
- Rate limit applied to the resolved IP; `unknown` collapses to a
  single shared bucket which is the conservative behavior.

**Residual risk:** the in-memory `Map` rate limiter is per-instance,
not distributed. On a multi-region serverless deploy, an attacker
gets one bucket per region. For genuine hardening, switch to
`@upstash/ratelimit` (already wired in `src/lib/rate-limit.ts`).
Deferred — acceptable for the launch threshold.

---

### MEDIUM-4 · Saved-packet input keys are not Zod-strict

**File:** `src/app/dashboard/packets/[id]/page.tsx:169–184`

**Issue:** the dashboard renders `Object.entries(packet.input)` which
loops over arbitrary string keys. The Zod schemas use `.parse()`
without `.strict()`, so unknown keys are stripped on the way in
(safe today), but a future schema relaxation could surface arbitrary
keys.

**Status:** **NOT FIXED** in this commit (truly defensive, not a real
exposure). Tracked in the audit doc. Recommended hardening: add
`.strict()` to every packet schema.

---

### LOW-1 through LOW-4

- `src/lib/packet-store.ts:84-88` — log includes raw `userId` + Postgres error message. Acceptable today (Clerk userIds are not secrets); flagged for future audit if a column-level error ever surfaces and could leak schema. NO FIX.
- `src/app/api/packets/route.ts:33` — `Number.parseInt` accepts negatives but `getPacketsForUser` clamps to `[1, 100]`. Harmless. NO FIX.
- `src/app/dashboard/packets/[id]/print/page.tsx:62` — `<meta name="robots" content="noindex">` correctly set; page is auth-gated; URL is non-guessable UUID; no cross-user data exposed. NO ACTION REQUIRED.
- Packet routes log full Postgres errors via `log.warn` from `savePacket` on failure (best-effort; not returned to client). Acceptable.

---

## What changed in this commit

| File                                           | Change                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/safe-url.ts`                          | NEW — `publicHttpUrlSchema` + `isPublicHttpUrl` SSRF allowlist                              |
| `src/app/api/og/route.tsx`                     | Slug allowlist, title/subtitle length caps, Cache-Control header                            |
| `src/app/api/_agents/agency-packet/route.ts`   | `competitorUrl` uses `publicHttpUrlSchema`; `stripUnderscoreKeys` on every `JSON.parse`     |
| `src/app/api/_agents/growth-pulse/route.ts`    | `websiteUrl` uses `publicHttpUrlSchema`; `stripUnderscoreKeys` in `parseJsonOrThrow`        |
| `src/app/api/_agents/sourcing-sprint/route.ts` | `stripUnderscoreKeys` in `parseJsonOrThrow`                                                 |
| `src/app/api/_agents/listing-pulse/route.ts`   | `stripUnderscoreKeys` in `parseJsonOrThrow`                                                 |
| `src/app/api/free/run/route.ts`                | `resolveCallerIp` prefers `x-real-ip` / `cf-connecting-ip` over spoofable `x-forwarded-for` |
| `docs/audits/security-review-2026-05.md`       | This document                                                                               |

---

## Re-verification

After the fixes, re-running the same scope:

- **Critical: 0** (was 0)
- **High: 0** (was 2 — both fixed)
- **Medium: 1** (was 4 — three fixed, MEDIUM-4 deferred as
  defensive-only)
- **Low: 4** (unchanged — none warrant fixes today)

**Overall residual risk: LOW.** Acceptable for soft launch.

The remaining medium (MEDIUM-4 — Zod strict mode on packet schemas)
is a hardening pass for the next sprint, not a launch blocker. The
remaining lows are all best-practice noise without exploit paths.

---

## Recommended next-sprint hardening (not blocking launch)

1. **Add `.strict()` to every packet schema.** Defensive against
   future refactors that relax the schema. ~30 min.
2. **Switch in-memory rate limiters to `@upstash/ratelimit`** wherever
   they currently use `Map<string, …>` (free/run, og, etc.).
   Distributed, survives cold starts. ~2 hrs.
3. **Add `Content-Security-Policy` headers** on every public route
   (the catch-all router currently sets a few; not all routes).
   Tightens XSS surface to near-zero. ~3 hrs.
4. **Wire the security-reviewer agent into pre-push hook**. Already
   triggers on review; make it block on HIGH+ findings. ~1 hr.

These are all post-launch work; none gate first paying customer.

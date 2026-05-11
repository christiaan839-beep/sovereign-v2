# Security Policy

We treat security disclosures with the same urgency we treat outages.

## Reporting a vulnerability

**Email: security@sovereignmatrix.agency**

For sensitive disclosures, request our PGP public key in your first
message and we'll respond with a fingerprint within 24 hours. Plain
email is fine for non-critical reports.

### What to include

- A description of the issue, ideally with steps to reproduce.
- An estimate of impact — what an attacker could do, against which
  data, with what level of access.
- Whether you've disclosed publicly elsewhere or to other parties.
- Whether you'd like to be credited (default: yes, with your name).

### What to expect

| Severity                                               | First response  | Triaged         | Fix shipped    |
| ------------------------------------------------------ | --------------- | --------------- | -------------- |
| Critical (account takeover, key compromise, data leak) | within 24 hours | within 72 hours | within 7 days  |
| High (auth bypass, SSRF, RCE)                          | within 48 hours | within 7 days   | within 30 days |
| Medium (info disclosure, IDOR)                         | within 7 days   | within 14 days  | within 60 days |
| Low (hardening)                                        | within 14 days  | within 30 days  | best-effort    |

These are commitments, not aspirations. If we miss any SLA, expect a
short, honest explanation in our reply with a revised date.

### Safe-harbor

We will not pursue legal action against researchers who:

- Disclose responsibly via the email above (not via public issues or
  social media before we've had a chance to respond).
- Make a good-faith effort to avoid degrading service, leaking user
  data, or accessing accounts beyond the minimum required to
  demonstrate the issue.
- Do not attempt to exfiltrate or destroy user data, monetize the
  vulnerability, or hold the disclosure for ransom.

Researchers acting in good faith may publish their findings 90 days
after the fix ships, or sooner with our explicit agreement.

## Scope

In scope:

- The deployed platform at `sovereignmatrix.agency` and any
  `*.sovereignmatrix.agency` subdomain.
- The published reference implementations:
  `@sovereign-matrix/vaos-verifier` on npm and the CLI in this repo.
- The VAOS 1.0 specification (`docs/specs/vaos-1.0.md`) and its
  reference algorithm.

Out of scope:

- Third-party services used by the platform (Clerk, Stripe, Neon,
  Vercel, NVIDIA NIM, etc.) — please report to the responsible vendor.
- Forks or self-hosted deployments not operated by Sovereign Matrix.
- Issues that require physical access, an already-compromised
  account, or stolen API keys to exploit.
- Volumetric DoS attacks. Rate limits exist and are documented; if
  you find an unbounded resource consumption path, that's in-scope.

## Known security mechanisms (so you don't re-report them)

- **HMAC-SHA256 + Ed25519 signatures** on every agent run receipt.
  See `src/lib/agent-runs.ts` and `docs/specs/vaos-1.0.md`.
- **Output verifier** is default-on across all 127 agent routes.
  Fail-open by design; missing NVIDIA NIM key turns LlamaGuard into
  a no-op without affecting the other 4 layers.
- **Rate limiting** at the route layer via `src/lib/rate-limit.ts`.
- **Idempotency** on Stripe / Clerk / HubSpot / Cal.com / Yoco /
  Twilio / Telegram webhooks via `src/lib/idempotency.ts`.
- **RBAC** via Clerk + `src/lib/rbac.ts`. Admin actions require
  `requireAdmin()`.
- **Right of erasure** at `POST /api/me/delete` cascades 30+ tables.
- **Pre-push hook** runs strict typecheck + Suspense-trap scan
  before any commit ships (`scripts/git-hooks/pre-push`).

## Past advisories

- 2026-05-11 — Initial security batch: 4 HIGH findings closed
  (`/api/verify` rate-limit unit bug, `/api/agent-runs/[id]/replay`
  SSRF + credential leak, `getClientId` X-Forwarded-For trust,
  `/api/verify/badge.svg` enumeration). 8 npm CVEs patched in the
  same commit. See `docs/audits/security-review-2026-05.md`.

## Compliance

For SOC 2 / POPIA / EU AI Act / ISO 42001 audit inquiries, see
`docs/soc2-controls.md` (full CC1–CC9 evidence map) and
`docs/launch-readiness.md`. Auditor questions: spec@sovereignmatrix.agency.

## Hall of fame

We will credit responsible disclosers here, with their permission.
List is currently empty — be the first.

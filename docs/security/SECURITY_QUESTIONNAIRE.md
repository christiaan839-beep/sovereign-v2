# Security Questionnaire — Pre-Drafted Answers

> Use this when a prospect sends a SIG Lite, CAIQ, or custom security
> questionnaire. Copy the relevant sections into their form.
> Updated: 2026-04-20 (matches commit `HEAD~` on `claude/wizardly-benz`)

## Company information

| Question | Answer |
|---|---|
| Company name | Sovereign Matrix (trading as sovereignmatrix.agency) |
| Legal entity | South African sole proprietorship; Delaware LLC conversion in progress (Q3 2026) |
| Head office | South Africa |
| Employees | 1 (solo founder) + contractors |
| Year founded | 2026 |
| Primary contact | christiaan@sovereignmatrix.agency |
| Security contact | security@sovereignmatrix.agency (per RFC 9116 security.txt) |

## Architecture & hosting

| Question | Answer |
|---|---|
| Hosting provider | Vercel (Next.js Pro), with data in Neon Postgres (AWS-backed, us-east-1 + eu-central-1 on request) |
| Application framework | Next.js 16 (App Router), React 19, TypeScript 5.9 |
| Data stores | Postgres (Neon), Redis (Upstash), Pinecone (vector DB) |
| AI providers | NVIDIA NIM, Anthropic, Google, Groq, Cerebras, Ollama (self-hosted) |
| Multi-region | Single region default (us-east); EU region on request per customer |
| CDN / edge | Vercel Edge + Cloudflare (DDoS + WAF) |

## Identity & access management

| Question | Answer |
|---|---|
| Authentication provider | Clerk (SOC 2 Type II attested) |
| MFA support | Yes — TOTP, SMS, backup codes, Passkeys |
| SSO support | SAML 2.0 via WorkOS integration (Growth plan+) |
| SCIM provisioning | Planned Q3 2026 (mid-market tier unlock) |
| Password policy | Delegated to Clerk — 12+ chars, breach-list check, rotation on compromise |
| Session management | Rolling 7-day, revocable from /dashboard/settings/security |
| RBAC | 4-tier role hierarchy: viewer, member, admin, owner (per organization) |

## Data protection

| Question | Answer |
|---|---|
| Encryption in transit | TLS 1.3 enforced; HSTS max-age=63072000 with preload |
| Encryption at rest | Neon uses AWS RDS-level AES-256; Upstash uses KMS; our BYOK keys use AES-256-GCM with PBKDF2-SHA256 (210k iterations) per-user wrapping |
| Key management | Per-tenant DEKs derived from user passphrase via PBKDF2; root secrets in Vercel env (Rotated quarterly) |
| PII handling | Minimal collection — email + optional name via Clerk. No SSN, DOB, bank data. Card data handled by Stripe (we are PCI SAQ-A) |
| Data retention | 30 days for logs, 90 days for agent outputs (configurable by plan), indefinite for billing until account deletion + 7-year retention window |
| Data deletion | Full deletion within 30 days of request (POPIA / GDPR Art. 17); database hard-delete + Stripe subscription cancellation |
| Data portability | Self-serve CSV/JSON export at `/api/_audit/export?scope=self` |
| Data residency | US-East default; EU region available on request for Enterprise |

## Secrets management

| Question | Answer |
|---|---|
| Secret storage | Vercel environment variables (encrypted at rest); never in code |
| Secret rotation | Quarterly for CRON_SECRET, STRIPE_WEBHOOK_SECRET, UPSTASH_REDIS_REST_TOKEN; annually for ANTHROPIC_API_KEY (no rotation gateway yet) |
| API token handling | Stored as SHA-256 hashes; raw value shown once on mint; rotate with 60-min grace period |
| Secrets scanning | GitHub secret scanning enabled on repo; Aikido pre-commit hook |

## Application security

| Question | Answer |
|---|---|
| SAST tooling | ESLint + TypeScript strict mode + Aikido Security |
| DAST tooling | Cobalt pen-test (scheduled annually) |
| Dependency scanning | Dependabot + npm audit in CI |
| OWASP Top 10 | Documented mitigations for all 10 (see below) |
| CSRF protection | State-token cookie pattern on OAuth flows; SameSite=Lax on auth cookies |
| XSS protection | React automatic escaping + strict CSP header |
| SQL injection | Drizzle ORM parameterized queries exclusively |
| Content Security Policy | `default-src 'self'` + explicit allowlist for Stripe/Clerk/Plausible |
| Rate limiting | Upstash Redis sliding window — 100 req/min default, scales to plan |

## OWASP Top 10 (2021) mitigations

| # | Risk | Mitigation |
|---|---|---|
| A01 | Broken Access Control | Postgres RLS on 10 tenant tables; middleware gate on every `/api/_*` route; isAdmin() env-only allowlist |
| A02 | Cryptographic Failures | TLS 1.3; PBKDF2 210k iterations for BYOK; never plaintext secrets; HSTS enforced |
| A03 | Injection | Drizzle ORM (parameterized); Zod input validation on every API route; sanitizeString() helper |
| A04 | Insecure Design | Threat model in ADR-0002 (encryption); 5-layer safety pipeline on every agent run |
| A05 | Security Misconfig | `powered-by-header: false`, security headers via Next.js config (HSTS, CSP, X-Frame-Options, Referrer-Policy) |
| A06 | Vulnerable Components | Dependabot PRs; npm audit in CI; quarterly manual review |
| A07 | Ident/Auth Failures | Clerk (SOC 2 Type II); MFA supported; session rotation; no custom auth code |
| A08 | Software/Data Integrity | SHA-256 tagging on Vercel deploys (immutable); signed webhooks (HMAC-SHA256 + timestamp) |
| A09 | Logging/Monitoring | Sentry with PII scrubbing; structured logs via pino; 30-day retention |
| A10 | SSRF | Tavily calls validated against allowlist; URL path traversal rejected in webhook verification |

## Incident response

| Question | Answer |
|---|---|
| Incident response plan | Documented in `docs/RUNBOOK.md` (public on request) |
| Notification timeline | 72 hours to Information Regulator (POPIA / GDPR); 24-hour initial customer notification via email + status page |
| Forensics | Sentry error trail + Vercel logs + execution_audit table (7-day retention) |
| Bug bounty | Ad-hoc; credit + swag; formal HackerOne program planned Q4 2026 |
| Vulnerability disclosure | [security.txt](https://sovereignmatrix.agency/.well-known/security.txt) per RFC 9116 |

## Compliance & certifications

| Framework | Status | Evidence |
|---|---|---|
| SOC 2 Type I | In progress (Vanta) — target Q3 2026 | Roadmap shared on request |
| SOC 2 Type II | Target Q1 2027 (12-month observation after Type I) | — |
| ISO 27001 | Under evaluation | — |
| HIPAA | Not supported — no healthcare customers | Explicit out-of-scope in ToS |
| PCI DSS | SAQ-A (Stripe handles card data) | Self-attested |
| GDPR | Compliant — DPA template available | `docs/legal/DPA_TEMPLATE.md` |
| POPIA | Compliant — responsible party with Information Regulator | — |
| CCPA | Self-serve data export + deletion | `/api/_audit/export?scope=self` |
| CAN-SPAM / CASL | Compliant — unsubscribe in every email | `src/lib/telecom-compliance.ts` |
| TCPA / FCC 19-73 | Compliant — AI voice disclosure + DNC guard | `src/lib/telecom-compliance.ts` |
| EU AI Act | Limited-risk tier; transparency obligations met via per-agent `.agent.md` discovery | Public metadata |

## Business continuity

| Question | Answer |
|---|---|
| Backup frequency | Continuous (Neon point-in-time recovery, 7-day window) |
| Backup testing | Monthly restore drill (documented in RUNBOOK.md) |
| RPO / RTO | RPO ≤ 15 minutes; RTO ≤ 4 hours |
| DR plan | Documented; Neon PITR → fresh branch → cutover |
| Uptime target | 99.5% monthly (SMB), 99.9% contractual SLA (Enterprise with credits) |
| Historical uptime | Published live at `/api/health/ping`; status.sovereignmatrix.agency |

## Sub-processors

| Vendor | Purpose | Location | DPA signed |
|---|---|---|---|
| Vercel | Hosting | US / EU | Yes |
| Neon | Postgres database | US (primary), EU on request | Yes |
| Clerk | Authentication | US | Yes |
| Stripe | Payment processing | Global | Yes |
| Upstash | Redis rate limiting | US / EU | Yes |
| Anthropic | Claude API (content critic) | US | Yes |
| NVIDIA | NIM inference API | US | Yes |
| Google | Gemini API (consensus verification) | US | Yes |
| Resend | Transactional email | US | Yes |
| Sentry | Error monitoring (PII-scrubbed) | US | Yes |

Full list updated in `docs/security/SUB_PROCESSORS.md` — customers
must be notified 30 days in advance of any addition.

## Third-party integrations

| Integration | Auth method | Data flowing |
|---|---|---|
| Slack | OAuth 2.0 (chat:write scope) | Messages we post on user's behalf |
| Gmail / Outlook | OAuth 2.0 (send-only) | Outbound email drafted by agents |
| Stripe | API key (our account) | Customer subscription lifecycle |
| HubSpot | OAuth 2.0 (read/write contacts) | Prospecting data sync |

Each integration is per-tenant-authorized; we never share tokens
across customers. Tokens encrypted at rest with `safeEncrypt`
(AES-256-GCM).

## Customer obligations

Things we expect customers to handle:
- Keep their Clerk password strong + MFA enabled
- Rotate API tokens on employee turnover
- Configure SSO (Growth plan+) for enterprise identity
- Report suspected incidents to security@sovereignmatrix.agency
- Do not store PHI/PCI/SSNs in agent memory fields

## Questions not answered here

Email security@sovereignmatrix.agency with the specific question and
SLA expectation. We reply within 24 business hours.

Common ones we'll answer ad-hoc:
- Penetration test report (NDA required)
- Insurance certificates (cyber liability $1M)
- SOC 2 Type I progress letter
- Custom MSA / DPA redlines
- Data flow diagrams

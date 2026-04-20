---
name: CTA click tracking is half-wired
description: /api/_misc/cta-click allowlist names primary-hero/primary-final/seat-claim/playbook-card/email-founder, but no client sends those — only FounderCTA reports
type: project
---

CTA click tracking pipeline (src/app/api/_misc/cta-click/route.ts) accepts 6 ALLOWED_CTAS but only `founder-cta` is actually emitted from any client. `primary-hero`, `primary-final`, `seat-claim`, `playbook-card`, `email-founder` are dead allowlist entries. PrimaryCTA component (src/components/landing/PrimaryCTA.tsx) has a `handleClick` that only spawns a ripple — no sendBeacon to /api/_misc/cta-click. Same for the /customers seat-claim link, playbook cards, mailto links.

**Why:** session v11 added tracking + migration 0015 but wiring the client emitters was left incomplete.

**How to apply:** When optimizing the funnel, wiring `PrimaryCTA`/seat-claim/playbook cards to `sendBeacon('/api/_misc/cta-click', {ctaName: 'primary-hero', ...})` is a 5-minute change that turns a dead pipeline into an attribution source. Copy the sendBeacon pattern from FounderCTA.tsx (already handles sendBeacon + keepalive fallback).

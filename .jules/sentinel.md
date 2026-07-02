## 2026-07-02 - Remove Fallback for Webhook Secrets
**Vulnerability:** INTERNAL_WEBHOOK_SECRET fallback to empty string in webhook routes.
**Learning:** Using an empty string fallback for secrets is a security footgun. Even if the comparison function protects against length 0, it can mask configuration errors and fail closed in an opaque way.
**Prevention:** Throw an explicit error on server startup or request handling if required secrets are missing from the environment.

**Followup Learning:** When removing fallback secrets in best-effort side-effects (like auto-onboarding triggered by payment webhooks), throwing an error must be done within a try-catch block so it doesn't crash the critical path (e.g. failing a payment processing webhook). Failing loudly is good, but throwing an unhandled exception in the middle of a critical payment pipeline is unsafe.

/**
 * Legacy env module — delegates to the Zod-validated schema in env.ts.
 * Preserved as a re-export so existing callers (~40 files) keep working.
 * New code should import `env` and `capabilities` from `@/lib/env` instead.
 */

export { env, capabilities } from "@/lib/env";

import * as Sentry from "@sentry/nextjs";

/**
 * Sentry — Server SDK (Node runtime)
 *
 * Release matches the browser config so server-side stack traces resolve
 * against the same uploaded source maps.
 */

const RELEASE =
  process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

const ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: RELEASE,
    environment: ENVIRONMENT,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    enabled: process.env.NODE_ENV === "production",
  });
}

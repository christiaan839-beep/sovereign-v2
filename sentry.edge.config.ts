import * as Sentry from "@sentry/nextjs";

/**
 * Sentry — Edge runtime (middleware, edge routes).
 * Smaller payload; same release/environment story as the server config.
 */

const RELEASE =
  process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

const ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.NODE_ENV;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: RELEASE,
    environment: ENVIRONMENT,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}

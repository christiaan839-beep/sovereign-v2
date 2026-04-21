import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway — Vercel injects VERCEL=1 automatically
  // so this activates only for self-hosted deployments.
  output: process.env.VERCEL ? undefined : "standalone",

  // `ignoreBuildErrors` used to be true as a temporary escape hatch while
  // the createAgentRoute migration cooled. All 107 inherited errors are
  // now fixed (see SESSION_LOG v7); the flag is OFF so any future TS
  // regression fails the build instead of being silently shipped.
  typescript: { ignoreBuildErrors: false },

  // Keep Node.js-only packages out of client/edge bundles
  serverExternalPackages: [
    "@pinecone-database/pinecone",
    "twilio",
    "drizzle-orm",
    "@neondatabase/serverless",
  ],

  // Performance: compress responses
  compress: true,

  // Security: don't leak framework version in response headers
  poweredByHeader: false,

  // Image optimization for external domains
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.clerk.com" },
      { protocol: "https", hostname: "**.stripe.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.nvidia.com" },
      { protocol: "https", hostname: "**.googleapis.com" },
    ],
  },

  // Experimental performance features
  experimental: {
    // optimizeCss requires 'critters' package — disabled until installed
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://plausible.io https://*.clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Rewrites for white-label subdomain routing
  async rewrites() {
    return [
      {
        source: "/client/:clientId/:path*",
        destination: "/portal/:clientId/:path*",
      },
    ];
  },

  // Redirects — RFC-spec compliance for browsers
  async redirects() {
    return [
      {
        // W3C change-password discovery spec
        // https://www.w3.org/TR/change-password-url/
        // Browsers auto-check this when a breach is detected; we route
        // to the real security settings page so 1Password / iCloud
        // Keychain can deep-link users to rotate.
        source: "/.well-known/change-password",
        destination: "/dashboard/settings/security",
        permanent: false,
      },
    ];
  },
};

/**
 * Sentry wrapper — uploads source maps to Sentry on production builds so
 * stack traces stay readable after minification. No-ops in dev and when
 * SENTRY_AUTH_TOKEN is absent (local/preview builds), so contributors
 * don't need Sentry credentials to run the app.
 */
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      // Strip source maps from the client bundle after uploading — keeps
      // our code out of public DevTools while still giving Sentry readable
      // stacks. The `deleteSourcemapsAfterUpload` option is the post-v8
      // replacement for the old `hideSourceMaps` flag.
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig;

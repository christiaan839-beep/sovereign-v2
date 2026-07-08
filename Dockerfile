# ═══════════════════════════════════════════
# SOVEREIGN MATRIX — Production Dockerfile
# Multi-stage build for minimal image size
# ═══════════════════════════════════════════
#
# NOTE (BACKLOG docker-build): this repo is an npm WORKSPACE
# (package.json "workspaces": ["packages/*"]). The previous Dockerfile
# copied only package.json + package-lock.json and ran
# `npm ci --omit=dev`, which broke three ways:
#   1. npm ci ENOENT'd on the missing workspace manifests,
#   2. the build-packages postinstall couldn't find scripts/ or packages/,
#   3. --omit=dev stripped typescript / tailwind that `next build` needs.
# The builder stage therefore copies the whole context and runs a FULL
# `npm ci` (dev deps included). The final runner image stays lean because
# it ships only the Next.js standalone output, not node_modules.

# Stage 1: Build (needs full deps + workspace packages + scripts)
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy the whole workspace so `npm ci` can resolve packages/* and the
# build-packages postinstall can find scripts/ and packages/.
# (.dockerignore keeps node_modules / .next / .git out of the context.)
COPY . .

# Build args for Next.js public env vars
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL

# Full install (dev deps included — next build needs typescript +
# tailwind). postinstall compiles the workspace packages' dist/.
RUN npm ci

RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (bundles only the runtime deps the app needs)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

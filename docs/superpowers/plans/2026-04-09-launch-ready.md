# Launch-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sovereign-v2 production-ready with zero broken routes, proper loading states, security hardening, landing page polish, transparency features, and performance optimization.

**Architecture:** Fix-forward approach — repair broken fetch calls with stub routes, add loading skeletons to all dashboard pages via a shared loading.tsx pattern, extract landing page components for performance, and wire transparency into the assistant.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Clerk auth, Stripe, Resend, Tailwind CSS v4, Framer Motion

---

## Subsystem Breakdown

This plan covers 7 independent subsystems. Each can be executed in parallel:

1. **Broken Route Fixes** — 7 missing API routes + 1 missing import
2. **Landing Page Design Standardization** — Padding, CTAs, hero prominence
3. **Transparency Footer** — SovereignAssistant model/quality/time display
4. **Loading Skeletons** — 49 dashboard pages need loading states
5. **Security Audit Fixes** — Rate limiting on public endpoints
6. **Landing Page Performance** — Extract 7 inline components
7. **End-to-End Flow Testing Plan** — Manual test checklist

---

### Task 1: Fix 7 Broken API Routes

**Files:**
- Create: `src/app/api/clients/route.ts`
- Create: `src/app/api/data-export/route.ts`
- Create: `src/app/api/generations/route.ts`
- Create: `src/app/api/leads/capture/route.ts`
- Create: `src/app/api/nim/route.ts`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/scheduled-workflows/route.ts`
- Create: `src/lib/encryption.ts`

Each route follows the same pattern: Clerk auth, Drizzle DB query on the matching table (clientProjects, generations, leads, scheduledRuns), graceful 42P01 handling.

- [ ] **Step 1: Create `/api/clients` route** — CRUD for clientProjects table. GET lists by userId, POST creates new project.
- [ ] **Step 2: Create `/api/data-export` route** — GET exports user data as JSON (generations, leads, settings) for GDPR compliance.
- [ ] **Step 3: Create `/api/generations` route** — GET lists generations by userEmail, POST with action="usage" returns daily/monthly counts.
- [ ] **Step 4: Create `/api/leads/capture` route** — POST captures lead info (name, phone, planId) into leads table.
- [ ] **Step 5: Create `/api/nim` route** — Proxy to NVIDIA NIM API for model inference. Used by morpheus-shield page.
- [ ] **Step 6: Create `/api/projects` route** — Alias for /api/clients (same table, different name in UI).
- [ ] **Step 7: Create `/api/scheduled-workflows` route** — CRUD for scheduledRuns table. GET lists by userId, POST creates schedule with cron expression.
- [ ] **Step 8: Create `src/lib/encryption.ts`** — Export `safeDecrypt(ciphertext: string): string` and `safeEncrypt(plaintext: string): string` using AES-256-GCM with ENCRYPTION_KEY env var.
- [ ] **Step 9: Verify** — Run `grep -r 'fetch("/api/' src/ | grep -v node_modules | awk -F'"' '{print $2}' | sort -u` and confirm all paths have matching routes.
- [ ] **Step 10: Commit** — `git commit -m "fix: create 7 missing API routes + encryption lib"`

---

### Task 2: Landing Page Design Standardization

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Audit current section padding** — Read page.tsx, grep for `py-` classes. Document current inconsistencies.
- [ ] **Step 2: Standardize padding** — Replace all section padding with system: `py-20` (small), `py-24` (medium/default), `py-32` (large/hero). Apply consistently.
- [ ] **Step 3: Standardize CTA buttons** — Primary: `px-8 py-4 bg-white text-black text-sm font-bold uppercase tracking-widest rounded-full hover:bg-neutral-200 transition-all`. Secondary: `px-8 py-4 border border-white/10 text-neutral-300 text-sm font-bold uppercase tracking-widest rounded-full hover:border-white/20 hover:text-white transition-all`.
- [ ] **Step 4: Enhance hero CTA** — Make primary CTA larger (`px-10 py-5 text-base`), add shadow glow (`shadow-[0_0_40px_rgba(255,255,255,0.15)]`), ensure it's above the fold.
- [ ] **Step 5: Verify** — `npm run dev`, check landing page visually, confirm consistent spacing.
- [ ] **Step 6: Commit** — `git commit -m "polish: standardize landing page padding + CTA styles"`

---

### Task 3: SovereignAssistant Transparency Footer

**Files:**
- Modify: `src/components/dashboard/SovereignAssistant.tsx`
- Read: `src/lib/output-transparency.ts`

- [ ] **Step 1: Read output-transparency.ts** — Understand the `formatTransparencySummary()` function signature and return type.
- [ ] **Step 2: Import transparency** — Add `import { formatTransparencySummary } from "@/lib/output-transparency"` to SovereignAssistant.tsx.
- [ ] **Step 3: Add footer to assistant messages** — After every assistant response bubble, render: `<div className="text-[9px] text-neutral-600 font-mono mt-1">{model} · {qualityScore} · {executionTime}</div>`. Parse the response headers or metadata for model name and timing.
- [ ] **Step 4: Handle missing data gracefully** — If no transparency data available, show nothing (don't break the UI).
- [ ] **Step 5: Commit** — `git commit -m "feat: add transparency footer to assistant responses"`

---

### Task 4: Loading Skeletons for Dashboard Pages

**Files:**
- Create: `src/app/dashboard/(pages-needing-loading)/loading.tsx` (batch creation)

Strategy: Create a shared dashboard loading pattern, then apply it to all 49 pages using a single template.

- [ ] **Step 1: Create reusable loading template** — `src/app/dashboard/_shared-loading.tsx` with stat and card variants.
- [ ] **Step 2: Batch create loading.tsx for metric-heavy pages** — Pages like analytics, billing, agent-analytics, revenue, reports get `variant="stat" count={4}`.
- [ ] **Step 3: Batch create loading.tsx for list-heavy pages** — Pages like leads, inbox, marketplace, jobs, autopilot get `variant="card" count={4}`.
- [ ] **Step 4: Batch create loading.tsx for remaining pages** — Use card variant as default.
- [ ] **Step 5: Verify** — Check 5 random pages in browser, confirm skeleton appears before data.
- [ ] **Step 6: Commit** — `git commit -m "ux: add loading skeletons to 49 dashboard pages"`

---

### Task 5: Security Hardening

**Files:**
- Modify: Public API routes lacking rate limiting
- Create: `src/lib/rate-limit.ts` (if not exists)

- [ ] **Step 1: Audit client-side code for leaked secrets** — `grep -r "sk_\|secret\|password\|PRIVATE" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules\|.env\|route.ts"` — check for hardcoded secrets in client components.
- [ ] **Step 2: Verify SQL parameterization** — Check all `db.select/insert/update/delete` calls use Drizzle's parameterized queries (they do by default). Flag any raw `sql` template usage that interpolates user input.
- [ ] **Step 3: Add rate limiting to public endpoints** — Ensure `/api/demo/analyze`, `/api/waitlist`, `/api/marketplace` (GET), `/api/health/*` have rate limiting via Upstash or in-memory limiter.
- [ ] **Step 4: Verify auth on write endpoints** — Confirm all POST/PATCH/DELETE routes check `auth()`.
- [ ] **Step 5: Commit** — `git commit -m "security: rate limit public endpoints + audit results"`

---

### Task 6: Landing Page Performance — Extract Components

**Files:**
- Modify: `src/app/page.tsx` (1,718 lines → ~400 lines)
- Create: `src/components/landing/TokCounter.tsx`
- Create: `src/components/landing/EarlyAccessCapture.tsx`
- Create: `src/components/landing/ROICalculator.tsx`
- Create: `src/components/landing/InteractiveDemo.tsx`
- Create: `src/components/landing/FAQSection.tsx`
- Create: `src/components/landing/CountUpOnView.tsx`
- Create: `src/components/landing/HeroSection.tsx`

- [ ] **Step 1: Extract TokCounter** — Move to `src/components/landing/TokCounter.tsx`. Self-contained, no deps.
- [ ] **Step 2: Extract EarlyAccessCapture** — Move to `src/components/landing/EarlyAccessCapture.tsx`. Keep localStorage + API call logic.
- [ ] **Step 3: Extract ROICalculator** — Move to `src/components/landing/ROICalculator.tsx`. Keep slider logic.
- [ ] **Step 4: Extract InteractiveDemo** — Move to `src/components/landing/InteractiveDemo.tsx`.
- [ ] **Step 5: Extract FAQSection** — Move FAQItem + FAQ data to `src/components/landing/FAQSection.tsx`.
- [ ] **Step 6: Extract CountUpOnView + TimeCountUpOnView** — Move to `src/components/landing/CountUpOnView.tsx`.
- [ ] **Step 7: Extract HeroSection** — Move hero block to `src/components/landing/HeroSection.tsx`.
- [ ] **Step 8: Update page.tsx imports** — Replace inline components with imports from `@/components/landing/`.
- [ ] **Step 9: Verify** — `npm run build` passes, landing page renders correctly.
- [ ] **Step 10: Commit** — `git commit -m "perf: extract 7 landing page components for code splitting"`

---

### Task 7: End-to-End Launch Testing Checklist

This is a manual test plan, not code. Execute after all other tasks are complete.

- [ ] **Test 1: Signup flow** — Visit /signup → Create account via Clerk → Verify redirect to /onboarding → Verify Clerk webhook fires (check logs) → Verify welcome email arrives.
- [ ] **Test 2: Onboarding flow** — Complete all 6 steps → Verify goal/industry saved to DB → Verify redirect to correct playbook.
- [ ] **Test 3: Free playbook run** — Run "Lead Blitz" playbook → Verify steps execute → Verify results display → Verify run saved to DB.
- [ ] **Test 4: Competitor scan** — Run competitor analysis on a real URL → Verify real intelligence returned (not placeholder).
- [ ] **Test 5: Stripe checkout** — Click "Subscribe" on Starter plan → Complete Stripe checkout → Verify webhook fires → Verify subscription in DB → Verify dashboard shows correct plan.
- [ ] **Test 6: Public pages** — Visit all 20+ public pages (/, /pricing, /about, /vs/*, /for-*) → Verify no crashes, no 500 errors.
- [ ] **Test 7: Dashboard pages** — Visit 10 dashboard pages → Verify loading skeletons appear → Verify data loads or empty states show.
- [ ] **Test 8: Marketplace** — Run seed endpoint → Browse marketplace → Install an agent → Verify it appears in custom skills.
- [ ] **Test 9: Workflow builder** — Create workflow with 3 agents → Save → Load → Run → Verify execution.
- [ ] **Test 10: Voice assistant** — Open SovereignAssistant → Send message → Verify response with transparency footer.

---

## Execution Order

Tasks 1-6 can run in parallel. Task 7 runs after all others complete.

**Critical path:** Task 1 (broken routes) must complete before Task 7 (testing).
**Highest UX impact:** Task 4 (loading skeletons) affects 49 pages.
**Highest visual impact:** Task 2 (landing page) + Task 6 (performance).

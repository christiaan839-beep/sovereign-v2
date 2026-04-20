---
name: Durable queue gap
description: No BullMQ/Inngest/QStash. Async playbooks use fire-and-forget promises that die on Vercel cold boot.
type: project
---

`src/app/api/playbooks/run/route.ts` runs async playbooks via `executePlaybook(run.id, ...).catch(...)` with no `waitUntil`, no queue, no worker. On Vercel the serverless function can terminate when the response is sent. Long-running playbooks are not durable.

**Why**: Enterprise playbooks (6+ steps × 30s AI call each = 3+ minutes) will silently fail mid-execution on cold boots or function time limits. No retry, no visibility. Zero durability for scheduled workflows either (`src/lib/scheduled-tasks.ts` uses in-process setInterval style logic).

**How to apply**: QStash (Upstash) is the cheapest path — already have Upstash for rate-limit and cache. Each playbook step becomes a QStash message with signature verification, retry, and DLQ. Inngest is better but adds another vendor. Flag as reliability issue, not feature.

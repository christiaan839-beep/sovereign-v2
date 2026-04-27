# Visual playbook editor — design

**Status:** Scaffold + design doc, not yet implemented.
**Closes:** WHATS-NOT-ELITE.md §2.6 (the largest competitive gap vs n8n / Make / Zapier).
**Estimated effort:** 2-3 weeks for MVP, 4-6 weeks for production-grade.

---

## Goal

A drag-drop canvas where users compose Sovereign agents into playbooks
WITHOUT writing TypeScript. Same execution path as code-defined
playbooks (`src/lib/playbooks.ts`), just a different authoring surface.

## Why now

n8n / Make / Zapier all have visual editors. Sovereign currently
defines playbooks in code (`src/lib/playbooks.ts`) which means only
the engineering team can author. The gap is real:
- Sales asks: "can a customer build their own playbook?" → no
- Procurement asks: "do you have a no-code editor?" → no
- Competitors lead with this in every demo

The answer can't be "we have 25 pre-built playbooks" forever. We need
the canvas.

## Scope of MVP

**In scope:**
1. **Canvas** — React Flow-based DAG. Nodes = agents from
   `/api/_meta/agents.json`. Edges = data flow (output of A → input of B).
2. **Node palette** — searchable list of all 223 agents, filterable
   by tier + capability + manifest.outputClass.
3. **Node config** — each node opens an inspector showing the agent's
   `requiredFields` schema; user fills them or wires from upstream.
4. **Save** — drop the DAG into the `playbooks` table as JSON.
5. **Run** — same execution path as code-defined playbooks. The
   existing `runPlaybook(playbookId, inputs)` already accepts the JSON
   shape; we just need to assemble it.
6. **Preview** — dry-run mode that traverses the DAG without
   invoking real agents — surfaces required-field gaps + estimated cost.

**Out of scope for MVP (deferred to v2):**
- Conditional branches (only linear or fan-out for now)
- Loops / iteration
- Sub-playbooks (composing playbooks of playbooks)
- Versioning + diff
- Multi-user collaborative editing
- Export to terraform-style code
- Marketplace listing of community playbooks

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ /dashboard/playbooks/edit/[id]/page.tsx                      │
│   - Reads /api/_meta/agents.json for the node palette        │
│   - Reads existing playbook from /api/playbooks/<id>         │
│   - Renders <PlaybookCanvas /> — the React Flow component    │
│   - On save → POST /api/playbooks/<id> { dag: ... }          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ <PlaybookCanvas /> (src/components/playbook/Canvas.tsx)      │
│   - React Flow nodes + edges                                  │
│   - Per-node inspector pulls from the agent's manifest:       │
│     - manifest.signals → which capabilities this agent uses  │
│     - manifest.tier → confirmation requirement (UI badge)     │
│     - manifest.models → model list (so user knows the cost)   │
│   - Edges enforce schema compatibility — output of A must     │
│     be a valid input shape for B (Zod-driven)                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ playbooks.dag: JSON                                          │
│   {                                                           │
│     "nodes": [                                                │
│       { "id": "n1", "agent": "leads", "config": { ... } },   │
│       { "id": "n2", "agent": "outreach-personalizer",         │
│         "config": { "input": "$.n1.leads[*]" } }              │
│     ],                                                        │
│     "edges": [                                                │
│       { "from": "n1.leads", "to": "n2.input" }                │
│     ]                                                         │
│   }                                                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ runPlaybook(dag, inputs) — src/lib/playbooks.ts              │
│   - Topo-sort the DAG                                        │
│   - For each node: resolve inputs from upstream outputs      │
│     using JSONPath ($.n1.leads[*])                           │
│   - Invoke the agent via the registry (capability checks     │
│     fire automatically)                                       │
│   - Persist the run as a playbook_run + playbook_run_step    │
└──────────────────────────────────────────────────────────────┘
```

## Trust + safety considerations

This editor inherits ALL existing safety primitives — the canvas
DOES NOT bypass them:

1. **Tenant agent policy** (`tenant-agent-policy.ts`) — node palette
   filters by `evaluateTenantPolicy(manifest, tenantPolicy)`. Tenants
   can't add agents their policy denies.
2. **Capability manifest** — every node shows its tier + capability
   badges. Tier-3 nodes prompt for admin approval at save time.
3. **Audit log** — every save emits an `audit_log` entry through the
   hash chain. Operators can replay the exact sequence of edits.
4. **Confidence scoring** — playbook execution surfaces per-node
   confidence; users see which nodes need review.
5. **Token budget** — pre-flight estimate via the calculator's math
   prevents the user from authoring a $5K playbook by accident.

## Why React Flow specifically

- Already paid for (no extra cost — MIT licensed)
- DAG-shaped is exactly what we need (no graph-y edge cases)
- Clean React API — every node is a component, every edge is data
- Tested at scale — n8n uses it, Linear uses it, Vercel uses it
- TypeScript-first — types match our existing codebase

## Step-by-step build plan

**Week 1 — Plumbing**
1. Install react-flow + persist a `playbooks.dag` JSONB column
2. Read-only canvas: load existing playbook, render nodes/edges
3. Node inspector with read-only manifest details
4. Topo-sort + dry-run mode that lists missing fields per node

**Week 2 — Authoring**
5. Drag-from-palette to add nodes
6. Edge creation by drawing
7. Save → POST → audit log → success
8. Tenant policy + tier confirmation UX

**Week 3 — Execution**
9. Wire to existing `runPlaybook()` — verify same execution path
10. Live run streaming (server-sent events) showing per-node status
11. Confidence + cost surfaced per node post-run
12. Replay UI

## Risks

1. **Schema-driven edge validation is hard** — agent input/output Zod
   schemas don't always describe types in a way React Flow can
   compare. May need a manual "compatibility" hint per edge.
2. **The 223-node palette might overwhelm** — filter by manifest tier
   + outputClass + tenant policy will cut to ~50 typically; add a
   "common patterns" tab as a starter set.
3. **Dry-run cost estimation is approximate** — token counts vary by
   input size; calculator gives the envelope, real run might 3x.

## Files this design will create

```
src/app/dashboard/playbooks/edit/[id]/page.tsx       NEW
src/components/playbook/Canvas.tsx                    NEW
src/components/playbook/NodeInspector.tsx             NEW
src/components/playbook/NodePalette.tsx               NEW
src/components/playbook/canvas-types.ts               NEW
src/lib/playbook-dag.ts                               NEW (topo sort + run)
src/lib/playbook-dag.test.ts                          NEW
drizzle/0040_playbook_dag.sql                         NEW (column add)
src/app/api/playbooks/[id]/route.ts                   MODIFIED (handle dag)
docs/VISUAL-PLAYBOOK-EDITOR-DESIGN.md                 THIS FILE
```

## Sequencing relative to other work

This is intentionally LAST in the proposal stack because:

- It depends on the manifest system (just shipped) for the node
  palette filtering.
- It depends on the tenant policy library (also just shipped) for
  per-tenant agent visibility.
- It depends on the confidence scoring (just shipped) for in-canvas
  trust signals.
- It depends on the token budget (just shipped) for cost estimation.

So everything required is already shipped. The 2-3 weeks of effort
is now sequential implementation work, not architectural.

When the next session picks this up, start with the React Flow shell
+ the dry-run path. Save + execution can come in week 2.

# Agent Benchmark Suites — Design

> Status: **design only**. Infrastructure for shipping this exists (A/B battle + confidence scoring); the missing piece is the **test batteries** + **scorecards UI**.

## Why benchmarks matter

Today, buyers pick marketplace agents by:
- **Stars / reviews** — gameable, easy to inflate, dominated by survivorship bias
- **Health grades** — composite, good at a glance but black-box
- **A/B battle** — buyer-initiated, one-input comparison

None of these answer: *"Across 100 real-world invoices, which invoice-extractor has the best accuracy?"*

HuggingFace solved this for models with public benchmarks (GLUE, MMLU, HumanEval). **No agent marketplace currently benchmarks its agents**. Shipping this would be a first-mover trust moat.

## Shape

### 1. Test batteries (curated inputs + expected outputs per category)

One JSON file per category lives at `src/data/benchmarks/<category>.json`:

```json
{
  "category": "finance-invoice-extraction",
  "version": "1.0",
  "description": "Extract structured fields from invoice PDFs/images.",
  "metric": "field_accuracy",
  "cases": [
    {
      "id": "inv-001",
      "input": { "imageUrl": "https://benchmarks.sovereignmatrix.agency/fixtures/inv-001.pdf" },
      "expected": {
        "vendor": "Acme Corp",
        "totalCents": 125000,
        "currency": "USD",
        "lineItems": [ /* ... */ ]
      },
      "tags": ["single-page", "US-format"]
    }
    /* 49 more cases */
  ]
}
```

**Sourcing the fixtures** is the hardest part — needs real invoices (not AI-generated) that are legally distributable. Start with 50 synthetic + 50 human-curated real documents per category.

### 2. Runner

`src/lib/agent-benchmarks.ts` — pure function that:
1. Accepts a `BenchmarkSuite` + a list of agent slugs
2. Runs every case through every agent (in parallel, rate-aware)
3. Computes per-case scoring via a category-specific judge
4. Aggregates to per-agent: `{ accuracy, p50_latency, p95_latency, cost_per_run, failure_rate }`
5. Writes to a new `agent_benchmark_runs` table

### 3. Scoring judges

Each category has its own scoring function. Not LLM-judged — determinism is the whole point.

- **finance-invoice-extraction**: field-by-field `===` match (with tolerance for cents rounding)
- **content-cold-email**: length within bounds, presence of required tokens, absence of forbidden phrases, similarity to a "good response" reference via embedding distance
- **code-refactor**: diff sanity check + test pass rate on a held-out test file

### 4. Database schema (new migration 0032)

```sql
CREATE TABLE agent_benchmark_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES marketplace_agents(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  suite_version TEXT NOT NULL,
  accuracy_pct INTEGER NOT NULL,           -- 0..100
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  cost_per_run_cents INTEGER NOT NULL,
  failure_rate_pct INTEGER NOT NULL,
  cases_passed INTEGER NOT NULL,
  cases_total INTEGER NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_benchmark_category_accuracy
  ON agent_benchmark_runs (category, accuracy_pct DESC);
```

### 5. Public scorecard page

`/marketplace/benchmarks/[category]` — ranked table:

| Rank | Agent | Accuracy | p50 | p95 | Cost | Last run |
|---|---|---|---|---|---|---|
| 1 | invoice-ocr | 94% | 1.2s | 3.8s | 5¢ | 2h ago |
| 2 | florence-ocr | 91% | 0.9s | 2.7s | 0¢ | 2h ago |
| 3 | invoice-extractor | 87% | 2.3s | 6.1s | 2¢ | 2h ago |

Every score links to the full per-case breakdown (`/marketplace/benchmarks/[category]/[agentSlug]`) showing which 3 cases out of 50 failed.

### 6. Frequency

- **On submission**: automatically run the full suite before approving
- **Weekly**: re-run all suites for all verified agents (cron)
- **On model upgrade**: re-run (agent output can change if the backing model updates)

## What shipping this looks like

| Piece | Effort | Owner |
|---|---|---|
| Migration + schema | 1 hour | Engineering |
| 3 seed test batteries (finance + content + code) | 1 week | Content + subject-matter experts |
| Runner + judges | 2 days | Engineering |
| Public scorecard UI | 1 day | Frontend |
| Cron + weekly re-runs | 2 days | Engineering |
| **Total** | **~2 sprints** with domain-expert involvement | |

## Why we didn't ship it in this session

The infrastructure (A/B battle + confidence scoring + invoke pipeline + attestation) is **all in place**. The bottleneck is **curated test data**. A benchmark suite with synthetic-only fixtures would be worse than not shipping because creators would game it by training on the synthetic inputs. Real fixtures require real data licensing — ~2 weeks of non-engineering work.

**When we ship this**, it instantly becomes the most important page on the platform. Buyers stop comparing marketing copy and start comparing scorecards. Creators stop optimizing for SEO and start optimizing for actual output quality. **This is how the marketplace becomes a quality economy instead of a marketing economy.**

## Decision needed (when revisiting)

One meaningful design choice still open: **should benchmark failures publicly penalize the agent's health grade?**

- **Yes** → tight feedback loop; bad agents become visibly bad quickly
- **No** → separation of concerns; grades measure invocations, benchmarks measure curated performance
- **Hybrid** → benchmarks count as a single signal input to the grade, weighted alongside success rate + latency + safety

The elite answer is probably **hybrid**, but it depends on how much confidence operators have in the judges. Start with **No** (benchmarks are a separate ranked surface) and promote to hybrid once judges prove robust in production.

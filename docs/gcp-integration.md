# Google Cloud Integration Map

Wave 133. Honest map of Google Cloud's 150+ products against Sovereign
Matrix's actual scaling needs. This is the "yes-but" filter — adopt
only where Neon Postgres / Vercel / hosted NIM is genuinely starting
to hurt.

## Tier 1 — Adopt when the dimension breaks

| GCP service          | Triggers adoption when…                                                | Sovereign caller                                       |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| **BigQuery**         | `agent_runs` exceeds ~5M rows OR cohort scan latency > 10s             | `src/lib/bigquery-export.ts` ships the NDJSON pipeline |
| **Cloud Storage**    | Receipt archive retention horizon > 1 yr OR cost per GB on Neon > GCS  | Tiered receipt blob storage; signed via Ed25519        |
| **Cloud Tasks**      | `scheduledRuns` reliability matters (cron survives container restarts) | Replace in-process scheduler when ops grows >1 person  |
| **Vertex AI Search** | Need higher-quality grounded search than direct Gemini REST            | Drops into `url-context` + `grounded-search` agents    |
| **Cloud Run**        | If Vercel becomes a constraint (rare)                                  | Container deploy target alternative                    |

## Tier 2 — Adopt if you specifically need them

| GCP service                           | When it's right                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| **AlloyDB**                           | When Postgres workload outgrows Neon (>10k QPS sustained)                     |
| **Firestore**                         | If realtime collaboration on dashboards becomes a requirement                 |
| **Pub/Sub**                           | If multi-region event fan-out becomes a requirement                           |
| **Looker / Looker Studio**            | If sales needs operator-grade BI on top of BigQuery (vs. our `/metrics` page) |
| **Gemini Enterprise + Agent Builder** | If a customer demands "deploy on Google Cloud" specifically                   |
| **Vertex AI Model Garden**            | If you want Anthropic / Mistral / Llama via a single GCP IAM-secured endpoint |
| **Cloud KMS**                         | Replaces the env-var ML-DSA-65 secret with a hardware-backed root of trust    |
| **Secret Manager**                    | Replaces `process.env.*_API_KEY` once team size grows beyond ~3               |
| **Identity Platform**                 | Only if migrating off Clerk (don't)                                           |

## Tier 3 — Don't adopt (yet)

| GCP service                  | Why pass                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| App Engine                   | Vercel + Cloud Run already cover this; no need for a third deploy target |
| Cloud SQL                    | Neon's serverless model is better for our usage pattern                  |
| Spanner                      | Massive overkill until multi-region transactional needs appear           |
| Bigtable                     | Time-series workload is what BigQuery handles, not Bigtable              |
| Cloud Composer (Airflow)     | DAG executor already in `src/lib/dag-executor.ts`; don't duplicate       |
| Dataflow / Dataproc          | Pre-aggregation in BigQuery covers our analytics path                    |
| VMware Engine / Bare Metal   | We have no VMware footprint to migrate                                   |
| Distributed Cloud Air-gapped | Specialised for regulated regional deployments only                      |
| Blockchain Node Engine       | Out of scope                                                             |

## Tier 4 — Industry verticals (case-by-case)

These map to specific Sovereign Matrix `/for-*` verticals and only
matter when a single deal demands GCP-native:

- **Healthcare API** — HIPAA covered-entity work. Pair with our existing
  `healthcare-docs` agent + signed receipts for evidence trail.
- **Anti-Money Laundering AI** — financial-services vertical.
- **Telecom Data Fabric / Subscriber Insights** — telco vertical.
- **Earth Engine** — geospatial / agri-intel vertical (we have an
  `agri-intel` agent).
- **Document AI** — already covered by our NIM `doc-intel` agent;
  adopt only if a customer demands GCP-managed.

## Adoption sequence (recommended)

If you're going to start, do them in this order:

1. **BigQuery + GCS export** (Wave 133 ships the code; operator runs
   the `bq mk` once + sets the four env vars).
2. **Cloud KMS** for the ML-DSA-65 secret (1-day swap).
3. **Cloud Tasks** for the scheduler (1-week refactor of
   `src/lib/scheduler.ts`).
4. **Vertex AI Search** as an upgrade path for `grounded-search` (1-day
   adapter using the same outboundFetch + allowlist pattern).

Stop there unless a specific deal demands more.

## Authentication

GCP services consumed by the runtime use a single base64-encoded service
account JSON in `GCP_SERVICE_ACCOUNT_JSON`. Scopes required per service:

- BigQuery: `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`
- GCS: `roles/storage.objectCreator` (writes only — no list/read)
- Cloud Tasks: `roles/cloudtasks.enqueuer`
- Vertex AI: `roles/aiplatform.user`

Use **Workload Identity Federation** (no key file at all) if you
deploy to Cloud Run or GKE. The current env-var path is fine for
Vercel.

## Cost ceilings to budget

| Service             | Realistic monthly bill at our scale                                 |
| ------------------- | ------------------------------------------------------------------- |
| BigQuery storage    | ~$0.02/GB × 100GB = ~$2/mo                                          |
| BigQuery query scan | ~$5/TB × 1TB scanned = ~$5/mo (1B-row cohort scan is ~50GB)         |
| GCS Standard        | ~$0.02/GB × 200GB = ~$4/mo (with lifecycle move to Nearline at 30d) |
| Cloud Tasks         | ~$0.40 / million tasks                                              |
| Vertex AI Search    | ~$2 / 1k queries                                                    |
| Cloud KMS           | ~$0.06 per key per month + $0.03 per 10k operations                 |

Total **<$50/mo** at 1M-receipt scale. Pays for itself the first time a
Neon scan blocks for >10s on the `/metrics` page.

## Specifically NOT recommended

- **Don't move Clerk to Identity Platform.** Clerk's UX is better and
  the lock-in trade is roughly equal.
- **Don't move Vercel to Cloud Run** for the next year. Vercel's
  Next.js integration (Turbopack, edge functions, image optimisation)
  is worth the deploy lock-in until we cross ~10M requests/month.
- **Don't move Neon to AlloyDB / Cloud SQL.** Neon's serverless HTTP
  driver is better for our serverless deploy target. Tier off to
  BigQuery instead.
- **Don't adopt Anthos / GKE Enterprise.** We don't have a Kubernetes
  footprint to manage, and adding one for "scalability" is overhead
  without a use case.

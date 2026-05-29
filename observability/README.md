# Stitcher Observability Backend

Self-hosted, **opt-in** observability stack for the Stitcher video-generation
pipeline. Traces, metrics, and logs from every service compose into one view.
This stack lives in its own compose file so it never disturbs the core stack.

Conforms to the engineering contract in [`../Plan/OBSERVABILITY.md`](../Plan/OBSERVABILITY.md).

## What's in the box

| Container        | Image                                       | Host port | Role                                  |
|------------------|---------------------------------------------|-----------|---------------------------------------|
| otel-collector   | `otel/opentelemetry-collector-contrib:latest` | 4317/4318, 8889 | OTLP ingress → fan out          |
| tempo            | `grafana/tempo:latest`                      | 3200      | Trace store                           |
| prometheus       | `prom/prometheus:latest`                    | 9090      | Metric store (scrapes collector :8889) |
| loki             | `grafana/loki:latest`                       | 3100      | Log store (native OTLP ingest)        |
| grafana          | `grafana/grafana:latest`                    | **3001**  | Dashboards (datasources provisioned)  |
| langfuse + db    | `langfuse/langfuse:2`, `postgres:16`        | **3002**  | LLM cost/prompt UI                    |

Grafana is on **3001** (not 3000 — the API owns 3000); Langfuse on **3002**.

Telemetry flow:

```
app services ──OTLP/HTTP :4318──▶ otel-collector ─┬─ traces  ──▶ Tempo
                                                  ├─ metrics ──▶ :8889 ◀─scrape─ Prometheus
                                                  └─ logs    ──▶ Loki (/otlp)
                                          Grafana reads Tempo + Prometheus + Loki
```

## Run it

From the repo root (`Stitcher_new/Stitcher/`):

```bash
# Full app + observability
docker compose \
  -f docker-compose.yml \
  -f docker-compose.services.yml \
  -f docker-compose.observability.yml up -d

# Observability backend only (no app)
docker compose -f docker-compose.observability.yml up -d
```

Tear down (keeps data in named volumes):

```bash
docker compose -f docker-compose.observability.yml down
# add -v to also wipe all telemetry/Langfuse data
```

## URLs

| Service    | URL                       | Login                              |
|------------|---------------------------|------------------------------------|
| Grafana    | http://localhost:3001     | `admin` / `admin` (anonymous Admin also on) |
| Prometheus | http://localhost:9090     | —                                  |
| Langfuse   | http://localhost:3002     | self-register on first visit       |
| Tempo API  | http://localhost:3200     | (used by Grafana)                  |
| Loki API   | http://localhost:3100     | (used by Grafana)                  |

In Grafana, the **Stitcher Pipeline** dashboard (folder *Stitcher*) is
auto-provisioned: p50/p95 step durations, tokens by model, queue depth, job
error rate, render p95, and a Loki logs panel. Panels show "No data" until the
app services emit telemetry — that's expected.

**Trace ↔ logs correlation** is wired both ways: in a Tempo trace, "Logs for
this span" jumps to Loki filtered by trace; in a Loki log line a `trace_id`
becomes a clickable link into Tempo.

## Getting Langfuse API keys

1. Open http://localhost:3002 and create an account (any email/password — dev).
2. Create an **Organization** → **Project**.
3. Project **Settings → API Keys → Create new API key**.
4. Copy the **Public key** (`pk-lf-…`) and **Secret key** (`sk-lf-…`).
5. Give them to the Agent/RAG services as:

   ```
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_HOST=http://langfuse:3000      # inside compose
   # LANGFUSE_HOST=http://localhost:3002   # local dev
   ```

## Connecting the app services (you must do this)

The core compose files are intentionally **not** edited. For api / agent-service
/ rag-service / render-service to emit telemetry they must:

1. Join the `stitcher-observability` network.
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` (and ideally
   `OTEL_SERVICE_NAME` per the contract: `stitcher-api`, `stitcher-agent`,
   `stitcher-rag`, `stitcher-render`).

A ready-to-paste override block is at the **bottom of
`docker-compose.observability.yml`** — copy it into
`docker-compose.observability.override.yml` and add it to your `-f` chain.

For **local (non-Docker) dev**, point each service at
`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` instead.

> The service-side OTel SDK wiring (instrumentation init, span naming, the
> BullMQ trace bridge, the `stitcher.*` metrics) is owned by the
> service-instrumentation work — see `Plan/OBSERVABILITY.md` §3. This README
> only covers the backend that receives it.

## Metric name mapping (OTel → Prometheus)

OTel dot-names become underscores in Prometheus; histograms gain
`_bucket`/`_sum`/`_count`, counters gain `_total`:

| Contract (OTel)                   | Prometheus                                    |
|-----------------------------------|-----------------------------------------------|
| `stitcher.pipeline.step.duration` | `stitcher_pipeline_step_duration_milliseconds_*` |
| `stitcher.llm.tokens`             | `stitcher_llm_tokens_total`                   |
| `stitcher.queue.depth`            | `stitcher_queue_depth`                        |
| `stitcher.render.duration`        | `stitcher_render_duration_milliseconds_*`     |
| `stitcher.render.concurrency`     | `stitcher_render_concurrency`                 |

The dashboard queries already use the underscore names.

## Troubleshooting

- **Loki fails with `bind: address already in use` on 3100.** Something on the
  host already owns port 3100 (commonly a *locally-run* Stitcher API dev server
  — `ts-node src/index.ts` listens on 3100). Stop that process, or remap Loki's
  host port in `docker-compose.observability.yml` (e.g. `"3110:3100"`) and
  update the Loki datasource URL if you query it directly. The Loki container
  config itself is valid; this is only a host-port collision. When the API runs
  *inside* Docker it uses 3000, so there's no clash in the full-stack case.
- **Tempo `ingester`/`compactor` config rejected.** Some Tempo builds' strict
  `-config.verify` rejects those top-level blocks; `tempo.yaml` is kept minimal
  (defaults) to guarantee a clean boot. Verify any additions with
  `docker run --rm -v $PWD/observability/tempo.yaml:/etc/tempo.yaml grafana/tempo:latest -config.verify -config.file=/etc/tempo.yaml`.

## TODO before non-dev use

- **Rotate all secrets** in `docker-compose.observability.yml`:
  Grafana admin password, Langfuse `NEXTAUTH_SECRET` / `SALT` /
  `ENCRYPTION_KEY` (`openssl rand -hex 32`), and the Postgres password.
- Disable Grafana anonymous Admin (`GF_AUTH_ANONYMOUS_ENABLED=false`).
- Disable Langfuse open signup (`AUTH_DISABLE_SIGNUP=true`) after creating users.
- Langfuse is pinned to **v2** (Postgres-only). v3 needs ClickHouse + Redis +
  MinIO — only move to `langfuse/langfuse:latest` if you add those.

## Config files

```
observability/
├── otel-collector-config.yaml                 # OTLP in → Tempo/Prometheus/Loki
├── tempo.yaml                                  # trace store + span-metrics
├── prometheus.yml                              # scrape collector :8889
├── loki-config.yaml                            # log store, OTLP ingest
└── grafana/
    ├── provisioning/datasources/datasources.yaml   # Tempo+Prom+Loki + correlation
    ├── provisioning/dashboards/dashboards.yaml      # dashboard loader
    └── dashboards/stitcher-pipeline.json            # starter dashboard
```

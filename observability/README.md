# Observability

Optional dashboards for traces, metrics, logs and LLM calls. It is off by default and costs nothing
when off. Everything is defined in the root `compose.yaml` under the `obs` profile.

| Container | Image | Host port | What it does |
|---|---|---|---|
| `otel-collector` | `otel/opentelemetry-collector-contrib:0.164.0` | 127.0.0.1:4318 | Receives OTLP, sends traces to Tempo, metrics to Prometheus, logs to Loki. |
| `tempo` | `grafana/tempo:2.10.10` | none | Trace store. |
| `prometheus` | `prom/prometheus:v3.15.1` | 127.0.0.1:9090 | Metric store. Scrapes the collector. |
| `loki` | `grafana/loki:3.7.9` | none | Log store. |
| `grafana` | `grafana/grafana:13.2.5` | 127.0.0.1:3001 | Dashboards. Data sources are set up for you. |
| `langfuse`, `langfuse-db` | `langfuse/langfuse:2.95.11`, `postgres:16.15-alpine` | 127.0.0.1:3002 | Prompt and cost view for LLM calls. |

Every port is bound to 127.0.0.1. Change the host ports with `GRAFANA_PORT`, `PROMETHEUS_PORT` and `LANGFUSE_PORT`.

## Turn it on

1. In `.env`, uncomment these two lines:

   ```
   OTEL_SDK_DISABLED=false
   OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
   ```

2. Start the stack with the profile:

   ```bash
   docker compose --profile obs up -d
   ```

3. Open Grafana at http://localhost:3001. The user is `admin`. The password is `GRAFANA_ADMIN_PASSWORD` in `.env`
   (`setup.sh` generates it). If the variable is missing, it is `admin`.

The **Stitcher Pipeline** dashboard shows step durations, tokens by model, queue depth, job errors, render time
and a log panel. Panels read "No data" until a job has run.

To stop it, include the profile, otherwise compose leaves the obs containers running:

```bash
docker compose --profile obs down
```

Add `-v` to also delete the stored telemetry.

## How data flows

```
api, agent, rag, render --OTLP/HTTP :4318--> otel-collector --+-- traces  --> Tempo
                                                              +-- metrics --> :8889 <-- Prometheus
                                                              +-- logs    --> Loki
                                              Grafana reads Tempo, Prometheus and Loki
```

All four services send to `http://otel-collector:4318` over the compose network. The service names are
`stitcher-api`, `stitcher-agent`, `stitcher-rag` and `stitcher-render`. The API sends nothing while
`OTEL_EXPORTER_OTLP_ENDPOINT` is empty. The agent, rag and render services skip telemetry while `OTEL_SDK_DISABLED` is `true`.

In a Tempo trace, "Logs for this span" opens Loki filtered by trace. A `trace_id` in a Loki log line links back to Tempo.

## Langfuse

Langfuse shows each prompt, reply, token count and cost.

1. Open http://localhost:3002 and create an account. Signup is open, so keep the port on 127.0.0.1.
2. Create an organization and a project, then **Settings, API Keys, Create new API key**.
3. Put the keys in `.env`:

   ```
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```

4. Restart the agent: `docker compose --profile obs up -d agent`.

The agent reads `LANGFUSE_HOST` (default `http://langfuse:3000` in compose). Langfuse is pinned to version 2, which
needs only Postgres. Version 3 also needs ClickHouse, Redis and MinIO.

## Metric names

OpenTelemetry names turn into Prometheus names with underscores. Histograms add `_bucket`, `_sum` and `_count`, and
counters add `_total`.

| OpenTelemetry | Prometheus |
|---|---|
| `stitcher.pipeline.step.duration` | `stitcher_pipeline_step_duration_milliseconds_*` |
| `stitcher.llm.tokens` | `stitcher_llm_tokens_total` |
| `stitcher.queue.depth` | `stitcher_queue_depth` |
| `stitcher.render.duration` | `stitcher_render_duration_milliseconds_*` |
| `stitcher.render.concurrency` | `stitcher_render_concurrency` |

## Files

```
observability/
  otel-collector-config.yaml                   OTLP in, fan out to Tempo, Prometheus, Loki
  tempo.yaml                                   trace store
  prometheus.yml                               scrapes the collector on :8889
  loki-config.yaml                             log store with OTLP ingest, 7 day retention
  grafana/provisioning/datasources/            Tempo, Prometheus and Loki, linked to each other
  grafana/provisioning/dashboards/             dashboard loader
  grafana/dashboards/stitcher-pipeline.json    the starter dashboard
```

The config files are mounted read-only into the containers, so edit them and run
`docker compose --profile obs restart <service>`.

## Before you expose it

The defaults suit one person on one machine.

- Set a real `GRAFANA_ADMIN_PASSWORD`. Anonymous access is off.
- Langfuse allows anyone who can reach port 3002 to sign up. Keep it on 127.0.0.1, or set `AUTH_DISABLE_SIGNUP=true`
  on the container after you create your account.
- `setup.sh` generates the Langfuse secrets. If you write `.env` by hand, use `openssl rand -hex 32` for each.

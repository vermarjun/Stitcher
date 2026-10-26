/**
 * OpenTelemetry bootstrap for ManimRAG — MUST load before any application module.
 *
 * Two robust load paths are supported:
 *   1. Pre-require (container):  `node -r ./dist/instrumentation.cjs dist/server.cjs`
 *      (see Dockerfile CMD and the npm start script).
 *   2. Direct dev run via tsx: import this as the first side-effect in index.ts.
 *
 * The SDK starts exactly once (symbol-guarded), exports OTLP over HTTP to
 * OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318), and shuts down
 * gracefully on SIGTERM/SIGINT. Fail-open: any init error is logged but does
 * NOT prevent the service from starting.
 *
 * Mirrors Manim-Agent-Service/src/instrumentation.ts (OBSERVABILITY_PLAN §3).
 */

import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { AlwaysOnSampler } from "@opentelemetry/sdk-trace-base";

// Surface OTel internal errors only when explicitly requested.
if (process.env["OTEL_DIAG_DEBUG"] === "true") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
} else {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
}

// ─── Guard: ensure we only start once even if loaded via both paths ───────────
const GUARD = Symbol.for("stitcher.rag.otel.started");
const g = globalThis as typeof globalThis & { [key: symbol]: boolean };

const SERVICE_NAME = process.env["OTEL_SERVICE_NAME"] ?? "stitcher-rag";
const SERVICE_VERSION = process.env["npm_package_version"] ?? "2.0.0";
const DEPLOYMENT_ENV =
  process.env["NODE_ENV"] ?? process.env["ENV"] ?? "development";

// Base OTLP/HTTP endpoint (no signal path). Exporters append /v1/traces, /v1/metrics.
const OTLP_BASE = (
  process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4318"
).replace(/\/+$/, "");

let sdk: NodeSDK | undefined;

export function startInstrumentation(): void {
  if (g[GUARD]) return;
  g[GUARD] = true;

  try {
    const traceExporter = new OTLPTraceExporter({
      url: `${OTLP_BASE}/v1/traces`,
    });
    const metricExporter = new OTLPMetricExporter({
      url: `${OTLP_BASE}/v1/metrics`,
    });

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
        "deployment.environment": DEPLOYMENT_ENV,
      }),
      traceExporter,
      sampler: new AlwaysOnSampler(),
      metricReaders: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 15_000,
        }),
      ],
      // Auto-instrument Fastify + http (Fastify auto-instrumentation extracts
      // the incoming W3C `traceparent` header automatically, so RAG spans are
      // children of the API's root span). Disable fs — noisy for this workload.
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();
  } catch (err) {
    // Never let observability bring down the service.
    console.warn(
      "[otel] stitcher-rag OTel init failed (continuing without telemetry):",
      err instanceof Error ? err.message : String(err)
    );
  }
}

export async function shutdownInstrumentation(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    /* best-effort flush on exit */
  }
}

// Auto-start on import (covers the `-r` pre-require path).
startInstrumentation();

const gracefulShutdown = (): void => {
  void shutdownInstrumentation();
};
process.once("SIGTERM", gracefulShutdown);
process.once("SIGINT", gracefulShutdown);

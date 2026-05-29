/**
 * OpenTelemetry bootstrap — MUST load before any application module.
 *
 * Two robust load paths are supported (pick either, both are wired):
 *   1. Pre-require:  `node -r ./dist/instrumentation.js dist/index.js`
 *      (see the `start` / `dev` npm scripts).
 *   2. First side-effect import: `src/index.ts` imports this file before
 *      anything else, so `tsx`/`ts-node` dev runs are also instrumented.
 *
 * The SDK is started exactly once (guarded) and shut down gracefully on exit.
 * This file is purely additive: it never touches business logic, and if the
 * collector is unreachable the exporters fail silently in the background.
 *
 * Conforms to Plan/OBSERVABILITY.md §3:
 *   - OTLP over HTTP/protobuf (port 4318), W3C Trace Context propagation (default),
 *     service.name = stitcher-agent, traces + metrics, always_on sampler in dev.
 */

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
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// Surface OTel internal errors only when explicitly debugging.
if (process.env["OTEL_DIAG_DEBUG"] === "true") {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

const SERVICE_NAME = process.env["OTEL_SERVICE_NAME"] || "stitcher-agent";
const SERVICE_VERSION = process.env["npm_package_version"] || "0.1.0";
const DEPLOYMENT_ENV =
  process.env["NODE_ENV"] || process.env["ENV"] || "development";

// Base OTLP/HTTP endpoint (no signal path). Exporters append /v1/traces, /v1/metrics.
const OTLP_BASE =
  process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] || "http://localhost:4318";
const stripTrailingSlash = (s: string): string => s.replace(/\/+$/, "");
const base = stripTrailingSlash(OTLP_BASE);

let sdk: NodeSDK | undefined;
let started = false;

/** Idempotently start the OTel NodeSDK. Safe to call from multiple entry paths. */
export function startInstrumentation(): void {
  if (started) return;
  started = true;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    // `deployment.environment` is incubating in semconv; use the literal key
    // so we don't depend on the experimental subpath export.
    "deployment.environment": DEPLOYMENT_ENV,
  });

  const traceExporter = new OTLPTraceExporter({ url: `${base}/v1/traces` });
  const metricExporter = new OTLPMetricExporter({ url: `${base}/v1/metrics` });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    sampler: new AlwaysOnSampler(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 15_000,
    }),
    // Auto-instrument Fastify + http (server extracts incoming `traceparent`
    // automatically, so Agent spans are children of the API's job span).
    // fs instrumentation is noisy for this workload — disable it.
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
  } catch (err) {
    // Never let observability bring down the service.
    // eslint-disable-next-line no-console
    console.warn(
      "[otel] failed to start instrumentation:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/** Gracefully flush + shut down the SDK. */
export async function shutdownInstrumentation(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    /* swallow — best-effort flush on exit */
  }
}

// Auto-start on import (covers the `-r` pre-require path and the first
// side-effect import from index.ts).
startInstrumentation();

const flushAndExit = (): void => {
  void shutdownInstrumentation();
};
process.once("SIGTERM", flushAndExit);
process.once("SIGINT", flushAndExit);

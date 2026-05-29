/**
 * OpenTelemetry bootstrap for the Stitcher API service.
 *
 * THIS MODULE MUST LOAD BEFORE ANY APPLICATION CODE so the auto-instrumentations
 * can monkey-patch http/express/ioredis/mongoose before those modules are required.
 *
 * Wiring (see API/package.json scripts):
 *   - prod:  `node -r ./dist/instrumentation.js dist/index.js`
 *   - dev:   `tsx -r ./src/instrumentation.ts src/index.ts`
 * The `-r` (require) flag guarantees this side-effecting module runs before
 * `index.ts` is evaluated. We deliberately do NOT rely on a top-of-file import
 * in index.ts because TypeScript/esbuild may hoist other imports above it.
 *
 * Conforms to Plan/OBSERVABILITY.md §3:
 *   - OTLP over HTTP/protobuf (port 4318), NOT gRPC.
 *   - service.name = stitcher-api; resource attrs service.version + deployment.environment.
 *   - W3C Trace Context propagation (OTel default — left untouched).
 *   - OTEL_TRACES_SAMPLER=always_on default (dev: capture everything).
 *
 * Failure mode: the OTLP exporters retry/drop internally; a down collector must
 * NOT crash the server. We register a diag logger at ERROR level and swallow
 * any SDK start error so boot is unaffected.
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
import {
    diag,
    DiagConsoleLogger,
    DiagLogLevel,
} from "@opentelemetry/api";

// Surface OTel internal problems (e.g. exporter connection refused) at ERROR
// level only, so a down collector logs but never floods or crashes.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const SERVICE_NAME = process.env["OTEL_SERVICE_NAME"] || "stitcher-api";
const SERVICE_VERSION = process.env["npm_package_version"] || "0.1.0";
const DEPLOYMENT_ENV = process.env["NODE_ENV"] || "development";

// OTLP/HTTP base endpoint. The exporters append /v1/traces and /v1/metrics.
const OTLP_ENDPOINT =
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] || "http://localhost:4318";

// Default the sampler to always_on for dev unless the operator overrides it.
if (!process.env["OTEL_TRACES_SAMPLER"]) {
    process.env["OTEL_TRACES_SAMPLER"] = "always_on";
}

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    // deployment.environment.name is the stable convention key.
    "deployment.environment.name": DEPLOYMENT_ENV,
    // Keep the legacy key too for dashboards still querying it.
    "deployment.environment": DEPLOYMENT_ENV,
});

const traceExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
});

const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
        url: `${OTLP_ENDPOINT}/v1/metrics`,
    }),
    // Export every 15s — frequent enough for live queue-depth dashboards.
    exportIntervalMillis: 15_000,
});

const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
        getNodeAutoInstrumentations({
            // fs instrumentation is extremely noisy and not useful here.
            "@opentelemetry/instrumentation-fs": { enabled: false },
            // Explicitly keep the instrumentations the pipeline relies on.
            "@opentelemetry/instrumentation-http": { enabled: true },
            "@opentelemetry/instrumentation-express": { enabled: true },
            "@opentelemetry/instrumentation-ioredis": { enabled: true },
            "@opentelemetry/instrumentation-mongoose": { enabled: true },
        }),
    ],
});

try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
        `[otel] tracing + metrics initialized · service=${SERVICE_NAME} · endpoint=${OTLP_ENDPOINT}`
    );
} catch (err) {
    // A failed SDK start must never take down the API.
    // eslint-disable-next-line no-console
    console.error("[otel] failed to start SDK (continuing without telemetry)", String(err));
}

// Flush spans/metrics on shutdown so the last batch isn't lost.
const shutdownOtel = () => {
    sdk
        .shutdown()
        .catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.error("[otel] shutdown error", String(err));
        });
};
process.once("SIGTERM", shutdownOtel);
process.once("SIGINT", shutdownOtel);

export { sdk };

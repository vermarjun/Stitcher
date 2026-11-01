import { defineConfig } from "tsup";

// The HTTP service and seed CLI run directly via `tsx` for development.
// For the container we compile two bundles:
//   1. ESM library entry (src/index.ts) — for consumers of the npm package.
//   2. CJS server + instrumentation entry points — consumed by the Dockerfile
//      CMD:  node -r ./dist/instrumentation.cjs dist/server.cjs
export default defineConfig([
  // ── Library entry (ESM) ─────────────────────────────────────────────────
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node20",
    splitting: false,
    outDir: "dist",
    external: [
      "mongodb",
      "@huggingface/transformers",
      "fastify",
      "@fastify/rate-limit",
      "pino",
      "pino-pretty",
      "zod",
      "dotenv",
      "@opentelemetry/api",
      "@opentelemetry/sdk-node",
      "@opentelemetry/auto-instrumentations-node",
      "@opentelemetry/exporter-trace-otlp-http",
      "@opentelemetry/exporter-metrics-otlp-http",
      "@opentelemetry/sdk-metrics",
      "@opentelemetry/resources",
      "@opentelemetry/semantic-conventions",
      "@opentelemetry/sdk-trace-base",
    ],
  },
  // ── Server + instrumentation (CJS, for Dockerfile CMD) ─────────────────
  {
    entry: {
      server: "src/server.ts",
      seed: "seed.ts",
      instrumentation: "src/instrumentation.ts",
    },
    format: ["cjs"],
    dts: false,
    clean: false, // don't wipe the ESM build
    sourcemap: true,
    target: "node20",
    splitting: false,
    outDir: "dist",
    // Bundle everything into the CJS outputs — no external at runtime in container.
    // Except the local embedder: onnxruntime ships native binaries that cannot be bundled.
    noExternal: [/^(?!@huggingface\/transformers|onnxruntime-)/],
    external: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  },
]);

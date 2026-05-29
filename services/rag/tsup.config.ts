import { defineConfig } from "tsup";

// The HTTP service, seed CLI, and scraper run directly via `tsx` (see
// package.json scripts) — no bundling needed. tsup only builds the library
// entry so ManimRAG can be consumed as a package.
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  splitting: false,
  outDir: "dist",
  external: ["mongodb", "fastify", "@fastify/rate-limit", "pino", "pino-pretty", "zod", "dotenv"],
});

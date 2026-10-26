/**
 * ManimRAG — public library API.
 *
 *   import { connect, disconnect, enhance, health } from "manimrag";
 *   await connect();
 *   const result = await enhance({ prompt: "animate bubble sort with bars" });
 *   // result.groundedPrompt → feed to your code-gen model
 *   await disconnect();
 */

export { connect, disconnect, getDb } from "./db.js";
export { enhance } from "./core/pipeline.js";
export { runHealthCheck as health } from "./core/health.js";
export { resolveSettings } from "./core/settings.js";
export { createCorpusStore, CorpusStore } from "./store/mongodb.js";
export { embedQuery, embedBatch, embedderInfo } from "./providers/embedder.js";
export { config } from "./config.js";

export type { RequestOverrides, ByoKeys, ResolvedSettings } from "./core/settings.js";
export type { LlmTarget } from "./providers/llm.js";

export type {
  CorpusDoc,
  CorpusDocWithEmbedding,
  DocType,
  Complexity,
  EnhanceInput,
  EnhanceResult,
  StructuredContext,
  ApiExample,
  SimilarScript,
  RetrievalTrace,
  ExecutionTimings,
  HealthResult,
  ComponentHealth,
  CorpusStats,
  ScoredDoc,
  TransformedQuery,
} from "./types.js";

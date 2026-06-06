// ─── Corpus data model ───────────────────────────────────────────────────────
//
// A single, unified document model. `docType` discriminates between API
// reference docs and full runnable scene scripts so the assembler can bucket
// them into the response contract (apiExamples vs similarScripts).

export type DocType = "api" | "script";
export type Complexity = "beginner" | "intermediate" | "expert";

export interface CorpusDoc {
  id: string;
  docType: DocType;

  /** The text that was embedded (description / docstring content). */
  embedText: string;

  // Display / content fields
  title: string;
  content: string; // API: docstring/signature prose; script: NL description
  code: string; // exampleCode or full scene script ("" if none)

  // Manim grounding
  signature?: string;
  fullyQualifiedName?: string;
  apisUsed: string[];
  animationTypes: string[];

  // Classification / filtering
  category: string; // animations | mobjects | scenes | cameras | utilities | ...
  domain: string; // cs | math | physics | chemistry | biology | general
  level?: "module" | "class" | "method";
  tags: string[];
  complexity: Complexity;
  quality: number; // 1–5
  colorPalette: string[];
  manimVersion: string;

  source: string; // manim_docs | seed | gallery | github:<repo> | ...
  createdAt: string;
}

/** CorpusDoc plus the embedding vector — written to the store at seed time. */
export interface CorpusDocWithEmbedding extends CorpusDoc {
  embedding: number[];
}

// ─── Retrieval internals ───────────────────────────────────────────────────

export interface ScoredDoc {
  doc: CorpusDoc;
  /** Dense cosine similarity (Atlas vectorSearchScore), when available. */
  similarity: number;
  /** BM25/text relevance (Atlas searchScore), when sparse retrieval ran. */
  sparseScore?: number;
  /** Fused rank score (RRF) when dense+sparse were merged. */
  fusedScore?: number;
  /** Reranker relevance score (0..1) after the rerank stage. */
  rerankScore?: number;
}

export interface TransformedQuery {
  transformedQuery: string;
  suggestedApis: string[];
  /** CONTRACT 1: APIs the coder likely needs (from query-transform). */
  requiredApis: string[];
  /** Plugin slugs the request maps to, e.g. ["manim-chess"]. Drives skill injection. */
  requiredPlugins: string[];
  domain: string;
  tags: string[];
  estimatedComplexity: Complexity;
  /** True when the LLM transform actually ran (false ⇒ raw-query fallback). */
  ok: boolean;
}

// ─── /enhance response contract ──────────────────────────────────────────────

export interface ApiExample {
  symbol: string; // fully-qualified name or class/method symbol
  category: string;
  signature: string;
  docstring: string;
  snippet: string; // example code (may be "")
  source: string;
  score: number;
}

export interface SimilarScript {
  id: string;
  title: string;
  description: string;
  apisUsed: string[];
  animationTypes: string[];
  complexity: string;
  domain: string;
  colorPalette: string[];
  code: string;
  source: string;
  score: number;
}

export interface StructuredContext {
  apiExamples: ApiExample[];
  similarScripts: SimilarScript[];
  styleRecommendations: string[];
  pitfalls: string[];
  /** CONTRACT 1: APIs identified by query-transform as likely needed. */
  requiredApis: string[];
  /** Plugin slugs the request maps to, e.g. ["manim-chess"]. */
  requiredPlugins: string[];
}

export interface RetrievalTrace {
  denseCandidates: number;
  sparseCandidates: number;
  mergedCandidates: number;
  afterRerank: number;
  embedModel: string;
  rerankModel: string;
  store: string;
  queryTransformed: boolean;
  /** Number of distinct APIs covered by the coverage-greedy selection. */
  coveredApis?: number;
  stages: {
    queryTransform: boolean;
    sparse: boolean;
    rerank: boolean;
  };
}

export interface ExecutionTimings {
  totalMs: number;
  queryTransformMs: number;
  embeddingMs: number;
  vectorSearchMs: number;
  sparseSearchMs: number;
  rerankMs: number;
  assembleMs: number;
  llmCalls: number;
}

// ─── Pipeline trace (admin visibility into /enhance internals) ───────────────

export interface TraceQueryTransform {
  ran: boolean;
  provider: string;
  model: string;
  /** Full system prompt sent to the LLM (static API list + instructions). */
  systemPrompt: string;
  /** Full user message sent to the LLM. */
  userPrompt: string;
  /** Raw verbatim LLM response text. */
  rawOutput: string;
  /** The manim-language translation produced. */
  transformedQuery: string;
  /** APIs selected by the query-transform LLM. */
  requiredApis: string[];
  /** Plugin slugs selected by the query-transform LLM. */
  requiredPlugins: string[];
  tokensUsed: { input: number; output: number };
  durationMs: number;
}

export interface TraceEmbed {
  provider: string;
  model: string;
  dims: number;
  durationMs: number;
}

export interface TraceRetrieveCandidate {
  id: string;
  /** Short title / description, truncated to ~120 chars. No full code. */
  title: string;
  score: number;
  apisUsed?: string[];
}

export interface TraceRetrieve {
  /** Exact text passed into the vector search (transformedQuery or raw prompt). */
  searchQuery: string;
  /** Top dense/vector candidates (capped at 20). */
  dense: TraceRetrieveCandidate[];
  /** Top sparse/BM25 candidates (empty when sparse is disabled). */
  sparse: TraceRetrieveCandidate[];
  /** RRF-merged candidate pool (all). */
  merged: TraceRetrieveCandidate[];
  topK: number;
}

export interface TraceSelectCandidate {
  id: string;
  title: string;
  apisUsed: string[];
}

export interface TraceSelect {
  method: "coverage-greedy";
  selected: TraceSelectCandidate[];
  coveredApis: string[];
}

export interface PipelineTrace {
  queryTransform?: TraceQueryTransform;
  embed?: TraceEmbed;
  retrieve?: TraceRetrieve;
  select?: TraceSelect;
}

export interface EnhanceResult {
  groundedPrompt: string;
  structuredContext: StructuredContext;
  retrievalTrace: RetrievalTrace;
  execution: ExecutionTimings;
  /** Full pipeline trace for admin visibility. All steps are optional/defensive. */
  trace: PipelineTrace;
}

// ─── Per-request provider config override (CONTRACT 2) ───────────────────────
// Passed in the /enhance body as `providerConfig`. Both sub-keys are optional;
// absent → env default is used for that service.

// NOTE: string fields are `string | null` because the API resolves them from
// ServiceConfig as `string | null` (null = "use provider default") and sends them
// verbatim. The consumers all use `field ?? default`, so null is handled.
export interface QueryTransformProviderOverride {
  provider?: string | null;
  apiKey?: string | null;
  baseURL?: string | null;
  model?: string | null;
  /** Freeform provider params (e.g. temperature, max_tokens). */
  params?: Record<string, unknown>;
}

export interface EmbedderProviderOverride {
  provider?: string | null;
  apiKey?: string | null;
  /** Ordered backup API keys, tried after `apiKey` and before the env-default key. */
  backupApiKeys?: string[];
  baseURL?: string | null;
  model?: string | null;
}

export interface ProviderConfig {
  queryTransform?: QueryTransformProviderOverride;
  embedder?: EmbedderProviderOverride;
}

export interface EnhanceInput {
  prompt: string;
  topK?: number;
  /** Optional per-request provider overrides (CONTRACT 2). */
  providerConfig?: ProviderConfig;
}

// ─── /health ─────────────────────────────────────────────────────────────────

export type ComponentStatus = "ok" | "error" | "disabled";

export interface ComponentHealth {
  status: ComponentStatus;
  provider?: string;
  model?: string;
  documentCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface HealthResult {
  status: "ok" | "degraded" | "error";
  version: string;
  components: {
    vectorStore: ComponentHealth;
    embedder: ComponentHealth;
    reranker: ComponentHealth;
    llm: ComponentHealth;
  };
}

// ─── Corpus stats ──────────────────────────────────────────────────────────

export interface CorpusStats {
  total: number;
  byDocType: Record<string, number>;
  byCategory: Record<string, number>;
  byDomain: Record<string, number>;
}

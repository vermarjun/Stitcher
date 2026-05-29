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

export interface EnhanceResult {
  groundedPrompt: string;
  structuredContext: StructuredContext;
  retrievalTrace: RetrievalTrace;
  execution: ExecutionTimings;
}

export interface EnhanceInput {
  prompt: string;
  topK?: number;
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

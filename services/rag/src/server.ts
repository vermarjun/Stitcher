/**
 * ManimRAG HTTP service.
 *
 * Routes:
 *   POST   /enhance         — ground an NL animation request (the headline route)
 *   GET    /health          — per-component status (vectorStore, embedder, reranker, llm)
 *   GET    /capabilities     — enabled stages + models + dims
 *   POST   /corpus/add       — add documents to the corpus (embeds + upserts)
 *   GET    /corpus/stats     — counts by docType / category / domain
 *   DELETE /corpus/:id       — remove a document by id
 */

import crypto from "node:crypto";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";

import { connect, disconnect, getDb } from "./db.js";
import { enhance } from "./core/pipeline.js";
import { runHealthCheck } from "./core/health.js";
import { resolveSettings, type RequestOverrides, type ByoKeys } from "./core/settings.js";
import { createCorpusStore } from "./store/mongodb.js";
import { embedBatch, embedQuery, embedderInfo } from "./providers/embedder.js";
import { llmInfo, rerankerInfo } from "./providers/llm.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { traceMiddleware } from "./middleware/trace.js";
import type { CorpusDoc, CorpusDocWithEmbedding } from "./types.js";

const VERSION = process.env["npm_package_version"] ?? "2.0.0";

// ─── Schemas ─────────────────────────────────────────────────────────────────

// Per-request override of any stage/model/param (except the index-locked
// embedder). Every field is optional and bounded; absent → env default.
const TargetOverrideSchema = z
  .object({
    model: z.string().min(1).max(120).optional(),
    baseUrl: z.string().url().max(300).optional(),
    extraBody: z.record(z.unknown()).optional(),
  })
  .strict();

const OverridesSchema = z
  .object({
    stages: z
      .object({
        queryTransform: z.boolean().optional(),
        sparse: z.boolean().optional(),
        rerank: z.boolean().optional(),
        pitfalls: z.boolean().optional(),
      })
      .strict()
      .optional(),
    retrieval: z
      .object({
        denseTopK: z.number().int().positive().max(200).optional(),
        denseNumCandidates: z.number().int().positive().max(1000).optional(),
        sparseTopK: z.number().int().positive().max(200).optional(),
        rerankCandidates: z.number().int().positive().max(50).optional(),
        rerankDocChars: z.number().int().positive().max(4000).optional(),
        rerankTopN: z.number().int().positive().max(20).optional(),
        rrfK: z.number().int().positive().max(1000).optional(),
      })
      .strict()
      .optional(),
    timeouts: z
      .object({
        queryTransformMs: z.number().int().positive().max(60000).optional(),
        vectorSearchMs: z.number().int().positive().max(60000).optional(),
        rerankMs: z.number().int().positive().max(60000).optional(),
      })
      .strict()
      .optional(),
    llm: TargetOverrideSchema.optional(),
    reranker: TargetOverrideSchema.optional(),
    defaultTopK: z.number().int().positive().max(20).optional(),
  })
  .strict();

// Per-request provider config override (CONTRACT 2).
// Internal, admin-controlled config resolved by the API — keep validation lenient
// (allow empty strings, non-URL endpoints, extra fields) so the worker can pass
// the resolved service config verbatim without 400s.
// NOTE: baseURL/model/apiKey/provider use .nullish() (accept null | undefined |
// string) because the API resolves these from ServiceConfig as `string | null`
// (null = "use the provider default") and sends them verbatim. Plain .optional()
// rejects null → the whole /enhance request 400s. nullish keeps it tolerant.
const QueryTransformProviderOverrideSchema = z
  .object({
    provider: z.string().max(64).nullish(),
    apiKey: z.string().max(512).nullish(),
    baseURL: z.string().max(300).nullish(),
    model: z.string().max(120).nullish(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();

const EmbedderProviderOverrideSchema = z
  .object({
    provider: z.string().max(64).nullish(),
    apiKey: z.string().max(512).nullish(),
    // Ordered backup keys, tried after apiKey and before the env-default key.
    backupApiKeys: z.array(z.string().max(512)).max(20).optional(),
    baseURL: z.string().max(300).nullish(),
    model: z.string().max(120).nullish(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();

const ProviderConfigSchema = z
  .object({
    queryTransform: QueryTransformProviderOverrideSchema.optional(),
    embedder: EmbedderProviderOverrideSchema.optional(),
  })
  .passthrough();

const EnhanceBodySchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  options: z.object({ topK: z.number().int().positive().max(20).optional() }).optional(),
  overrides: OverridesSchema.optional(),
  providerConfig: ProviderConfigSchema.optional(),
});

const CorpusDocSchema = z.object({
  id: z.string().optional(),
  docType: z.enum(["api", "script"]).default("script"),
  title: z.string().optional(),
  content: z.string().default(""),
  code: z.string().default(""),
  signature: z.string().optional(),
  fullyQualifiedName: z.string().optional(),
  apisUsed: z.array(z.string()).default([]),
  animationTypes: z.array(z.string()).default([]),
  category: z.string().default("general"),
  domain: z.string().default("general"),
  tags: z.array(z.string()).default([]),
  complexity: z.enum(["beginner", "intermediate", "expert"]).default("intermediate"),
  quality: z.number().min(1).max(5).default(4),
  colorPalette: z.array(z.string()).default([]),
  manimVersion: z.string().default("0.19.0"),
  source: z.string().default("api_add"),
});

const CorpusAddBodySchema = z.object({
  documents: z.array(CorpusDocSchema).min(1, "documents must be a non-empty array"),
});

// ─── App ─────────────────────────────────────────────────────────────────────

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, ctx) => ({
      error: "rate_limit_exceeded",
      message: `Too many requests — limit is ${ctx.max} per minute`,
      retryAfter: ctx.ttl,
    }),
  });

  // Read X-Trace-Id from the API and stamp it on the active span so Tempo is
  // searchable by the human-facing trace ID (OBSERVABILITY_PLAN §3 Phase 1.2).
  app.addHook("onRequest", traceMiddleware);

  async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = request.headers["x-api-key"];
    const expected = config.RAG_API_KEY;
    if (!key || typeof key !== "string" || key.length !== expected.length) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected))) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  }

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get("/health", async (_req, reply) => {
    try {
      const result = await runHealthCheck();
      const code = result.status === "ok" ? 200 : result.status === "degraded" ? 200 : 503;
      return reply.code(code).send(result);
    } catch (err) {
      log.error({ err }, "Health check threw");
      return reply.code(503).send({ status: "error", version: VERSION, components: {} });
    }
  });

  // ── GET /capabilities ────────────────────────────────────────────────────
  app.get("/capabilities", async (_req, reply) => {
    return reply.send({
      version: VERSION,
      vectorStore: config.VECTOR_STORE,
      collection: config.COLLECTION_NAME,
      embedder: embedderInfo(),
      llm: llmInfo(),
      reranker: rerankerInfo(),
      stages: {
        queryTransform: config.STAGE_QUERY_TRANSFORM,
        sparse: config.STAGE_SPARSE,
        rerank: config.STAGE_RERANK,
        pitfalls: config.STAGE_PITFALLS,
      },
      retrieval: {
        denseTopK: config.DENSE_TOP_K,
        denseNumCandidates: config.DENSE_NUM_CANDIDATES,
        rerankCandidates: config.RERANK_CANDIDATES,
        defaultTopK: config.DEFAULT_TOP_K,
      },
      performanceTargets: { p95Ms: 3000, hardCeilingMs: 5000, vectorSearchMs: 150, embeddingMs: 800 },
      // What a caller may override per-request via the /enhance "overrides" object.
      // The embedder is index-locked and NOT overridable (set it in .env + re-seed).
      perRequestOverrides: {
        stages: ["queryTransform", "sparse", "rerank", "pitfalls"],
        retrieval: ["denseTopK", "denseNumCandidates", "sparseTopK", "rerankCandidates", "rerankDocChars", "rerankTopN", "rrfK"],
        timeouts: ["queryTransformMs", "vectorSearchMs", "rerankMs"],
        llm: ["model", "baseUrl", "extraBody"],
        reranker: ["model", "baseUrl", "extraBody"],
        defaultTopK: true,
        notOverridable: ["embedder (model/dim — index-locked)", "vectorStore", "auth"],
      },
      byokHeaders: { llm: "x-llm-key", reranker: "x-reranker-key" },
      reasoningNote:
        "Pass provider-specific reasoning/thinking params via overrides.llm.extraBody / overrides.reranker.extraBody (e.g. { \"thinking\": { \"type\": \"disabled\" } } or { \"reasoning_effort\": \"low\" }).",
    });
  });

  // ── POST /enhance ──────────────────────────────────────────────────────────
  app.post("/enhance", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = EnhanceBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    }

    // BYO keys come from headers (never the body) so they aren't logged with payloads.
    const hdr = (h: unknown) => (Array.isArray(h) ? h[0] : typeof h === "string" ? h : undefined);
    const byoKeys: ByoKeys = {
      llmKey: hdr(request.headers["x-llm-key"]),
      rerankerKey: hdr(request.headers["x-reranker-key"]),
    };

    // Resolve env defaults + request overrides. baseUrl validation can throw → 400.
    let settings;
    try {
      settings = resolveSettings(parsed.data.overrides as RequestOverrides | undefined, byoKeys);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: "invalid_overrides", message: err instanceof Error ? err.message : String(err) });
    }

    try {
      const result = await enhance(
        {
          prompt: parsed.data.prompt,
          topK: parsed.data.options?.topK,
          providerConfig: parsed.data.providerConfig,
        },
        settings
      );
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message, prompt: parsed.data.prompt }, "enhance() failed");
      return reply.code(500).send({ error: "pipeline_error", message });
    }
  });

  // ── POST /corpus/add ───────────────────────────────────────────────────────
  app.post("/corpus/add", { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = CorpusAddBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.issues });
    }
    try {
      const store = createCorpusStore(getDb());
      const docs: CorpusDoc[] = parsed.data.documents.map((d) => ({
        id: d.id ?? `add_${crypto.randomUUID()}`,
        docType: d.docType,
        embedText: d.content || d.title || "",
        title: d.title ?? d.fullyQualifiedName ?? d.id ?? "untitled",
        content: d.content,
        code: d.code,
        signature: d.signature,
        fullyQualifiedName: d.fullyQualifiedName,
        apisUsed: d.apisUsed,
        animationTypes: d.animationTypes,
        category: d.category,
        domain: d.domain,
        tags: d.tags,
        complexity: d.complexity,
        quality: d.quality,
        colorPalette: d.colorPalette,
        manimVersion: d.manimVersion,
        source: d.source,
        createdAt: new Date().toISOString(),
      }));

      const embeddings = await embedBatch(docs.map((d) => d.embedText || d.title));
      const withEmb: CorpusDocWithEmbedding[] = docs.map((d, i) => ({ ...d, embedding: embeddings[i]! }));
      const n = await store.bulkUpsert(withEmb);
      return reply.send({ added: docs.length, written: n, ids: docs.map((d) => d.id) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err: message }, "corpus/add failed");
      return reply.code(500).send({ error: "corpus_add_error", message });
    }
  });

  // ── GET /corpus/stats ──────────────────────────────────────────────────────
  app.get("/corpus/stats", { preHandler: requireApiKey }, async (_req, reply) => {
    try {
      const store = createCorpusStore(getDb());
      const stats = await store.stats();
      return reply.send(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: "stats_error", message });
    }
  });

  // ── DELETE /corpus/:id ──────────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    "/corpus/:id",
    { preHandler: requireApiKey },
    async (request, reply) => {
      try {
        const store = createCorpusStore(getDb());
        const deleted = await store.deleteById(request.params.id);
        if (!deleted) return reply.code(404).send({ error: "not_found", id: request.params.id });
        return reply.send({ deleted: true, id: request.params.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: "delete_error", message });
      }
    }
  );

  return app;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  if (config.RAG_API_KEY === "__unset__" || config.RAG_API_KEY.length < 16) {
    console.error("FATAL: RAG_API_KEY is not set or too short (min 16 chars). Set it before starting.");
    process.exit(1);
  }

  log.info("Starting ManimRAG HTTP service…");
  await connect();

  // Warm the embedder (e.g. load the Ollama model into memory) so the first
  // real request doesn't eat the cold-start latency. Best-effort.
  try {
    const t = Date.now();
    await embedQuery("warmup");
    log.info({ ms: Date.now() - t }, "Embedder warmed");
  } catch (err) {
    log.warn({ err: String(err) }, "Embedder warmup failed (non-fatal)");
  }

  const app = await buildApp();
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    log.info({ port: config.PORT, host: config.HOST }, "ManimRAG listening");
  } catch (err) {
    log.error(err, "Failed to start server");
    await disconnect();
    process.exit(1);
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      log.info({ signal }, "Shutting down…");
      await app.close();
      await disconnect();
      process.exit(0);
    });
  }
}

// Run when executed directly.
// ESM path (tsx dev): check import.meta.url against argv.
// CJS path (compiled Dockerfile bundle): import.meta.url is undefined — in that case
// the server file IS always the entry point, so just call main().
const _importMetaUrl: string | undefined =
  typeof import.meta !== "undefined" ? import.meta.url : undefined;
const isMain =
  !_importMetaUrl ||
  (_importMetaUrl === `file://${process.argv[1]}`) ||
  _importMetaUrl.endsWith(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}

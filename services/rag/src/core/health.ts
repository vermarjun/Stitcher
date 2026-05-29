import { getDb } from "../db.js";
import { createCorpusStore } from "../store/mongodb.js";
import { embedQuery, embedderInfo } from "../providers/embedder.js";
import { chatStructured, chatText, llmInfo, rerankerInfo } from "../providers/llm.js";
import { config } from "../config.js";
import { withTimeout } from "../util/retry.js";
import { resolveSettings } from "./settings.js";
import type { ComponentHealth, HealthResult } from "../types.js";

const VERSION = process.env["npm_package_version"] ?? "2.0.0";

// Health probes check *reachability*, not hot-path latency — give the LLM/
// reranker a generous window so a slow-but-working model reads as "ok".
const HEALTH_LLM_TIMEOUT_MS = 12_000;

async function timed(fn: () => Promise<void>): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await fn();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "error", latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runHealthCheck(): Promise<HealthResult> {
  const s = resolveSettings(); // env defaults — health probes reachability, not per-request config
  const [vectorStore, embedder, reranker, llm] = await Promise.all([
    // vector store — connectivity + document count
    (async (): Promise<ComponentHealth> => {
      const start = Date.now();
      try {
        const store = createCorpusStore(getDb());
        const count = await store.count();
        return { status: "ok", latencyMs: Date.now() - start, documentCount: count };
      } catch (err) {
        return {
          status: "error",
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })(),

    // embedder
    timed(async () => {
      const v = await withTimeout(embedQuery("health check ping"), config.EMBED_TIMEOUT_MS, "embed");
      if (!v.length) throw new Error("empty embedding");
    }).then((h) => ({ ...h, ...embedderInfo() })),

    // reranker (LLM completion)
    config.STAGE_RERANK
      ? timed(async () => {
          await withTimeout(
            chatText({ target: s.reranker, messages: [{ role: "user", content: "Reply with: ok" }], timeoutMs: HEALTH_LLM_TIMEOUT_MS }),
            HEALTH_LLM_TIMEOUT_MS,
            "reranker"
          );
        }).then((h) => ({ ...h, ...rerankerInfo() }))
      : Promise.resolve<ComponentHealth>({ status: "disabled", ...rerankerInfo() }),

    // llm (structured / tool_choice)
    // The LLM is always probed (it powers query-transform when enabled); a
    // generous timeout means "reachable + supports tool_choice", not "fast".
    timed(async () => {
      await withTimeout(
        chatStructured({
          target: s.llm,
          messages: [{ role: "user", content: "Return ping=pong" }],
          schema: { type: "object", properties: { ping: { type: "string" } }, required: ["ping"] },
          timeoutMs: HEALTH_LLM_TIMEOUT_MS,
        }),
        HEALTH_LLM_TIMEOUT_MS,
        "llm"
      );
    }).then((h) => ({ ...h, ...llmInfo() })),
  ]);

  const critical = [vectorStore, embedder];
  const optional = [reranker, llm];
  const criticalOk = critical.every((c) => c.status === "ok");
  const optionalOk = optional.every((c) => c.status === "ok" || c.status === "disabled");

  const status: HealthResult["status"] = !criticalOk ? "error" : optionalOk ? "ok" : "degraded";

  return {
    status,
    version: VERSION,
    components: {
      vectorStore: { provider: config.VECTOR_STORE, ...vectorStore },
      embedder,
      reranker,
      llm,
    },
  };
}

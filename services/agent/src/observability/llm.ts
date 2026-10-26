/**
 * LLM observability helpers — OTel GenAI spans + token metric + Langfuse.
 *
 * Conforms to Plan/OBSERVABILITY.md §3c:
 *   - Wrap every model call in a span `gen_ai.<role>` with GenAI semantic-
 *     convention attributes (gen_ai.system / request.model / operation.name /
 *     usage.input_tokens / usage.output_tokens).
 *   - Emit counter `stitcher.llm.tokens` {service, model, role, type=input|output}.
 *   - Optionally mirror the call to Langfuse (LangGraph callback handler) so the
 *     cost/prompt UI gets traces + tokens + cost.
 *
 * Everything here is ADDITIVE and fails open: if OTel isn't running the spans/
 * metrics are no-ops, and if Langfuse keys are unset the callback list is empty.
 */

import { trace, SpanStatusCode, metrics, Span } from "@opentelemetry/api";
import type { BaseMessage } from "@langchain/core/messages";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { ModelConfig } from "../models/factory.js";
import type { LlmCallLog } from "../graph/state.js";
import { config } from "../config.js";
import { getLogger } from "../logging.js";

const log = getLogger("observability");

const SERVICE = "stitcher-agent";
const tracer = trace.getTracer(SERVICE);
const meter = metrics.getMeter(SERVICE);

/** Counter: total LLM tokens, split by {service, model, role, type}. */
const tokenCounter = meter.createCounter("stitcher.llm.tokens", {
  description: "LLM tokens consumed by the Stitcher agent",
  unit: "{token}",
});

/** The agent roles that map to a `gen_ai.<role>` span name. */
export type LlmRole = "planner" | "coder" | "refiner" | "debugger";

/** Map LangChain provider id → OTel `gen_ai.system` value. */
function genAiSystem(provider: string): string {
  switch (provider) {
    case "openai":
      return "openai";
    case "anthropic":
      return "anthropic";
    case "gemini":
      return "gcp.gemini";
    case "bedrock":
      return "aws.bedrock";
    // OpenAI-compatible gateways — keep the concrete provider id so cost/usage
    // can be attributed correctly in Grafana/Langfuse.
    case "openrouter":
    case "groq":
    case "opencodego":
    case "ollama":
      return provider;
    default:
      return provider || "unknown";
  }
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Whether the provider actually returned a usage object. */
  available: boolean;
}

/**
 * Extract token usage from a LangChain agent/model result.
 *
 * `createReactAgent(...).invoke()` returns `{ messages: BaseMessage[] }`. The
 * per-call usage lives on each AIMessage's `usage_metadata` (LangChain's
 * normalised shape, populated for OpenAI/Anthropic/Gemini and OpenAI-compat
 * providers that return a `usage` object). We sum across all AIMessages so
 * multi-turn tool-using agents account for every model round-trip.
 */
export function extractUsage(result: unknown): TokenUsage {
  let input = 0;
  let output = 0;
  let available = false;

  // Helper to consume a single message's usage_metadata
  function consumeMsg(msg: unknown): void {
    const meta = (msg as { usage_metadata?: { input_tokens?: number; output_tokens?: number } })
      .usage_metadata;
    if (meta && (typeof meta.input_tokens === "number" || typeof meta.output_tokens === "number")) {
      input += meta.input_tokens ?? 0;
      output += meta.output_tokens ?? 0;
      available = true;
    }
  }

  // Case 1: ReAct agent result — { messages: BaseMessage[] }
  const messages = (result as { messages?: BaseMessage[] } | undefined)?.messages;
  if (Array.isArray(messages)) {
    for (const msg of messages) {
      consumeMsg(msg);
    }
  }

  // Case 2: model.invoke() result — a single BaseMessage with usage_metadata
  if (!available && result && typeof result === "object" && "content" in result) {
    consumeMsg(result);
  }

  return { inputTokens: input, outputTokens: output, available };
}

/** Emit the `stitcher.llm.tokens` counter for one call's usage. */
function recordTokenMetric(model: string, role: LlmRole, usage: TokenUsage): void {
  if (!usage.available) return;
  if (usage.inputTokens > 0) {
    tokenCounter.add(usage.inputTokens, { service: SERVICE, model, role, type: "input" });
  }
  if (usage.outputTokens > 0) {
    tokenCounter.add(usage.outputTokens, { service: SERVICE, model, role, type: "output" });
  }
}

/**
 * Wrap one LLM agent call in a `gen_ai.<role>` span, run it, then attach
 * GenAI usage attributes + emit the token metric from the result.
 *
 * `fn` receives the active span so the caller can stay agnostic of OTel. The
 * result is passed back unchanged so business logic is untouched.
 */
export async function withGenAiSpan<T>(
  role: LlmRole,
  cfg: ModelConfig,
  fn: () => Promise<T>
): Promise<T> {
  const provider = cfg.provider;
  const model = cfg.model;

  return tracer.startActiveSpan(`gen_ai.${role}`, async (span: Span) => {
    span.setAttribute("gen_ai.system", genAiSystem(provider));
    span.setAttribute("gen_ai.request.model", model);
    span.setAttribute("gen_ai.operation.name", "chat");
    const t0 = Date.now();
    try {
      const result = await fn();
      const usage = extractUsage(result);
      if (usage.available) {
        span.setAttribute("gen_ai.usage.input_tokens", usage.inputTokens);
        span.setAttribute("gen_ai.usage.output_tokens", usage.outputTokens);
      }
      recordTokenMetric(model, role, usage);
      span.setStatus({ code: SpanStatusCode.OK });
      // Best-effort: thread usage into the job's llmCallLog if the caller wants it.
      lastUsage = {
        role,
        provider,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        durationMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      };
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Side-channel for the most recent call's usage + I/O so node code can append it
 * to the LangGraph `llmCallLog` state (which the /generate response surfaces).
 * Read it immediately after `withGenAiSpan` resolves.
 *
 * `setLastIo` lets callers inject the captured I/O fields (systemPrompt,
 * userPrompt, fullInput, rawOutput, error) BEFORE reading via `takeLastUsage`,
 * so they are included in the returned log entry.
 */
let lastUsage: LlmCallLog | undefined;
let pendingIo: Pick<LlmCallLog, "systemPrompt" | "userPrompt" | "fullInput" | "rawOutput" | "error"> | undefined;

export function setLastIo(
  io: Pick<LlmCallLog, "systemPrompt" | "userPrompt" | "fullInput" | "rawOutput" | "error">
): void {
  pendingIo = io;
}

export function takeLastUsage(): LlmCallLog | undefined {
  const u = lastUsage;
  const io = pendingIo;
  lastUsage = undefined;
  pendingIo = undefined;
  if (!u) return undefined;
  return io ? { ...u, ...io } : u;
}

// ── Langfuse (optional) ───────────────────────────────────────────────────────

// Lazily-constructed handler factory. `langfuse-langchain`'s CallbackHandler
// implements LangChain's BaseCallbackHandler, so it plugs straight into
// `invoke(..., { callbacks: [...] })`. Imported lazily so the dependency is only
// touched when Langfuse is actually configured.
type LangfuseCtor = new (opts: Record<string, unknown>) => BaseCallbackHandler;
let CallbackHandlerCtor: LangfuseCtor | null | undefined;

function langfuseEnabled(): boolean {
  return Boolean(config.langfusePublicKey && config.langfuseSecretKey);
}

function getCallbackHandlerCtor(): LangfuseCtor | null {
  if (CallbackHandlerCtor !== undefined) return CallbackHandlerCtor;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("langfuse-langchain") as { CallbackHandler: unknown };
    CallbackHandlerCtor = mod.CallbackHandler as LangfuseCtor;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "langfuse-langchain not available — Langfuse disabled"
    );
    CallbackHandlerCtor = null;
  }
  return CallbackHandlerCtor;
}

/**
 * Build a Langfuse LangChain callback handler for one agent invocation, or
 * `undefined` if Langfuse is not configured. Pass the result (when present)
 * into `agent.invoke(input, { callbacks: getLangfuseCallbacks(...) })`.
 *
 * `traceId` (the human-facing X-Trace-Id propagated from the API) is forwarded
 * as the Langfuse `sessionId` + tag so a job's calls correlate in the UI.
 */
export function getLangfuseCallbacks(
  role: LlmRole,
  opts: { traceId?: string; jobId?: string } = {}
): BaseCallbackHandler[] | undefined {
  if (!langfuseEnabled()) return undefined;
  const Ctor = getCallbackHandlerCtor();
  if (!Ctor) return undefined;
  try {
    const handler = new Ctor({
      publicKey: config.langfusePublicKey,
      secretKey: config.langfuseSecretKey,
      baseUrl: config.langfuseHost,
      sessionId: opts.traceId,
      tags: [role, ...(opts.traceId ? [`trace:${opts.traceId}`] : [])],
      metadata: { jobId: opts.jobId, traceId: opts.traceId, role, service: SERVICE },
    });
    return [handler];
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "failed to build Langfuse callback handler"
    );
    return undefined;
  }
}

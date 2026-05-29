/**
 * OpenCode-Go LLM client — OpenAI-compatible chat completions over fetch.
 *
 *  - chatStructured(): forces a tool call (tool_choice) and returns the parsed
 *    arguments. ONLY glm-5.1 / kimi-k2.5 support tool_choice on OpenCode-Go;
 *    other models run in thinking mode and reject it.
 *  - chatText(): plain completion, any model (e.g. deepseek-v4-flash). Used by
 *    the LLM reranker.
 *
 * Provider/model/baseURL are all config-driven; nothing is hardcoded.
 */

import { config } from "../config.js";
import { withRetry, isTransient } from "../util/retry.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * A fully-resolved LLM endpoint for a single call. Built per request by
 * resolveSettings() (env defaults merged with request overrides / BYOK keys),
 * so nothing here reads the global config — model, key, baseUrl, and any
 * reasoning/thinking knobs (extraBody) are all caller-supplied.
 */
export interface LlmTarget {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Provider-specific params merged verbatim into the request body
   *  (e.g. { thinking: { type: "disabled" } } or { reasoning_effort: "low" }). */
  extraBody?: Record<string, unknown>;
}

async function postChat(
  target: LlmTarget,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // extraBody is spread first so it can ADD params (thinking/reasoning) but
    // never clobber the functional fields (messages/tools/tool_choice).
    const res = await fetch(`${target.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: JSON.stringify({ model: target.model, ...(target.extraBody ?? {}), ...body }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, `OpenCode ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Structured output via forced tool call. Returns the parsed arguments object.
 * `schema` is a JSON Schema for the tool parameters.
 */
export async function chatStructured<T = Record<string, unknown>>(opts: {
  target: LlmTarget;
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  toolName?: string;
  timeoutMs: number;
  temperature?: number;
}): Promise<T> {
  const target = opts.target;
  const toolName = opts.toolName ?? "emit";

  return withRetry(
    async () => {
      const data = await postChat(
        target,
        {
          messages: opts.messages,
          temperature: opts.temperature ?? 0,
          tools: [
            {
              type: "function",
              function: {
                name: toolName,
                description: "Emit the structured result.",
                parameters: opts.schema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: toolName } },
        },
        opts.timeoutMs
      );
      const msg = data?.choices?.[0]?.message;
      const argStr = msg?.tool_calls?.[0]?.function?.arguments;
      if (!argStr) {
        // Some models echo JSON in content instead of a tool call — try that.
        if (typeof msg?.content === "string") {
          const m = msg.content.match(/\{[\s\S]*\}/);
          if (m) return JSON.parse(m[0]) as T;
        }
        throw new Error("LLM returned no tool call / parseable JSON");
      }
      return JSON.parse(argStr) as T;
    },
    {
      retries: config.RETRY_MAX,
      baseMs: config.RETRY_BASE_MS,
      label: `opencode.chatStructured(${target.model})`,
      shouldRetry: isTransient,
    }
  );
}

/** Plain text completion (any model). */
export async function chatText(opts: {
  target: LlmTarget;
  messages: ChatMessage[];
  timeoutMs: number;
  temperature?: number;
}): Promise<string> {
  const target = opts.target;
  return withRetry(
    async () => {
      const data = await postChat(
        target,
        { messages: opts.messages, temperature: opts.temperature ?? 0 },
        opts.timeoutMs
      );
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new Error("LLM returned empty content");
      }
      return content;
    },
    {
      retries: config.RETRY_MAX,
      baseMs: config.RETRY_BASE_MS,
      label: `opencode.chatText(${target.model})`,
      shouldRetry: isTransient,
    }
  );
}

export function llmInfo() {
  return { provider: config.LLM_PROVIDER, model: config.LLM_MODEL, baseUrl: config.OPENCODE_GO_BASE_URL };
}
export function rerankerInfo() {
  return { provider: config.RERANKER_PROVIDER, model: config.RERANKER_MODEL };
}

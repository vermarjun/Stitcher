/**
 * Minimal direct LLM client for lightweight, API-side calls.
 *
 * The heavy generation/edit pipeline talks to the external Agent service. This
 * helper is for small, latency-tolerant calls the API makes itself — currently
 * just memory reflection. It uses the default LLM (LLM_PROVIDER, LLM_MODEL,
 * LLM_API_KEY, LLM_BASE_URL) through its OpenAI-compatible chat-completions
 * endpoint.
 *
 * RATE LIMIT: capped at LLM_HOURLY_CALL_LIMIT calls per hour (default 60) via
 * a Redis sliding-window counter. If the limit is hit the call is skipped and
 * a warning is logged — this prevents runaway background processes from draining
 * quota silently (e.g. a stuck LangGraph checkpointer retrying indefinitely).
 */

import axios from "axios";
import { resolveDirectLlm } from "../providers.config";
import logger from "./logger.util";
import { metrics } from "@opentelemetry/api";
import { pubClient } from "../queue/connection";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const RATE_LIMIT_KEY   = "stitcher:llm_util:hourly_calls";
const RATE_LIMIT_CAP   = 60;   // max background LLM calls per hour
const RATE_WINDOW_SEC  = 3600; // sliding window: 1 hour

/**
 * Increment the hourly counter in Redis.
 * Returns true if the call is allowed, false if the cap is reached.
 * Falls back to allowing the call when Redis is unavailable (never hard-blocks).
 */
async function checkRateLimit(): Promise<boolean> {
    try {
        const count = await pubClient.incr(RATE_LIMIT_KEY);
        if (count === 1) {
            // First call in this window — set the TTL
            await pubClient.expire(RATE_LIMIT_KEY, RATE_WINDOW_SEC);
        }
        if (count > RATE_LIMIT_CAP) {
            logger.warn({
                message: `[llm] hourly rate limit hit (${count}/${RATE_LIMIT_CAP}) — call skipped. ` +
                    `Check for stuck jobs or runaway background processes.`,
                count,
                cap: RATE_LIMIT_CAP,
            });
            return false;
        }
        return true;
    } catch (err) {
        // Redis unavailable — allow the call (don't block on infra issues)
        logger.warn({ message: "[llm] rate-limit Redis check failed (allowing call)", error: String(err) });
        return true;
    }
}

// ─── Prometheus counter ───────────────────────────────────────────────────────

const meter = metrics.getMeter("stitcher-api", "0.1.0");

const llmCallCounter = meter.createCounter("stitcher_llm_util_calls_total", {
    description: "Total LLM calls made by the API's internal llm.util client (memory reflection etc.)",
});

const llmRateLimitCounter = meter.createCounter("stitcher_llm_util_ratelimit_total", {
    description: "Times the llm.util hourly rate limit was hit — each increment means a call was skipped.",
});

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ChatCompletionParams {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

export function isLlmConfigured(): boolean {
    return resolveDirectLlm() !== null;
}

/**
 * Single-shot chat completion. Returns the assistant message content as a
 * string. Throws on transport/HTTP errors — callers decide whether that's fatal.
 * Returns "" silently when the hourly rate limit is exceeded.
 */
export async function chatCompletion(params: ChatCompletionParams): Promise<string> {
    const target = resolveDirectLlm();
    if (!target) {
        throw new Error("LLM is not configured (set LLM_API_KEY, or use LLM_PROVIDER=ollama)");
    }

    const allowed = await checkRateLimit();
    if (!allowed) {
        llmRateLimitCounter.add(1);
        return "";
    }

    llmCallCounter.add(1, { model: params.model ?? target.model });

    const res = await axios.post<{
        choices?: Array<{ message?: { content?: string } }>;
    }>(
        `${target.baseUrl}/chat/completions`,
        {
            model: params.model ?? target.model,
            messages: params.messages,
            temperature: params.temperature ?? 0.2,
            max_tokens: params.maxTokens ?? 512,
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${target.apiKey}`,
            },
            timeout: params.timeoutMs ?? 30_000,
        }
    );

    const content = res.data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
        logger.warn({ message: "[llm] empty completion content", model: params.model });
        return "";
    }
    return content;
}

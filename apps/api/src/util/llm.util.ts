/**
 * Minimal direct LLM client for lightweight, API-side calls.
 *
 * The heavy generation/edit pipeline talks to the external Agent service. This
 * helper is for small, latency-tolerant calls the API makes itself — currently
 * just memory reflection. It targets OpenCode Go, which is OpenAI-completions
 * compatible (base URL hardcoded per the project's OPENCODE_GO guide).
 *
 * RATE LIMIT: capped at LLM_HOURLY_CALL_LIMIT calls per hour (default 60) via
 * a Redis sliding-window counter. If the limit is hit the call is skipped and
 * a warning is logged — this prevents runaway background processes from draining
 * quota silently (e.g. a stuck LangGraph checkpointer retrying indefinitely).
 */

import axios from "axios";
import { config } from "../config";
import logger from "./logger.util";
import { metrics } from "@opentelemetry/api";
import { pubClient } from "../queue/connection";

const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

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
    return config.OPENCODE_GO_API_KEY.length > 0;
}

/**
 * Single-shot chat completion. Returns the assistant message content as a
 * string. Throws on transport/HTTP errors — callers decide whether that's fatal.
 * Returns "" silently when the hourly rate limit is exceeded.
 */
export async function chatCompletion(params: ChatCompletionParams): Promise<string> {
    if (!isLlmConfigured()) {
        throw new Error("OPENCODE_GO_API_KEY is not set");
    }

    const allowed = await checkRateLimit();
    if (!allowed) {
        llmRateLimitCounter.add(1);
        return "";
    }

    llmCallCounter.add(1, { model: params.model ?? config.OPENCODE_GO_DEFAULT_MODEL });

    const res = await axios.post<{
        choices?: Array<{ message?: { content?: string } }>;
    }>(
        `${OPENCODE_GO_BASE_URL}/chat/completions`,
        {
            model: params.model ?? config.OPENCODE_GO_DEFAULT_MODEL,
            messages: params.messages,
            temperature: params.temperature ?? 0.2,
            max_tokens: params.maxTokens ?? 512,
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.OPENCODE_GO_API_KEY}`,
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

/**
 * Current hourly call count (for the admin health endpoint).
 * Returns null when Redis is unavailable.
 */
export async function getLlmHourlyCallCount(): Promise<{ count: number; cap: number } | null> {
    try {
        const val = await pubClient.get(RATE_LIMIT_KEY);
        return { count: val ? parseInt(val, 10) : 0, cap: RATE_LIMIT_CAP };
    } catch {
        return null;
    }
}

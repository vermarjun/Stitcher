/**
 * Minimal direct LLM client for lightweight, API-side calls.
 *
 * The heavy generation/edit pipeline talks to the external Agent service. This
 * helper is for small, latency-tolerant calls the API makes itself — currently
 * just memory reflection. It targets OpenCode Go, which is OpenAI-completions
 * compatible (base URL hardcoded per the project's OPENCODE_GO guide).
 */

import axios from "axios";
import { config } from "../config";
import logger from "./logger.util";

// pi-ai registry hardcodes this for openai-completions opencode-go models.
const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

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
 */
export async function chatCompletion(params: ChatCompletionParams): Promise<string> {
    if (!isLlmConfigured()) {
        throw new Error("OPENCODE_GO_API_KEY is not set");
    }

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

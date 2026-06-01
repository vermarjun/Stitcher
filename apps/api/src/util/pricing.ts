/**
 * LLM token pricing table and cost computation.
 *
 * Prices are in USD per 1 million tokens.  The table is the single source of
 * truth — update it here when a provider changes pricing or when a new model
 * is added to the Stitcher stack.
 *
 * Unknown model → cost null + unknownModels flag set, never silently zero.
 * This prevents billing errors from silently under-counting.
 */

export interface ModelPrice {
    /** USD per 1 000 000 input (prompt) tokens */
    inputPer1M: number;
    /** USD per 1 000 000 output (completion) tokens */
    outputPer1M: number;
}

/**
 * Keyed by the model id string the agent emits in `LlmCallLogEntry.model`.
 * All prices as of 2026-05 (verify on provider pricing pages before billing).
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
    // ── GLM (Zhipu AI) ──────────────────────────────────────────────────────
    "glm-4-5": { inputPer1M: 0.14, outputPer1M: 0.14 },
    "glm-4-5-flash": { inputPer1M: 0.14, outputPer1M: 0.14 },

    // ── OpenAI ───────────────────────────────────────────────────────────────
    "gpt-4.1": { inputPer1M: 2.00, outputPer1M: 8.00 },
    "gpt-4.1-mini": { inputPer1M: 0.40, outputPer1M: 1.60 },
    "gpt-4.1-nano": { inputPer1M: 0.10, outputPer1M: 0.40 },
    "gpt-4o": { inputPer1M: 2.50, outputPer1M: 10.00 },
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
    "gpt-4-turbo": { inputPer1M: 10.00, outputPer1M: 30.00 },
    "gpt-3.5-turbo": { inputPer1M: 0.50, outputPer1M: 1.50 },
    "o1": { inputPer1M: 15.00, outputPer1M: 60.00 },
    "o1-mini": { inputPer1M: 3.00, outputPer1M: 12.00 },
    "o3": { inputPer1M: 10.00, outputPer1M: 40.00 },
    "o3-mini": { inputPer1M: 1.10, outputPer1M: 4.40 },
    "o4-mini": { inputPer1M: 1.10, outputPer1M: 4.40 },

    // ── Anthropic Claude ─────────────────────────────────────────────────────
    "claude-3-5-sonnet-20241022": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-3-5-sonnet-20240620": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-3-5-haiku-20241022": { inputPer1M: 0.80, outputPer1M: 4.00 },
    "claude-3-opus-20240229": { inputPer1M: 15.00, outputPer1M: 75.00 },
    "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },
    "claude-sonnet-4-5": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-opus-4-5": { inputPer1M: 15.00, outputPer1M: 75.00 },
    "claude-haiku-4-5": { inputPer1M: 0.80, outputPer1M: 4.00 },
    "claude-sonnet-4": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-opus-4": { inputPer1M: 15.00, outputPer1M: 75.00 },

    // ── Google Gemini ────────────────────────────────────────────────────────
    "gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
    "gemini-2.0-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.30 },
    "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.00 },
    "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.30 },
    "gemini-1.5-flash-8b": { inputPer1M: 0.0375, outputPer1M: 0.15 },

    // ── Mistral ──────────────────────────────────────────────────────────────
    "mistral-large-latest": { inputPer1M: 2.00, outputPer1M: 6.00 },
    "mistral-small-latest": { inputPer1M: 0.20, outputPer1M: 0.60 },

    // ── DeepSeek ─────────────────────────────────────────────────────────────
    "deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.10 },
    "deepseek-coder": { inputPer1M: 0.27, outputPer1M: 1.10 },
    "deepseek-r1": { inputPer1M: 0.55, outputPer1M: 2.19 },
};

// ─── Normalise model ids ──────────────────────────────────────────────────────
// Some providers include a version suffix (e.g. "gpt-4o-2024-05-13") that the
// table doesn't enumerate.  Strip known date-stamp patterns so "gpt-4o-2024-…"
// resolves to "gpt-4o".
function normaliseModelId(raw: string): string {
    // Strip trailing -YYYY-MM-DD or -YYYYMMDD suffixes
    return raw.replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-\d{8}$/, "");
}

// ─── Cost result ─────────────────────────────────────────────────────────────

export interface CostResult {
    /** Computed USD cost, or null if any model was unknown. */
    costUsd: number | null;
    /** Total input tokens across all log entries. */
    totalInputTokens: number;
    /** Total output tokens across all log entries. */
    totalOutputTokens: number;
    /** Model ids that were not found in MODEL_PRICING (empty = all known). */
    unknownModels: string[];
}

// ─── computeCostUsd ──────────────────────────────────────────────────────────

/**
 * Compute the USD cost of a set of LLM calls.
 *
 * Accepts either the raw `LlmCallLogEntry[]` array from the agent, or any
 * array of `{model, input, output}` objects (for flexibility).
 *
 * Returns `{costUsd: null, unknownModels: [...]}` if any model id is not in
 * the pricing table — never returns a silently-wrong zero.
 */
export function computeCostUsd(
    calls: Array<{ model: string; inputTokens?: number; outputTokens?: number; input?: number; output?: number }>
): CostResult {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    const unknownModels: string[] = [];

    for (const call of calls) {
        const inTok = call.inputTokens ?? call.input ?? 0;
        const outTok = call.outputTokens ?? call.output ?? 0;
        totalInput += inTok;
        totalOutput += outTok;

        const modelId = normaliseModelId(call.model ?? "");
        const price = MODEL_PRICING[modelId];
        if (!price) {
            if (call.model && !unknownModels.includes(call.model)) {
                unknownModels.push(call.model);
            }
        } else {
            totalCost += (inTok / 1_000_000) * price.inputPer1M
                       + (outTok / 1_000_000) * price.outputPer1M;
        }
    }

    return {
        costUsd: unknownModels.length > 0 ? null : totalCost,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        unknownModels,
    };
}

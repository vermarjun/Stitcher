/**
 * Shared token-usage helpers for the granular endpoints (/plan, /code, /debug).
 *
 * Factored from generate.ts:buildExecution() so the same summation logic is
 * reused everywhere without duplication.
 */

import type { LlmCallLog } from "../graph/state.js";

export interface TokensUsed {
  input: number;
  output: number;
  total: number;
}

/**
 * Summarise a `llmCallLog` array into a convenience `tokensUsed` object.
 * Safe to call with an empty / undefined array.
 */
export function sumLlmCallLog(callLog: LlmCallLog[]): TokensUsed {
  const input = callLog.reduce((s, c) => s + (c.inputTokens ?? 0), 0);
  const output = callLog.reduce((s, c) => s + (c.outputTokens ?? 0), 0);
  return { input, output, total: input + output };
}

/**
 * Extract the typed call log from raw graph state, falling back to [].
 */
export function extractLlmCallLog(state: Record<string, unknown>): LlmCallLog[] {
  return (state["llmCallLog"] ?? []) as LlmCallLog[];
}

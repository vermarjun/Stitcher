/**
 * BullMQ job payload and result types for the video-generation queue.
 */

import type { LlmRoleConfig } from "../services/agentClient";

// Re-export so callers only need one import
export type { LlmRoleConfig };

// ─── Per-role model configuration ────────────────────────────────────────────

export interface ResolvedModelConfig {
    planner: LlmRoleConfig;
    coder: LlmRoleConfig;
    debugger: LlmRoleConfig;
    validator?: LlmRoleConfig;
}

// ─── Job payload ─────────────────────────────────────────────────────────────

export interface VideoGenerationJobData {
    chatId: string;
    userId: string;
    projectId?: string;
    prompt: string;
    /** Pre-resolved model config; worker uses resolveModelConfig() if absent. */
    modelConfigOverride?: ResolvedModelConfig;
    generationOptions?: {
        targetTotalDurationSec?: number;
        minScenes?: number;
        maxScenes?: number;
        quality?: "low" | "medium" | "high";
    };
    /** UUID propagated from the originating HTTP request (req.id). */
    traceId: string;
}

// ─── Job result ──────────────────────────────────────────────────────────────

export interface VideoGenerationJobResult {
    finalUrl: string;
    thumbnailUrl?: string;
    durationSec: number;
    sceneAssets: Array<{ index: number; url: string; assetId: string }>;
    ragCorpusStored: boolean;
}

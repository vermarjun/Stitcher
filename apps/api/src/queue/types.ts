/**
 * BullMQ job payload and result types for the video-generation queue.
 */

// ─── Job payload ─────────────────────────────────────────────────────────────

export interface VideoGenerationJobData {
    chatId: string;
    userId: string;
    projectId?: string;
    prompt: string;
    generationOptions?: {
        targetTotalDurationSec?: number;
        minScenes?: number;
        maxScenes?: number;
        quality?: "low" | "medium" | "high";
        /**
         * Native voiceover. Feature-flagged OFF by default: when absent or
         * `enabled:false`, the pipeline behaves byte-for-byte as before (no
         * voiceover field sent to the agent/render services). When enabled, the
         * worker pre-synthesizes narration audio and bakes it via the render
         * service. `provider` overrides TTS_PROVIDER for this job.
         */
        voiceover?: {
            enabled: boolean;
            provider?: string;
            voice?: string;
            language?: string;
        };
    };
    /** UUID propagated from the originating HTTP request (req.id). */
    traceId: string;
    /**
     * W3C Trace Context carrier injected at enqueue time so the worker can
     * continue the originating request's distributed trace across the BullMQ
     * process/time boundary. Optional so older
     * queued jobs (without it) still process.
     */
    otelCarrier?: Record<string, string>;
}

// ─── Job result ──────────────────────────────────────────────────────────────

export interface VideoGenerationJobResult {
    finalUrl: string;
    thumbnailUrl?: string;
    durationSec: number;
    sceneAssets: Array<{ index: number; url: string; assetId: string }>;
    ragCorpusStored: boolean;
}

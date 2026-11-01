/**
 * BullMQ job payload and result types for the video-edit queue.
 */

export interface EditJobData {
    editChatId: string;
    userId: string;
    projectId: string;
    assetId: string;        // the asset whose code we're modifying
    trackId?: string;       // optional — needed if we're updating timeline
    timelineItemId?: string;// optional — if we want to replace an existing timeline item
    editPrompt: string;     // user's instruction
    traceId: string;
    /**
     * W3C Trace Context carrier injected at enqueue time so the edit worker can
     * continue the originating request's distributed trace across the BullMQ
     * boundary. Optional for back-compat.
     */
    otelCarrier?: Record<string, string>;
}

export interface EditJobResult {
    newAssetId: string;
    newAssetUrl: string;
    durationSec: number;
}

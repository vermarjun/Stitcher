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
}

export interface EditJobResult {
    newAssetId: string;
    newAssetUrl: string;
    durationSec: number;
}

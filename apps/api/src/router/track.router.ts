import express from 'express';
import {
    getAllTracks,
    addAssetToTrack,
    addTextToTrack,
    updateTimelineItem,
    deleteTimelineItem
} from '../controller/track.controller';

const router = express.Router();

/**
 * @desc    Get all tracks for a timeline with populated items and assets
 * @param   timelineId - The ID of the timeline
 */
router.get('/timeline/:timelineId', getAllTracks);

/**
 * @desc    Add an asset to a track (creates timeline item)
 * @param   trackId - The ID of the track to add asset to
 */
router.post('/:trackId/asset', addAssetToTrack);

/**
 * @desc    Add text to a track (creates text timeline item)
 * @param   trackId - The ID of the track to add text to
 */
router.post('/:trackId/text', addTextToTrack);

/**
 * @desc    Update a timeline item
 * @param   itemId - The ID of the timeline item to update
 */
router.put('/items/:itemId', updateTimelineItem);

// Additional utility routes you might want to add:

/**
 * @desc    Delete a timeline item and remove from track
 * @param   itemId - The ID of the timeline item to delete
 */
router.delete('/items/:timelineItemId', deleteTimelineItem);

export default router
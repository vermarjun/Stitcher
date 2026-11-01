import express from 'express';
import {
    getAllTracks,
    addAssetToTrack,
    addTextToTrack,
    updateTimelineItem,
    deleteTimelineItem
} from '../controller/track.controller';
import auth from '../middleware/auth.middleware';
import { requireTimelineItemOwnership, requireTimelineOwnership, requireTrackOwnership } from '../middleware/ownership.middleware';

const router = express.Router();

// All track routes require authentication
router.use(auth);

/**
 * @desc    Get all tracks for a timeline with populated items and assets
 * @param   timelineId - The ID of the timeline
 */
router.get('/timeline/:timelineId', requireTimelineOwnership('params', 'timelineId'), getAllTracks);

/**
 * @desc    Add an asset to a track (creates timeline item)
 * @param   trackId - The ID of the track to add asset to
 */
router.post('/:trackId/asset', requireTrackOwnership('params', 'trackId'), addAssetToTrack);

/**
 * @desc    Add text to a track (creates text timeline item)
 * @param   trackId - The ID of the track to add text to
 */
router.post('/:trackId/text', requireTrackOwnership('params', 'trackId'), addTextToTrack);

/**
 * @desc    Update a timeline item
 * @param   itemId - The ID of the timeline item to update
 */
router.put('/items/:itemId', requireTimelineItemOwnership('params', 'itemId'), updateTimelineItem);

/**
 * @desc    Delete a timeline item and remove from track
 * @param   itemId - The ID of the timeline item to delete
 */
router.delete('/items/:timelineItemId', requireTimelineItemOwnership('params', 'timelineItemId'), deleteTimelineItem);

export default router;

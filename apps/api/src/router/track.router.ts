import express from 'express';
import {
    getAllTracks,
    addAssetToTrack,
    addTextToTrack,
    updateTimelineItem,
    deleteTimelineItem
} from '../controller/track.controller';
import auth from '../middleware/auth.middleware';
import {
    requireTimelineAccess,
    requireTrackEditor,
    requireTimelineItemEditor,
} from '../middleware/access.middleware';

const router = express.Router();

// All track routes require authentication
router.use(auth);

/**
 * @desc    Get all tracks for a timeline with populated items and assets
 * @param   timelineId - The ID of the timeline
 */
router.get('/timeline/:timelineId', requireTimelineAccess('params', 'timelineId'), getAllTracks);

/**
 * @desc    Add an asset to a track (creates timeline item)
 * @param   trackId - The ID of the track to add asset to
 */
router.post('/:trackId/asset', requireTrackEditor('params', 'trackId'), addAssetToTrack);

/**
 * @desc    Add text to a track (creates text timeline item)
 * @param   trackId - The ID of the track to add text to
 */
router.post('/:trackId/text', requireTrackEditor('params', 'trackId'), addTextToTrack);

/**
 * @desc    Update a timeline item
 * @param   itemId - The ID of the timeline item to update
 */
router.put('/items/:itemId', requireTimelineItemEditor('params', 'itemId'), updateTimelineItem);

/**
 * @desc    Delete a timeline item and remove from track
 * @param   itemId - The ID of the timeline item to delete
 */
router.delete('/items/:timelineItemId', requireTimelineItemEditor('params', 'timelineItemId'), deleteTimelineItem);

export default router;

import express from 'express';
import {
    getAllTracks,
    addAssetToTrack,
    addTextToTrack,
    updateTimelineItem
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
router.delete('/items/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        
        if (!itemId || !require('mongoose').Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid itemId is required'
            });
        }

        // Find and delete the timeline item
        const timelineItem = await require('../models/TimelineItem').default.findById(itemId);
        if (!timelineItem) {
            return res.status(404).json({
                success: false,
                message: 'Timeline item not found'
            });
        }

        // Remove from track's items array
        await require('../models/Track').default.findByIdAndUpdate(
            timelineItem.trackId,
            { $pull: { items: itemId } }
        );

        // Delete the timeline item
        await require('../models/TimelineItem').default.findByIdAndDelete(itemId);

        res.status(200).json({
            success: true,
            message: 'Timeline item deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting timeline item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete timeline item',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * @desc    Get a single track with populated items
 * @param   trackId - The ID of the track
 */
router.get('/:trackId', async (req, res) => {
    try {
        const { trackId } = req.params;
        
        if (!trackId || !require('mongoose').Types.ObjectId.isValid(trackId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid trackId is required'
            });
        }

        const track = await require('../models/Track').default
            .findById(trackId)
            .populate({
                path: 'items',
                model: 'TimelineItem',
                populate: {
                    path: 'assetId',
                    model: 'Asset'
                }
            });

        if (!track) {
            return res.status(404).json({
                success: false,
                message: 'Track not found'
            });
        }

        res.status(200).json({
            success: true,
            data: track
        });

    } catch (error) {
        console.error('Error fetching track:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch track',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * @desc    Update track properties (order, muted, locked, etc.)
 * @param   trackId - The ID of the track
 */
router.put('/:trackId', async (req, res) => {
    try {
        const { trackId } = req.params;
        const updates = req.body;

        if (!trackId || !require('mongoose').Types.ObjectId.isValid(trackId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid trackId is required'
            });
        }

        // Only allow certain fields to be updated
        const allowedUpdates = ['order', 'locked', 'muted'];
        const updateData: any = {};

        for (const field of allowedUpdates) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const track = await require('../models/Track').default
            .findByIdAndUpdate(trackId, updateData, { new: true, runValidators: true })
            .populate({
                path: 'items',
                model: 'TimelineItem',
                populate: {
                    path: 'assetId',
                    model: 'Asset'
                }
            });

        if (!track) {
            return res.status(404).json({
                success: false,
                message: 'Track not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Track updated successfully',
            data: track
        });

    } catch (error) {
        console.error('Error updating track:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update track',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
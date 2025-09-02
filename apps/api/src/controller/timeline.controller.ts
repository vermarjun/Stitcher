import { Request, Response } from 'express';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import { Types } from 'mongoose';

// Get timeline by project ID
export const getTimelineByProjectId = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const timeline = await Timeline.findOne({ projectId })
      .populate({
        path: 'tracks',
        populate: {
          path: 'items',
          model: 'TimelineItem',
          populate: {
            path: 'assetId',
            model: 'Asset',
            select: 'name url thumbnail duration type'
          }
        }
      })
      .exec();

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found for this project' });
    }

    res.status(200).json(timeline);
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const updateTimeline = async (req: Request, res: Response) => {
  try {
    const { timelineId } = req.params;
    const updates = req.body;

    if (!timelineId || !Types.ObjectId.isValid(timelineId)) {
      return res.status(400).json({ error: 'Valid timelineId is required' });
    }

    // --- 1) Update timeline-level fields only ---
    const timelineFields = {
      resolution: updates.resolution,
      duration: updates.duration,
      fps: updates.fps,
      snapToGrid: updates.snapToGrid,
      gridSize: updates.gridSize,
      zoom: updates.zoom
    };

    const timeline = await Timeline.findByIdAndUpdate(
      timelineId,
      { $set: timelineFields },
      { new: true, runValidators: true }
    );

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // --- 2) Update tracks ---
    if (Array.isArray(updates.tracks)) {
      for (const trackUpdate of updates.tracks) {
        if (!trackUpdate._id || !Types.ObjectId.isValid(trackUpdate._id)) continue;

        // Update track
        await Track.findByIdAndUpdate(
          trackUpdate._id,
          {
            $set: {
              order: trackUpdate.order,
              type: trackUpdate.type,
              locked: trackUpdate.locked,
              muted: trackUpdate.muted
            }
          },
        );
        
        // --- 3) Update timeline items inside this track ---
        if (Array.isArray(trackUpdate.items)) {
          for (const itemUpdate of trackUpdate.items) {
            if (!itemUpdate._id || !Types.ObjectId.isValid(itemUpdate._id)) continue;
            
            await TimelineItem.findByIdAndUpdate(
              itemUpdate._id,
              { $set: { ...itemUpdate } }
            );
          }
        }
      }
    }

    // --- 4) Return the updated timeline fully populated ---
    const updatedTimeline = await Timeline.findById(timelineId)
      .populate({
        path: 'tracks',
        model: 'Track',
        populate: {
          path: 'items',
          model: 'TimelineItem',
          populate: {
            path: 'assetId',
            model: 'Asset'
          }
        }
      });

    res.status(200).json({
      success: true,
      message: 'Synced',
      updatedTimeline: updatedTimeline
    });
  } catch (error) {
    console.error('Error updating timeline:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error 
    });
  }
};
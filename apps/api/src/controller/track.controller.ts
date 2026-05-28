import { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as Y from 'yjs';
import Track, { TrackType } from '../model/track.model';
import TimelineItem, { ITimelineItem, IVideoTimelineItem, IAudioTimelineItem, ITextTimelineItem, TextAnimationType } from '../model/timelineitem.model';
import Asset, { AssetType } from '../model/asset.model';
import Timeline from '../model/timeline.model';
import { getYjsDoc } from '../collab/yjs.server';

// Interface for request bodies
interface AddAssetToTrackRequest {
    assetId: string;
    sourceStartTime?: number;
    sourceEndTime?: number;
    speed?: number;
    volume?: number;
    opacity?: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    fadeIn?: number;
    fadeOut?: number;
}

interface AddTextToTrackRequest {
    content: string;
    startTime: number;
    endTime: number;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    opacity?: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    animationIn?: TextAnimationType;
    animationOut?: TextAnimationType;
}

interface UpdateTimelineItemRequest {
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    speed?: number;
    volume?: number;
    opacity?: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    fadeIn?: number;
    fadeOut?: number;
    content?: string;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    animationIn?: TextAnimationType;
    animationOut?: TextAnimationType;
}

export const getAllTracks = async (req: Request, res: Response): Promise<void> => {
    try {
        const { timelineId } = req.params;

        if (!timelineId || !Types.ObjectId.isValid(timelineId)) {
            res.status(400).json({
                success: false,
                message: 'Valid timelineId is required'
            });
            return;
        }

        const tracks = await Track.find({ timelineId: new Types.ObjectId(timelineId) })
            .populate({
                path: 'items',
                model: 'TimelineItem',
                populate: {
                    path: 'assetId',
                    model: 'Asset'
                }
            })
            .sort({ order: 1 }) // Sort by layer order
            .exec();

        res.status(200).json({
            success: true,
            data: tracks,
            count: tracks.length
        });

    } catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tracks',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Add an asset to a track (creates TimelineItem and adds to track)
 */

export const addAssetToTrack = async (req: Request, res: Response): Promise<void> => {
    try {
        const { trackId } = req.params;
        const requestBody = req.body as AddAssetToTrackRequest;
        
        // Validate required fields
        if (!trackId || !Types.ObjectId.isValid(trackId)) {
            res.status(400).json({
                success: false,
                message: 'Valid trackId is required'
            });
            return;
        }
        const { assetId } = requestBody;
        if (!assetId || !Types.ObjectId.isValid(assetId)) {
            res.status(400).json({
                success: false,
                message: 'Valid assetId is required'
            });
            return;
        }
        
        // Find the track and populate its items
        const track = await Track.findById(trackId).populate('items');
        if (!track) {
            res.status(404).json({
                success: false,
                message: 'Track not found'
            });
            return;
        }
        
        // Find the asset and validate it matches track type
        const asset = await Asset.findById(assetId);
        if (!asset) {
            res.status(404).json({
                success: false,
                message: 'Asset not found'
            });
            return;
        }
        
        // Validate asset type matches track type
        if ((track.type === TrackType.VIDEO && asset.type !== AssetType.VIDEO) ||
            (track.type === TrackType.AUDIO && asset.type !== AssetType.AUDIO)) {
            res.status(400).json({
                success: false,
                message: `Asset type ${asset.type} does not match track type ${track.type}`
            });
            return;
        }
        
        // Calculate start time based on existing items
        let startTime = 0;
        if (track.items && track.items.length > 0) {
            // Sort items by end time and get the last one
            const sortedItems = (track.items as any[]).sort((a, b) => a.endTime - b.endTime);
            const lastItem = sortedItems[sortedItems.length - 1];
            startTime = lastItem.endTime;
        }
        
        // Calculate end time based on asset duration.
        // Fall back to a 5s default when the asset has no usable duration
        // (e.g. older generated assets predating ffprobe duration, or assets
        // whose duration was never populated) so the timeline item still has
        // a visible, draggable width instead of collapsing to zero.
        const DEFAULT_CLIP_SEC = 5;
        const assetDuration = asset.duration && asset.duration > 0 ? asset.duration : DEFAULT_CLIP_SEC;
        const sourceStartTime = requestBody.sourceStartTime ?? 0;
        const requestedEnd = requestBody.sourceEndTime ?? assetDuration;
        const sourceEndTime = requestedEnd > sourceStartTime ? requestedEnd : sourceStartTime + assetDuration;
        const speed = requestBody.speed ?? 1;

        // Calculate the actual duration considering source trim and speed
        const sourceDuration = sourceEndTime - sourceStartTime;
        const playbackDuration = Math.max(sourceDuration / speed, 0.5);
        const endTime = startTime + playbackDuration;
        
        // Create timeline item based on track type
        let timelineItemData: Partial<ITimelineItem>;
        if (track.type === TrackType.VIDEO) {
            timelineItemData = {
                type: 'video',
                trackId: track._id,
                startTime,
                endTime,
                assetId: asset._id,
                sourceStartTime,
                sourceEndTime,
                speed,
                volume: requestBody.volume ?? 1,
                opacity: requestBody.opacity ?? 1,
                x: requestBody.x ?? 0,
                y: requestBody.y ?? 0,
                scaleX: requestBody.scaleX ?? 1,
                scaleY: requestBody.scaleY ?? 1,
                rotation: requestBody.rotation ?? 0,
                metadata: {}
            } as IVideoTimelineItem;
        } else if (track.type === TrackType.AUDIO) {
            timelineItemData = {
                type: 'audio',
                trackId: track._id,
                startTime,
                endTime,
                assetId: asset._id,
                sourceStartTime,
                sourceEndTime,
                speed,
                volume: requestBody.volume ?? 1,
                fadeIn: requestBody.fadeIn ?? 0,
                fadeOut: requestBody.fadeOut ?? 0,
                metadata: {}
            } as IAudioTimelineItem;
        } else {
            res.status(400).json({
                success: false,
                message: 'Cannot add asset to text track'
            });
            return;
        }
        
        // Create the timeline item
        const timelineItem = new TimelineItem(timelineItemData);
        await timelineItem.save();
        
        // Add timeline item to track
        track.items.push(timelineItem._id as Types.ObjectId);
        await track.save();
        
        asset.isOnTimeline = true;
        await asset.save();
        
        // Update timeline duration
        const timeline = await Timeline.findOne({ _id: track.timelineId });
        if (timeline) {
            // Calculate new timeline duration by finding the maximum end time across all tracks
            const allTracks = await Track.find({ timelineId: timeline._id }).populate('items');
            let maxEndTime = 0;
            
            for (const t of allTracks) {
                if (t.items && t.items.length > 0) {
                    const trackItems = t.items as any[];
                    for (const item of trackItems) {
                        if (item.endTime > maxEndTime) {
                            maxEndTime = item.endTime;
                        }
                    }
                }
            }
            
            timeline.duration = maxEndTime;
            await timeline.save();
        }
        
        // Populate the created timeline item with asset data
        const populatedTimelineItem = await TimelineItem.findById(timelineItem._id).populate('assetId');

        // ── Phase 5: propagate new item into the live Y.Doc so all collaborators
        //    see it without a page refresh (mutation completeness).
        //    We use the Mongo-assigned _id as the Y.Doc item id so it stays
        //    aligned — materialize() will find it by id and skip re-creating it.
        try {
          const projectId = (track.projectId as unknown as { toString(): string } | null)?.toString() ?? '';
          if (projectId) {
            const ydoc = getYjsDoc(projectId);
            if (ydoc) {
              const timelineMap = ydoc.getMap<unknown>('timeline');
              const tracksArray = timelineMap.get('tracks') as Y.Array<Y.Map<unknown>> | undefined;
              if (tracksArray) {
                // Find the matching track Y.Map
                let targetTrack: Y.Map<unknown> | null = null;
                for (let i = 0; i < tracksArray.length; i++) {
                  const t = tracksArray.get(i);
                  if ((t.get('id') as string) === trackId) { targetTrack = t; break; }
                }
                if (targetTrack) {
                  // Cast to any to bypass Mongoose union-type limitations on lean doc
                  const it = timelineItem as any;
                  const assetRef = asset as any;
                  ydoc.transact(() => {
                    const itemsArray = (targetTrack as Y.Map<unknown>).get('items') as Y.Array<Y.Map<unknown>>;
                    const itemMap = new Y.Map<unknown>();
                    itemMap.set('id', it._id.toString());
                    itemMap.set('type', it.type);
                    itemMap.set('startTime', it.startTime);
                    itemMap.set('endTime', it.endTime);
                    itemMap.set('assetId', assetRef._id.toString());
                    if (it.sourceStartTime != null) itemMap.set('sourceStartTime', it.sourceStartTime);
                    if (it.sourceEndTime != null) itemMap.set('sourceEndTime', it.sourceEndTime);
                    if (it.volume != null) itemMap.set('volume', it.volume);
                    itemsArray.push([itemMap]);
                  }, 'rest-add-asset');
                }
              }
            }
          }
        } catch (yjsErr) {
          // Non-fatal: the Y.Doc write is best-effort; Mongo is the source of truth
          console.error('Y.Doc add-asset propagation error (non-fatal):', yjsErr);
        }

        res.status(201).json({
            success: true,
            message: 'Asset added to track successfully',
            data: {
                timelineItem: populatedTimelineItem,
                track,
                timelineDuration: timeline?.duration || 0
            }
        });
    } catch (error) {
        console.error('Error adding asset to track:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add asset to track',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Add text object to track (creates text TimelineItem)
 */
export const addTextToTrack = async (req: Request, res: Response): Promise<void> => {
    try {
        const { trackId } = req.params;
        const requestBody = req.body as AddTextToTrackRequest;

        // Validate required fields
        if (!trackId || !Types.ObjectId.isValid(trackId)) {
            res.status(400).json({
                success: false,
                message: 'Valid trackId is required'
            });
            return;
        }

        const { content, startTime, endTime } = requestBody;

        if (!content || content.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Content is required for text items'
            });
            return;
        }

        if (typeof startTime !== 'number' || typeof endTime !== 'number' || startTime >= endTime) {
            res.status(400).json({
                success: false,
                message: 'Valid startTime and endTime are required (startTime must be less than endTime)'
            });
            return;
        }

        // Find the track and validate it's a text track
        const track = await Track.findById(trackId);
        if (!track) {
            res.status(404).json({
                success: false,
                message: 'Track not found'
            });
            return;
        }

        if (track.type !== TrackType.TEXT) {
            res.status(400).json({
                success: false,
                message: 'Can only add text items to text tracks'
            });
            return;
        }

        // Create text timeline item
        const textTimelineItem: Partial<ITextTimelineItem> = {
            type: 'text',
            trackId: track._id as Types.ObjectId,
            startTime,
            endTime,
            content: content.trim(),
            fontFamily: requestBody.fontFamily ?? 'Arial',
            fontSize: requestBody.fontSize ?? 24,
            color: requestBody.color ?? '#ffffff',
            opacity: requestBody.opacity ?? 1,
            x: requestBody.x ?? 0,
            y: requestBody.y ?? 0,
            scaleX: requestBody.scaleX ?? 1,
            scaleY: requestBody.scaleY ?? 1,
            rotation: requestBody.rotation ?? 0,
            animationIn: requestBody.animationIn ?? TextAnimationType.NONE,
            animationOut: requestBody.animationOut ?? TextAnimationType.NONE,
            metadata: {}
        };

        // Create the timeline item
        const timelineItem = new TimelineItem(textTimelineItem);
        await timelineItem.save();

        // Add timeline item to track
        track.items.push(timelineItem._id as Types.ObjectId);
        await track.save();

        res.status(201).json({
            success: true,
            message: 'Text added to track successfully',
            data: {
                timelineItem,
                track
            }
        });

    } catch (error) {
        console.error('Error adding text to track:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add text to track',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Update timeline item
 */
export const updateTimelineItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { itemId } = req.params;
        const updates = req.body as UpdateTimelineItemRequest;

        // Validate timeline item ID
        if (!itemId || !Types.ObjectId.isValid(itemId)) {
            res.status(400).json({
                success: false,
                message: 'Valid itemId is required'
            });
            return;
        }

        // Find the timeline item
        const timelineItem = await TimelineItem.findById(itemId).populate('assetId');
        if (!timelineItem) {
            res.status(404).json({
                success: false,
                message: 'Timeline item not found'
            });
            return;
        }

        // Validate time constraints if being updated
        if (updates.startTime !== undefined || updates.endTime !== undefined) {
            const newStartTime = updates.startTime ?? timelineItem.startTime;
            const newEndTime = updates.endTime ?? timelineItem.endTime;
            
            if (newStartTime >= newEndTime) {
                res.status(400).json({
                    success: false,
                    message: 'startTime must be less than endTime'
                });
                return;
            }
        }

        // Create update object with only provided fields
        const updateData: Record<string, any> = {};
        
        // Common fields
        if (updates.startTime !== undefined) updateData.startTime = updates.startTime;
        if (updates.endTime !== undefined) updateData.endTime = updates.endTime;
        if (updates.opacity !== undefined) updateData.opacity = updates.opacity;
        if (updates.x !== undefined) updateData.x = updates.x;
        if (updates.y !== undefined) updateData.y = updates.y;
        if (updates.scaleX !== undefined) updateData.scaleX = updates.scaleX;
        if (updates.scaleY !== undefined) updateData.scaleY = updates.scaleY;
        if (updates.rotation !== undefined) updateData.rotation = updates.rotation;

        // Type-specific fields
        if (timelineItem.type === 'video' || timelineItem.type === 'audio') {
            if (updates.sourceStartTime !== undefined) updateData.sourceStartTime = updates.sourceStartTime;
            if (updates.sourceEndTime !== undefined) updateData.sourceEndTime = updates.sourceEndTime;
            if (updates.speed !== undefined) updateData.speed = updates.speed;
            if (updates.volume !== undefined) updateData.volume = updates.volume;
            
            if (timelineItem.type === 'audio') {
                if (updates.fadeIn !== undefined) updateData.fadeIn = updates.fadeIn;
                if (updates.fadeOut !== undefined) updateData.fadeOut = updates.fadeOut;
            }
        } else if (timelineItem.type === 'text') {
            if (updates.content !== undefined) updateData.content = updates.content.trim();
            if (updates.fontFamily !== undefined) updateData.fontFamily = updates.fontFamily;
            if (updates.fontSize !== undefined) updateData.fontSize = updates.fontSize;
            if (updates.color !== undefined) updateData.color = updates.color;
            if (updates.animationIn !== undefined) updateData.animationIn = updates.animationIn;
            if (updates.animationOut !== undefined) updateData.animationOut = updates.animationOut;
        }

        // Validate text content if being updated
        if (timelineItem.type === 'text' && updates.content !== undefined && updates.content.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Content cannot be empty for text items'
            });
            return;
        }

        // Update the timeline item
        const updatedTimelineItem = await TimelineItem.findByIdAndUpdate(
            itemId,
            updateData,
            { new: true, runValidators: true }
        ).populate('assetId');

        res.status(200).json({
            success: true,
            message: 'Timeline item updated successfully',
            data: updatedTimelineItem
        });

    } catch (error) {
        console.error('Error updating timeline item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update timeline item',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

interface DeleteTimelineItemRequest extends Request {
  params: {
    timelineItemId: string;
  };
}

export const deleteTimelineItem = async (req: DeleteTimelineItemRequest, res: Response) => {
  try {
    const { timelineItemId } = req.params;

    // Validate the timelineItemId
    if (!Types.ObjectId.isValid(timelineItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeline item ID'
      });
    }

    // Find the timeline item first to get the trackId and assetId
    const timelineItem = await TimelineItem.findById(timelineItemId);
    
    if (!timelineItem) {
      return res.status(404).json({
        success: false,
        message: 'Timeline item not found'
      });
    }

    const { trackId, assetId } = timelineItem;

    // Start a transaction to ensure data consistency
    const session = await TimelineItem.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Delete the timeline item
        await TimelineItem.findByIdAndDelete(timelineItemId).session(session);

        // 2. Remove the timeline item reference from the track
        await Track.findByIdAndUpdate(
          trackId,
          { $pull: { items: new Types.ObjectId(timelineItemId) } },
          { session }
        );

        // 3. If the timeline item has an associated asset, update its isOnTimeline status
        if (assetId) {
          // Check if this asset is still being used by other timeline items
          const remainingUsage = await TimelineItem.countDocuments({ 
            assetId: assetId,
            _id: { $ne: new Types.ObjectId(timelineItemId) }
          }).session(session);

          // If no other timeline items are using this asset, mark it as not on timeline
          if (remainingUsage === 0) {
            await Asset.findByIdAndUpdate(
              assetId,
              { isOnTimeline: false },
              { session }
            );
          }
        }
      });

      // Success response
      res.status(200).json({
        success: true,
        message: 'Timeline item deleted successfully',
        data: {
          deletedItemId: timelineItemId,
          trackId: trackId.toString(),
          assetId: assetId?.toString() || null
        }
      });

    } catch (transactionError) {
      console.error('Transaction error:', transactionError);
      res.status(500).json({
        success: false,
        message: 'Failed to delete timeline item due to database transaction error'
      });
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Error deleting timeline item:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting timeline item'
    });
  }
};
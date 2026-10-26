import { Request, Response } from 'express';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import { Types } from 'mongoose';
import { exportTimeline, type ExportVideoClip, type ExportAudioClip, type ExportTextClip } from '../util/exportTimeline.util';
import logger from '../util/logger.util';
import Project from '../model/project.model';
import { storage } from '../storage';

// Build a URL that makes the browser download the file instead of playing it.
// Cloudinary uses the fl_attachment flag; local storage honours ?download=<name>.
function toForcedDownloadUrl(url: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'stitcher-export';
  if (storage.name === 'cloudinary') {
    const marker = '/upload/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    return url.slice(0, idx + marker.length) + `fl_attachment:${safe}/` + url.slice(idx + marker.length);
  }
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(safe)}`;
}

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
        // Scope by timelineId so a client can only touch tracks of this timeline.
        const updatedTrack = await Track.findOneAndUpdate(
          { _id: trackUpdate._id, timelineId },
          {
            $set: {
              order: trackUpdate.order,
              type: trackUpdate.type,
              locked: trackUpdate.locked,
              muted: trackUpdate.muted
            }
          },
        );
        if (!updatedTrack) continue;
        
        // --- 3) Update timeline items inside this track ---
        if (Array.isArray(trackUpdate.items)) {
          for (const itemUpdate of trackUpdate.items) {
            if (!itemUpdate._id || !Types.ObjectId.isValid(itemUpdate._id)) continue;
            
            // Ids and ownership links are not editable from the client.
            const { _id, trackId: _trackId, createdAt: _c, updatedAt: _u, __v: _v, ...fields } = itemUpdate;
            await TimelineItem.findOneAndUpdate(
              { _id: itemUpdate._id, trackId: trackUpdate._id },
              { $set: fields }
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

// Export the current timeline state to a single downloadable mp4.
// Trims + concatenates video clips in order and muxes the first audio clip,
// then stores the result and returns a download URL.
export const exportTimelineVideo = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID is required' });
    }

    const timeline = await Timeline.findOne({ projectId })
      .populate({
        path: 'tracks',
        populate: {
          path: 'items',
          model: 'TimelineItem',
          populate: { path: 'assetId', model: 'Asset', select: 'url type duration' },
        },
      })
      .exec();

    if (!timeline) {
      return res.status(404).json({ success: false, message: 'Timeline not found for this project' });
    }

    const tracks = (timeline.tracks ?? []) as any[];
    const videoTrack = tracks.find((t) => t.type === 'video');
    const audioTrack = tracks.find((t) => t.type === 'audio');
    const textTrack = tracks.find((t) => t.type === 'text');

    const videoClips: ExportVideoClip[] = ((videoTrack?.items ?? []) as any[])
      .filter((it) => it.assetId?.url)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
      .map((it) => ({
        url: it.assetId.url as string,
        sourceStartTime: it.sourceStartTime ?? 0,
        sourceEndTime: it.sourceEndTime ?? it.assetId.duration ?? 0,
      }));

    if (videoClips.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to export — add at least one video clip to the timeline first',
      });
    }

    // All non-muted external audio clips (e.g. uploaded music/SFX). Each carries its
    // timeline position + trim + volume/fades so the export mixes them exactly where
    // the editor plays them. A muted audio TRACK drops them all.
    const audioClips: ExportAudioClip[] = (audioTrack?.muted ? [] : ((audioTrack?.items ?? []) as any[]))
      .filter((it) => it.assetId?.url)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
      .map((it) => ({
        url: it.assetId.url as string,
        startTime: it.startTime ?? 0,
        sourceStartTime: it.sourceStartTime ?? 0,
        sourceEndTime: it.sourceEndTime ?? it.assetId.duration ?? 0,
        volume: typeof it.volume === 'number' ? it.volume : 1,
        fadeIn: it.fadeIn ?? 0,
        fadeOut: it.fadeOut ?? 0,
      }));

    const textClips: ExportTextClip[] = ((textTrack?.items ?? []) as any[])
      .filter((it) => (it.content ?? '').trim().length > 0)
      .map((it) => ({
        content: it.content as string,
        startTime: it.startTime ?? 0,
        endTime: it.endTime ?? 0,
        x: it.x ?? 50,
        y: it.y ?? 50,
        fontSize: it.fontSize ?? 24,
        color: it.color ?? '#ffffff',
      }));

    logger.info({ message: '[export] starting timeline export', projectId, videoClips: videoClips.length, audioClips: audioClips.length, textClips: textClips.length });

    const result = await exportTimeline(videoClips, audioClips, `exports/${projectId}`, textClips);

    logger.info({ message: '[export] complete', projectId, url: result.url, durationSec: result.durationSec });

    const project = await Project.findById(projectId).select('name').lean<{ name?: string }>();
    const projectName = project?.name ?? 'Stitcher video';

    return res.status(200).json({
      success: true,
      data: {
        mode: 'download',
        downloadUrl: toForcedDownloadUrl(result.url, projectName),
        durationSec: result.durationSec,
        warnings: result.warnings,
      },
    });
  } catch (error: any) {
    logger.error({ message: '[export] failed', error: String(error?.message ?? error) });
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({
      success: false,
      message: error?.message ?? 'Export failed',
    });
  }
};

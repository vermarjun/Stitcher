import { Request, Response } from 'express';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import { Types } from 'mongoose';
import { exportTimeline, type ExportVideoClip, type ExportAudioClip, type ExportTextClip } from '../util/exportTimeline.util';
import logger from '../util/logger.util';
import { nanoid } from 'nanoid';
import SharedVideo from '../model/sharedVideo.model';
import Project from '../model/project.model';
import { PUBLIC_APP_URL } from '../config';

// Inject Cloudinary's fl_attachment flag so the browser force-downloads the
// file (Content-Disposition: attachment) instead of opening it inline.
function toForcedDownloadUrl(cloudinaryUrl: string, filename: string): string {
  const marker = '/upload/';
  const idx = cloudinaryUrl.indexOf(marker);
  if (idx === -1) return cloudinaryUrl; // not a cloudinary upload URL — return as-is
  const safe = filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'stitcher-export';
  return (
    cloudinaryUrl.slice(0, idx + marker.length) +
    `fl_attachment:${safe}/` +
    cloudinaryUrl.slice(idx + marker.length)
  );
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

// Export the current timeline state to a single downloadable mp4.
// Trims + concatenates video clips in order and muxes the first audio clip,
// then uploads the result to Cloudinary and returns the URL.
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

    const audioClips: ExportAudioClip[] = ((audioTrack?.items ?? []) as any[])
      .filter((it) => it.assetId?.url && !it.muted)
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
      .map((it) => ({
        url: it.assetId.url as string,
        sourceStartTime: it.sourceStartTime ?? 0,
        sourceEndTime: it.sourceEndTime ?? it.assetId.duration ?? 0,
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

    const mode: 'download' | 'share' = req.body?.mode === 'download' ? 'download' : 'share';

    logger.info({ message: '[export] starting timeline export', projectId, mode, videoClips: videoClips.length, audioClips: audioClips.length, textClips: textClips.length });

    const result = await exportTimeline(videoClips, audioClips, `stitcher/exports/${projectId}`, textClips);

    logger.info({ message: '[export] complete', projectId, mode, url: result.url, durationSec: result.durationSec });

    const project = await Project.findById(projectId).select('name').lean<{ name?: string }>();
    const projectName = project?.name ?? 'Stitcher video';

    if (mode === 'download') {
      // Force a real file download — never expose a "link" to the user.
      return res.status(200).json({
        success: true,
        data: {
          mode: 'download',
          downloadUrl: toForcedDownloadUrl(result.url, projectName),
          durationSec: result.durationSec,
          warnings: result.warnings,
        },
      });
    }

    // mode === 'share' — persist an opaque mapping and return a Stitcher link,
    // NOT the raw Cloudinary URL.
    const shareId = nanoid(10);
    await SharedVideo.create({
      shareId,
      projectId,
      userId: req.userId,
      videoUrl: result.url,
      thumbnailUrl: result.thumbnailUrl ?? '',
      durationSec: result.durationSec,
      projectName,
    });

    const base = PUBLIC_APP_URL.replace(/\/$/, '');
    return res.status(200).json({
      success: true,
      data: {
        mode: 'share',
        shareId,
        shareUrl: `${base}/v/${shareId}`,
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

// Creates a share link for an already-rendered video URL (no ffmpeg needed).
export const createSharedVideo = async (req: Request, res: Response) => {
  try {
    const { projectId, videoUrl, durationSec, thumbnailUrl, projectName: bodyProjectName } = req.body as {
      projectId?: string;
      videoUrl?: string;
      durationSec?: number;
      thumbnailUrl?: string;
      projectName?: string;
    };

    if (!projectId || !videoUrl || !videoUrl.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'projectId and a valid videoUrl are required' });
    }

    const project = await Project.findById(projectId).select('name').lean<{ name?: string }>();
    const name = (bodyProjectName && bodyProjectName.trim()) || project?.name || 'Stitcher video';

    const shareId = nanoid(10);
    await SharedVideo.create({
      shareId,
      projectId,
      userId: req.userId,
      videoUrl,
      thumbnailUrl: thumbnailUrl ?? '',
      durationSec: durationSec ?? 0,
      projectName: name,
    });

    const base = PUBLIC_APP_URL.replace(/\/$/, '');
    return res.status(200).json({ success: true, data: { shareId, shareUrl: `${base}/v/${shareId}` } });
  } catch (error: any) {
    logger.error({ message: '[share] create failed', error: String(error?.message ?? error) });
    return res.status(500).json({ success: false, message: 'Failed to create share link' });
  }
};

// Public (no-auth) resolver for a shared video. Returns the metadata the watch
// page needs to play the video. Increments a view counter.
export const getSharedVideo = async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    if (!shareId) {
      return res.status(400).json({ success: false, message: 'shareId is required' });
    }
    const shared = await SharedVideo.findOneAndUpdate(
      { shareId },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!shared) {
      return res.status(404).json({ success: false, message: 'This shared video does not exist or was removed' });
    }

    return res.status(200).json({
      success: true,
      data: {
        videoUrl: shared.videoUrl,
        thumbnailUrl: shared.thumbnailUrl,
        durationSec: shared.durationSec,
        projectName: shared.projectName,
        views: shared.views,
        createdAt: shared.createdAt,
      },
    });
  } catch (error: any) {
    logger.error({ message: '[share] resolve failed', error: String(error?.message ?? error) });
    return res.status(500).json({ success: false, message: 'Failed to load shared video' });
  }
};
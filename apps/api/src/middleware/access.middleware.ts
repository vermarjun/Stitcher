/**
 * requireProjectAccess — mirrors requireProjectOwnership but also allows
 * accepted collaborators through.  Use this on read/edit routes.
 * Keep requireProjectOwnership (owner-only) for destructive/admin routes.
 */
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { canAccessProject } from '../util/projectAccess.util';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';

const FORBIDDEN = { error: { message: 'forbidden', code: 'forbidden' } };

export function requireProjectAccess(
  source: 'params' | 'body' | 'query',
  key: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId: unknown = req[source][key];
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: { message: 'unauthorized', code: 'unauthorized' } });
      }

      if (!projectId || !Types.ObjectId.isValid(projectId as string)) {
        return res.status(400).json({ error: { message: 'invalid project id', code: 'bad_request' } });
      }

      const ok = await canAccessProject(userId, projectId as string);
      if (!ok) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requireTimelineAccess — loads the timeline by id, resolves its projectId,
 * then delegates to canAccessProject.  Use in place of requireTimelineOwnership
 * on routes that collaborators should be able to reach.
 */
export function requireTimelineAccess(
  source: 'params' | 'body' | 'query',
  key: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timelineId: unknown = req[source][key];
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: { message: 'unauthorized', code: 'unauthorized' } });
      }

      if (!timelineId || !Types.ObjectId.isValid(timelineId as string)) {
        return res.status(400).json({ error: { message: 'invalid timeline id', code: 'bad_request' } });
      }

      const timeline = await Timeline.findById(timelineId).select('projectId').lean();
      if (!timeline) {
        return res.status(404).json({ error: { message: 'not found', code: 'not_found' } });
      }

      const ok = await canAccessProject(userId, timeline.projectId.toString());
      if (!ok) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requireTrackAccess — loads the track by id, resolves its projectId,
 * then delegates to canAccessProject.
 */
export function requireTrackAccess(
  source: 'params' | 'body' | 'query',
  key: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const trackId: unknown = req[source][key];
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: { message: 'unauthorized', code: 'unauthorized' } });
      }

      if (!trackId || !Types.ObjectId.isValid(trackId as string)) {
        return res.status(400).json({ error: { message: 'invalid track id', code: 'bad_request' } });
      }

      const track = await Track.findById(trackId).select('projectId').lean();
      if (!track) {
        return res.status(404).json({ error: { message: 'not found', code: 'not_found' } });
      }

      const ok = await canAccessProject(userId, track.projectId.toString());
      if (!ok) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requireTimelineItemAccess — loads item→track→projectId, then delegates
 * to canAccessProject.  Use in place of requireTimelineItemOwnership on
 * routes that collaborators should be able to reach.
 */
export function requireTimelineItemAccess(
  source: 'params' | 'body' | 'query',
  key: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId: unknown = req[source][key];
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: { message: 'unauthorized', code: 'unauthorized' } });
      }

      if (!itemId || !Types.ObjectId.isValid(itemId as string)) {
        return res.status(400).json({ error: { message: 'invalid item id', code: 'bad_request' } });
      }

      const item = await TimelineItem.findById(itemId).select('trackId').lean();
      if (!item) {
        return res.status(404).json({ error: { message: 'not found', code: 'not_found' } });
      }

      const track = await Track.findById(item.trackId).select('projectId').lean();
      if (!track) {
        return res.status(404).json({ error: { message: 'not found', code: 'not_found' } });
      }

      const ok2 = await canAccessProject(userId, track.projectId.toString());
      if (!ok2) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

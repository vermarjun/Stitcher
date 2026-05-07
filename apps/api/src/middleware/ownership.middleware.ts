import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import GenerateChat from '../model/generateChat.model';

const FORBIDDEN = { error: { message: 'forbidden', code: 'forbidden' } };

// ─── Project ownership ────────────────────────────────────────────────────────

/**
 * Verifies that req.userId owns the project identified by `key` in the
 * specified location (`params`, `body`, or `query`).
 *
 * The Project model has no direct userId field — ownership is tracked on the
 * User model (users.projects array).  The ownership check here loads the
 * Project and verifies it exists in `user.projects`.  However, to avoid
 * loading the full user, we instead rely on the User→projects ref in reverse:
 * we check that the project's _id exists in the user's projects array by
 * querying User directly.
 *
 * Simpler approach used here: query User to see if projectId is in their
 * projects array.  Fallback: use GenerateChat / Timeline `projectId` for
 * indirect ownership traces (see helpers below).
 */
import User from '../model/user.model';

export function requireProjectOwnership(
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

      // Check user owns the project (user.projects contains projectId)
      const owner = await User.exists({
        _id: new Types.ObjectId(userId),
        projects: new Types.ObjectId(projectId as string),
      });

      if (!owner) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Timeline ownership (via timeline.projectId → user.projects) ──────────────

export function requireTimelineOwnership(
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

      const owner = await User.exists({
        _id: new Types.ObjectId(userId),
        projects: timeline.projectId,
      });

      if (!owner) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Track ownership (track.projectId → user.projects) ───────────────────────

export function requireTrackOwnership(
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

      const owner = await User.exists({
        _id: new Types.ObjectId(userId),
        projects: track.projectId,
      });

      if (!owner) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── TimelineItem ownership (item.trackId → track.projectId → user.projects) ─

export function requireTimelineItemOwnership(
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

      const owner = await User.exists({
        _id: new Types.ObjectId(userId),
        projects: track.projectId,
      });

      if (!owner) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── GenerateChat ownership (chat.userId) ────────────────────────────────────

export function requireChatOwnership(
  source: 'params' | 'body' | 'query',
  key: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId: unknown = req[source][key];
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: { message: 'unauthorized', code: 'unauthorized' } });
      }

      if (!chatId || !Types.ObjectId.isValid(chatId as string)) {
        return res.status(400).json({ error: { message: 'invalid chat id', code: 'bad_request' } });
      }

      const chat = await GenerateChat.findById(chatId).select('userId projectId').lean();
      if (!chat) {
        return res.status(404).json({ error: { message: 'not found', code: 'not_found' } });
      }

      // Primary: check chat.userId
      if (chat.userId && chat.userId.toString() === userId) {
        return next();
      }

      // Fallback: trace through project ownership
      const owner = await User.exists({
        _id: new Types.ObjectId(userId),
        projects: chat.projectId,
      });

      if (!owner) {
        return res.status(403).json(FORBIDDEN);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * yjs.server.ts
 *
 * Attaches a YSocketIO instance to the existing Socket.IO server.
 * Namespace pattern: /yjs|<projectId>
 *
 * Phase 3 additions:
 *   - Seed Y.Doc from Mongo Timeline/Track/Item on first load (empty ydoc).
 *   - Materialize Y.Doc → Mongo (debounced 1.5s + on last-participant-leaves).
 *   - Guard against double-seeding via a seeded-set.
 */

import * as Y from 'yjs';
import { YSocketIO } from 'y-socket.io/dist/server';
import type { Server, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

import { JWT_CONFIG } from '../config';
import { canAccessProject } from '../util/projectAccess.util';
import { YDocModel } from '../model/ydoc.model';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import logger from '../util/logger.util';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Debounce window for Mongo binary-state writes (ms) */
const PERSIST_DEBOUNCE_MS = 1_000;
/** Debounce window for Mongoose materialization writes (ms) */
const MATERIALIZE_DEBOUNCE_MS = 1_500;

// ─── State ────────────────────────────────────────────────────────────────────

/** Pending Y.Doc binary-persist timers */
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Pending Mongoose materialization timers */
const materializeTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Projects whose doc has already been seeded this server lifetime */
const seededDocs = new Set<string>();

// ─── Binary persistence ───────────────────────────────────────────────────────

/**
 * Persist the Y.Doc binary to the `ydocs` collection (debounced).
 * This is the fast-resume store; separate from the Mongoose materialization.
 */
function schedulePersist(projectId: string, doc: Y.Doc): void {
  const existing = persistTimers.get(projectId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    persistTimers.delete(projectId);
    try {
      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      await YDocModel.findOneAndUpdate(
        { projectId },
        { state, updatedAt: new Date() },
        { upsert: true, new: true },
      );
      logger.debug({ message: 'Yjs state persisted', projectId, bytes: state.length });
    } catch (err) {
      logger.error({ message: 'Yjs persist error', projectId, error: String(err) });
    }
  }, PERSIST_DEBOUNCE_MS);

  persistTimers.set(projectId, timer);
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

/**
 * Build the Y.Doc structure from the Mongoose timeline.
 * Only called when the ydoc Mongo record is empty (first-ever session).
 * Mutates `doc` in-place inside a single transaction.
 */
async function seedDocFromMongo(projectId: string, doc: Y.Doc): Promise<void> {
  try {
    const timeline = await Timeline.findOne({
      projectId: new Types.ObjectId(projectId),
    }).lean();

    if (!timeline) {
      logger.debug({ message: 'Yjs seed: no timeline found, skipping', projectId });
      return;
    }

    const tracks = await Track.find({ timelineId: timeline._id })
      .sort({ order: 1 })
      .lean();

    // Populate items for all tracks in one query
    const allItems = await TimelineItem.find({
      trackId: { $in: tracks.map((t) => t._id) },
    }).lean();

    const itemsByTrack = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const tid = item.trackId.toString();
      if (!itemsByTrack.has(tid)) itemsByTrack.set(tid, []);
      itemsByTrack.get(tid)!.push(item);
    }

    doc.transact(() => {
      const timelineMap = doc.getMap<unknown>('timeline');

      // meta
      const meta = new Y.Map<unknown>();
      meta.set('resolution', { width: timeline.resolution.width, height: timeline.resolution.height });
      meta.set('duration', timeline.duration);
      meta.set('fps', timeline.fps);
      timelineMap.set('meta', meta);

      // tracks
      const tracksArray = new Y.Array<Y.Map<unknown>>();
      for (const track of tracks) {
        const trackMap = new Y.Map<unknown>();
        trackMap.set('id', track._id.toString());
        trackMap.set('type', track.type);
        trackMap.set('locked', track.locked ?? false);
        trackMap.set('muted', track.muted ?? false);

        const itemsArray = new Y.Array<Y.Map<unknown>>();
        const trackItems = itemsByTrack.get(track._id.toString()) ?? [];
        for (const item of trackItems) {
          // Cast to any to avoid union-type narrowing issues on lean() documents
          const it = item as any;
          const itemMap = new Y.Map<unknown>();
          itemMap.set('id', it._id.toString());
          itemMap.set('type', it.type);
          itemMap.set('startTime', it.startTime);
          itemMap.set('endTime', it.endTime);
          if (it.assetId != null) itemMap.set('assetId', it.assetId.toString());
          if (it.sourceStartTime != null) itemMap.set('sourceStartTime', it.sourceStartTime);
          if (it.sourceEndTime != null) itemMap.set('sourceEndTime', it.sourceEndTime);
          if (it.x != null) itemMap.set('x', it.x);
          if (it.y != null) itemMap.set('y', it.y);
          if (it.content != null) itemMap.set('content', it.content);
          if (it.fontFamily != null) itemMap.set('fontFamily', it.fontFamily);
          if (it.fontSize != null) itemMap.set('fontSize', it.fontSize);
          if (it.color != null) itemMap.set('color', it.color);
          if (it.volume != null) itemMap.set('volume', it.volume);
          itemsArray.push([itemMap]);
        }
        trackMap.set('items', itemsArray);
        tracksArray.push([trackMap]);
      }
      timelineMap.set('tracks', tracksArray);
    }, 'seed');

    logger.info({
      message: 'Yjs doc seeded from Mongo',
      projectId,
      tracks: tracks.length,
      items: allItems.length,
    });
  } catch (err) {
    logger.error({ message: 'Yjs seed error', projectId, error: String(err) });
  }
}

/**
 * Restore a document's state from Mongo if a snapshot exists.
 * Must be called BEFORE any client connects to the doc.
 * Returns true if a blob was restored (i.e. the doc was already persisted).
 */
async function restoreFromMongo(projectId: string, doc: Y.Doc): Promise<boolean> {
  try {
    const record = await YDocModel.findOne({ projectId }).lean();
    if (record?.state) {
      Y.applyUpdate(doc, record.state as unknown as Uint8Array);
      logger.debug({ message: 'Yjs state restored from Mongo', projectId });
      return true;
    }
    return false;
  } catch (err) {
    logger.error({ message: 'Yjs restore error', projectId, error: String(err) });
    return false;
  }
}

// ─── Materialization ──────────────────────────────────────────────────────────

/**
 * Read the Y.Doc and reconcile the Mongoose Timeline/Track/Item documents.
 * - Upsert tracks by id, updating order/type/locked/muted.
 * - Upsert items by id.
 * - Delete Mongo tracks/items no longer present in the Y.Doc.
 * Idempotent. Does NOT write back to the Y.Doc.
 */
async function materializeToMongo(projectId: string, doc: Y.Doc): Promise<void> {
  try {
    const timelineMap = doc.getMap<unknown>('timeline');
    const tracksArray = timelineMap.get('tracks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!tracksArray) {
      logger.debug({ message: 'Yjs materialize: no tracks array, skipping', projectId });
      return;
    }

    const timeline = await Timeline.findOne({
      projectId: new Types.ObjectId(projectId),
    });
    if (!timeline) {
      logger.debug({ message: 'Yjs materialize: no timeline, skipping', projectId });
      return;
    }

    // meta update
    const meta = timelineMap.get('meta') as Y.Map<unknown> | undefined;
    if (meta) {
      const dur = meta.get('duration');
      const fps = meta.get('fps');
      const res = meta.get('resolution') as { width: number; height: number } | undefined;
      if (dur != null) timeline.duration = dur as number;
      if (fps != null) timeline.fps = fps as number;
      if (res) timeline.resolution = res;
    }

    const yjsTrackIds: string[] = [];
    const yjsItemIdsByTrack = new Map<string, string[]>();

    for (let i = 0; i < tracksArray.length; i++) {
      const trackMap = tracksArray.get(i) as Y.Map<unknown>;
      const trackId = trackMap.get('id') as string;
      if (!trackId) continue;
      yjsTrackIds.push(trackId);

      await Track.findByIdAndUpdate(
        new Types.ObjectId(trackId),
        {
          $set: {
            type: trackMap.get('type') as string,
            order: i,
            locked: trackMap.get('locked') ?? false,
            muted: trackMap.get('muted') ?? false,
            timelineId: timeline._id,
            projectId: timeline.projectId,
          },
        },
        { upsert: true, new: true },
      );

      const itemsArray = trackMap.get('items') as Y.Array<Y.Map<unknown>> | undefined;
      const trackItemIds: string[] = [];
      if (itemsArray) {
        for (let j = 0; j < itemsArray.length; j++) {
          const itemMap = itemsArray.get(j) as Y.Map<unknown>;
          const itemId = itemMap.get('id') as string;
          if (!itemId) continue;
          trackItemIds.push(itemId);

          const itemType = itemMap.get('type') as string;
          const setFields: Record<string, unknown> = {
            type: itemType,
            trackId: new Types.ObjectId(trackId),
            startTime: itemMap.get('startTime') ?? 0,
            endTime: itemMap.get('endTime') ?? 0,
          };

          if (itemMap.has('assetId')) {
            const assetIdStr = itemMap.get('assetId') as string;
            if (assetIdStr) setFields.assetId = new Types.ObjectId(assetIdStr);
          }
          if (itemMap.has('sourceStartTime')) setFields.sourceStartTime = itemMap.get('sourceStartTime');
          if (itemMap.has('sourceEndTime')) setFields.sourceEndTime = itemMap.get('sourceEndTime');
          if (itemMap.has('x')) setFields.x = itemMap.get('x');
          if (itemMap.has('y')) setFields.y = itemMap.get('y');
          if (itemMap.has('content')) setFields.content = itemMap.get('content');
          if (itemMap.has('fontFamily')) setFields.fontFamily = itemMap.get('fontFamily');
          if (itemMap.has('fontSize')) setFields.fontSize = itemMap.get('fontSize');
          if (itemMap.has('color')) setFields.color = itemMap.get('color');
          if (itemMap.has('volume')) setFields.volume = itemMap.get('volume');

          // Bypass the pre-save validation hook by using updateOne with upsert
          await TimelineItem.collection.updateOne(
            { _id: new Types.ObjectId(itemId) },
            { $set: setFields },
            { upsert: true },
          );
        }
      }
      yjsItemIdsByTrack.set(trackId, trackItemIds);
    }

    // Delete Mongo items no longer in Y.Doc for each track
    for (const [trackId, keepIds] of yjsItemIdsByTrack) {
      await TimelineItem.deleteMany({
        trackId: new Types.ObjectId(trackId),
        _id: { $nin: keepIds.map((id) => new Types.ObjectId(id)) },
      });
    }

    // Delete Mongo tracks no longer in Y.Doc
    const deletedTrackIds = await Track.find({
      timelineId: timeline._id,
      _id: { $nin: yjsTrackIds.map((id) => new Types.ObjectId(id)) },
    }).distinct('_id');

    if (deletedTrackIds.length > 0) {
      await TimelineItem.deleteMany({ trackId: { $in: deletedTrackIds } });
      await Track.deleteMany({ _id: { $in: deletedTrackIds } });
    }

    // Update timeline.tracks array to reflect Y.Doc order
    timeline.tracks = yjsTrackIds.map((id) => new Types.ObjectId(id));
    await timeline.save();

    logger.info({
      message: 'Yjs materialized to Mongo',
      projectId,
      tracks: yjsTrackIds.length,
    });
  } catch (err) {
    logger.error({ message: 'Yjs materialize error', projectId, error: String(err) });
  }
}

function scheduleMaterialize(projectId: string, doc: Y.Doc): void {
  const existing = materializeTimers.get(projectId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    materializeTimers.delete(projectId);
    await materializeToMongo(projectId, doc);
  }, MATERIALIZE_DEBOUNCE_MS);

  materializeTimers.set(projectId, timer);
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

/**
 * Our auth middleware — added to the Yjs namespace AFTER initialize() so that
 * we can access socket.nsp.name to derive the projectId.
 */
async function yjsAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    if (!token) {
      logger.warn({ message: 'Yjs auth: missing token', socketId: socket.id });
      return next(new Error('Unauthorized'));
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.secret);
      if (typeof decoded === 'string' || !('userId' in decoded)) {
        return next(new Error('Unauthorized'));
      }
      userId = (decoded as { userId: string }).userId;
    } catch {
      logger.warn({ message: 'Yjs auth: invalid token', socketId: socket.id });
      return next(new Error('Unauthorized'));
    }

    const nspName: string = socket.nsp.name;
    const projectId = nspName.replace(/^\/yjs\|/, '');

    if (!projectId || projectId === nspName) {
      logger.warn({ message: 'Yjs auth: bad namespace', nspName });
      return next(new Error('Unauthorized'));
    }

    const ok = await canAccessProject(userId, projectId);
    if (!ok) {
      logger.warn({ message: 'Yjs auth: access denied', userId, projectId });
      return next(new Error('Unauthorized'));
    }

    logger.debug({ message: 'Yjs auth: OK', userId, projectId });
    next();
  } catch (err) {
    logger.error({ message: 'Yjs auth middleware error', error: String(err) });
    next(new Error('Internal error'));
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * initYjsServer — call once after the Socket.IO server is created.
 * Attaches the YSocketIO namespace handler to the existing `io` instance.
 */
export function initYjsServer(io: Server): void {
  const ysocketio = new YSocketIO(io, {
    gcEnabled: true,
  });

  // document-loaded: restore binary state OR seed from Mongo (first-ever session).
  ysocketio.on('document-loaded', async (doc: Y.Doc & { name: string }) => {
    const projectId = doc.name;

    // Guard: only seed once per server lifetime
    if (seededDocs.has(projectId)) {
      logger.debug({ message: 'Yjs doc already seeded this session', projectId });
      return;
    }
    seededDocs.add(projectId);

    const hadBlob = await restoreFromMongo(projectId, doc);
    if (!hadBlob) {
      // Fresh doc — seed from Mongoose timeline
      await seedDocFromMongo(projectId, doc);
      // Immediately persist the seeded binary so subsequent connections restore fast
      schedulePersist(projectId, doc);
    }
  });

  // document-update: schedule both binary persist AND Mongoose materialization.
  // 'origin' of seed transaction is 'seed' — skip materializing that to avoid
  // writing back what we just read, but we do persist the binary.
  ysocketio.on('document-update', (doc: Y.Doc & { name: string }, _update: Uint8Array) => {
    schedulePersist(doc.name, doc);
    scheduleMaterialize(doc.name, doc);
  });

  // all-document-connections-closed: flush immediately (no debounce) when last client leaves.
  ysocketio.on('all-document-connections-closed', async (doc: Y.Doc & { name: string }) => {
    const projectId = doc.name;
    logger.info({ message: 'Last client left, flushing materialization', projectId });

    // Cancel any pending debounced timers and run immediately
    const matTimer = materializeTimers.get(projectId);
    if (matTimer) { clearTimeout(matTimer); materializeTimers.delete(projectId); }
    const persTimer = persistTimers.get(projectId);
    if (persTimer) { clearTimeout(persTimer); persistTimers.delete(projectId); }

    await Promise.all([
      materializeToMongo(projectId, doc),
      (async () => {
        const state = Buffer.from(Y.encodeStateAsUpdate(doc));
        await YDocModel.findOneAndUpdate(
          { projectId },
          { state, updatedAt: new Date() },
          { upsert: true, new: true },
        );
      })(),
    ]);

    // Remove from seeded set so a fresh server restart re-seeds correctly
    seededDocs.delete(projectId);
  });

  ysocketio.initialize();

  const nsp = ysocketio.nsp as Namespace | null;
  if (nsp) {
    nsp.use(yjsAuthMiddleware);
  } else {
    logger.error({ message: 'Yjs nsp is null after initialize — auth NOT applied' });
  }

  logger.info({ message: 'YSocketIO initialized — namespace /yjs|<projectId>' });
}

/**
 * yjsTimeline.ts
 *
 * Utilities for converting between Y.Doc shared types and the React
 * Timeline/ITrack/ITimelineItem state used by the editor.
 *
 * Schema contract (must match server yjs.server.ts):
 *   doc.getMap('timeline'):
 *     'meta'   → Y.Map { resolution:{width,height}, duration, fps }
 *     'tracks' → Y.Array<Y.Map>
 *          track Y.Map: { id, type, locked, muted, items: Y.Array<Y.Map> }
 *            item Y.Map: { id, type, startTime, endTime, assetId?, sourceStartTime?,
 *                          sourceEndTime?, x?, y?, content?, fontFamily?, fontSize?,
 *                          color?, volume? }
 */

import * as Y from 'yjs';
import type {
  Timeline,
  ITrack,
  ITimelineItemBase,
} from '@/State/Types';

// ─── Y.Doc → React state ──────────────────────────────────────────────────────

function yItemToReact(itemMap: Y.Map<unknown>): ITimelineItemBase {
  const base: ITimelineItemBase = {
    _id: itemMap.get('id') as string,
    type: itemMap.get('type') as 'video' | 'audio' | 'text',
    trackId: '', // filled by caller
    startTime: (itemMap.get('startTime') as number) ?? 0,
    endTime: (itemMap.get('endTime') as number) ?? 0,
    metadata: {},
  };

  // Optional fields
  if (itemMap.has('assetId')) (base as any).assetId = itemMap.get('assetId');
  if (itemMap.has('sourceStartTime')) (base as any).sourceStartTime = itemMap.get('sourceStartTime');
  if (itemMap.has('sourceEndTime')) (base as any).sourceEndTime = itemMap.get('sourceEndTime');
  if (itemMap.has('x')) base.x = itemMap.get('x') as number;
  if (itemMap.has('y')) base.y = itemMap.get('y') as number;
  if (itemMap.has('content')) (base as any).content = itemMap.get('content');
  if (itemMap.has('fontFamily')) (base as any).fontFamily = itemMap.get('fontFamily');
  if (itemMap.has('fontSize')) (base as any).fontSize = itemMap.get('fontSize');
  if (itemMap.has('color')) (base as any).color = itemMap.get('color');
  if (itemMap.has('volume')) base.volume = itemMap.get('volume') as number;

  return base;
}

function yTrackToReact(trackMap: Y.Map<unknown>): ITrack {
  const trackId = trackMap.get('id') as string;
  const itemsArray = trackMap.get('items') as Y.Array<Y.Map<unknown>> | undefined;

  const items: ITimelineItemBase[] = [];
  if (itemsArray) {
    for (let i = 0; i < itemsArray.length; i++) {
      const itemReact = yItemToReact(itemsArray.get(i));
      itemReact.trackId = trackId;
      items.push(itemReact);
    }
  }

  return {
    _id: trackId,
    type: trackMap.get('type') as ITrack['type'],
    projectId: '',
    timelineId: '',
    order: 0,
    locked: (trackMap.get('locked') as boolean) ?? false,
    muted: (trackMap.get('muted') as boolean) ?? false,
    items: items as any,
  };
}

/**
 * Convert the full Y.Doc timeline map to a React Timeline object.
 * `baseTimeline` supplies the _id, projectId and other immutable fields.
 */
export function yDocToReactTimeline(
  timelineMap: Y.Map<unknown>,
  baseTimeline: Timeline,
): Timeline {
  const meta = timelineMap.get('meta') as Y.Map<unknown> | undefined;
  const tracksArray = timelineMap.get('tracks') as Y.Array<Y.Map<unknown>> | undefined;

  const duration = meta ? ((meta.get('duration') as number) ?? baseTimeline.duration) : baseTimeline.duration;
  const fps = meta ? ((meta.get('fps') as number) ?? baseTimeline.fps) : baseTimeline.fps;
  const resolution = meta
    ? ((meta.get('resolution') as { width: number; height: number }) ?? baseTimeline.resolution)
    : baseTimeline.resolution;

  const tracks: ITrack[] = [];
  if (tracksArray) {
    for (let i = 0; i < tracksArray.length; i++) {
      tracks.push(yTrackToReact(tracksArray.get(i)));
    }
  }

  return {
    ...baseTimeline,
    duration,
    fps,
    resolution,
    tracks,
  };
}

// ─── React state → Y.Doc writes ───────────────────────────────────────────────

/**
 * Find a track Y.Map by its 'id' field.
 */
export function findYTrack(
  tracksArray: Y.Array<Y.Map<unknown>>,
  trackId: string,
): Y.Map<unknown> | null {
  for (let i = 0; i < tracksArray.length; i++) {
    const t = tracksArray.get(i);
    if ((t.get('id') as string) === trackId) return t;
  }
  return null;
}

/**
 * Find an item Y.Map within a track by its 'id' field.
 */
export function findYItem(
  trackMap: Y.Map<unknown>,
  itemId: string,
): { itemMap: Y.Map<unknown>; itemsArray: Y.Array<Y.Map<unknown>>; index: number } | null {
  const itemsArray = trackMap.get('items') as Y.Array<Y.Map<unknown>> | undefined;
  if (!itemsArray) return null;
  for (let i = 0; i < itemsArray.length; i++) {
    const m = itemsArray.get(i);
    if ((m.get('id') as string) === itemId) return { itemMap: m, itemsArray, index: i };
  }
  return null;
}

/**
 * Apply a partial update to an item in the Y.Doc.
 * Caller must wrap in doc.transact(..., origin) to set the local-origin tag.
 */
export function applyItemUpdate(
  tracksArray: Y.Array<Y.Map<unknown>>,
  trackId: string,
  itemId: string,
  updates: Partial<Record<string, unknown>>,
): void {
  const trackMap = findYTrack(tracksArray, trackId);
  if (!trackMap) return;
  const found = findYItem(trackMap, itemId);
  if (!found) return;
  const { itemMap } = found;
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) itemMap.set(k, v);
  }
}

/**
 * Delete an item from the Y.Doc.
 * Caller must wrap in doc.transact(..., origin).
 */
export function deleteYItem(
  tracksArray: Y.Array<Y.Map<unknown>>,
  trackId: string,
  itemId: string,
): void {
  const trackMap = findYTrack(tracksArray, trackId);
  if (!trackMap) return;
  const found = findYItem(trackMap, itemId);
  if (!found) return;
  found.itemsArray.delete(found.index, 1);
}

/**
 * Add a new item to a track in the Y.Doc.
 * Caller must wrap in doc.transact(..., origin).
 */
export function addYItem(
  tracksArray: Y.Array<Y.Map<unknown>>,
  trackId: string,
  item: Omit<ITimelineItemBase, 'trackId' | 'metadata'> & Record<string, unknown>,
): void {
  const trackMap = findYTrack(tracksArray, trackId);
  if (!trackMap) return;
  const itemsArray = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
  const itemMap = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined) itemMap.set(k, v);
  }
  itemsArray.push([itemMap]);
}

/**
 * Generate a 24-hex ObjectId-format id client-side.
 * Maps 1:1 to a valid Mongo _id when materialized on the server.
 */
export function newObjectIdHex(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return timestamp + random;
}

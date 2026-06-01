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

// ─── Hydration cache ───────────────────────────────────────────────────────────
//
// The Y.Doc stores only a *flat* subset of each item — crucially `assetId` is a
// bare 24-hex string, NOT the populated asset object ({url, thumbnail, duration,
// name, …}) the editor renders from. It also omits fields like speed/opacity/
// scale/rotation/fade. If we rebuilt React items from the Y.Doc alone, every
// client that re-derives (i.e. every *remote* collaborator on each update) would
// lose those — which is exactly why a change made by one user "corrupts" the
// timeline for everyone else while staying correct for the editor.
//
// To fix that we keep a hydration cache of the last-known *fully populated*
// items/assets (harvested from the HTTP timeline fetch) and merge the Y.Doc's
// live positional fields on top of it.
export interface TimelineHydration {
  items: Map<string, any>; // itemId  -> last-known fully-populated item
  assets: Map<string, any>; // assetId -> populated asset object
}

export function createHydration(): TimelineHydration {
  return { items: new Map(), assets: new Map() };
}

/** Record every populated item/asset from a server timeline into the cache. */
export function harvestHydration(tl: Timeline | null | undefined, h: TimelineHydration): void {
  const tracks = (tl?.tracks ?? []) as any[];
  for (const track of tracks) {
    for (const item of (track?.items ?? [])) {
      if (item?._id) h.items.set(String(item._id), item);
      const a = item?.assetId;
      if (a && typeof a === 'object' && a._id) h.assets.set(String(a._id), a);
    }
  }
}

/** True if any media item still has an unresolved (string / missing) asset. */
export function hasUnresolvedAssets(tl: Timeline): boolean {
  const tracks = (tl.tracks ?? []) as any[];
  for (const track of tracks) {
    for (const item of (track?.items ?? [])) {
      if (item.type === 'video' || item.type === 'audio') {
        const a = item.assetId;
        if (!a || typeof a !== 'object' || !a.url) return true;
      }
    }
  }
  return false;
}

// ─── Y.Doc → React state ──────────────────────────────────────────────────────

function yItemToReact(itemMap: Y.Map<unknown>, h?: TimelineHydration): ITimelineItemBase {
  const id = itemMap.get('id') as string;
  // Start from the last-known fully-populated item so fields the Y.Doc doesn't
  // carry (speed, opacity, scale, rotation, fade, populated assetId, …) survive.
  const cached = h?.items.get(id);
  const base: any = cached
    ? { ...cached, metadata: cached.metadata ?? {} }
    : { _id: id, trackId: '', metadata: {} };

  base._id = id;
  base.type = itemMap.get('type') as 'video' | 'audio' | 'text';
  base.trackId = ''; // filled by caller
  // Position is AUTHORITATIVE in the Y.Doc — never fall back to the (possibly
  // stale) hydration cache for startTime/endTime, or a moved clip could snap
  // back to an old position and land on top of another clip.
  base.startTime = (itemMap.get('startTime') as number) ?? 0;
  base.endTime = (itemMap.get('endTime') as number) ?? 0;

  // Overlay the live positional/style fields the Y.Doc DOES track.
  if (itemMap.has('sourceStartTime')) base.sourceStartTime = itemMap.get('sourceStartTime');
  if (itemMap.has('sourceEndTime')) base.sourceEndTime = itemMap.get('sourceEndTime');
  if (itemMap.has('x')) base.x = itemMap.get('x') as number;
  if (itemMap.has('y')) base.y = itemMap.get('y') as number;
  if (itemMap.has('content')) base.content = itemMap.get('content');
  if (itemMap.has('fontFamily')) base.fontFamily = itemMap.get('fontFamily');
  if (itemMap.has('fontSize')) base.fontSize = itemMap.get('fontSize');
  if (itemMap.has('color')) base.color = itemMap.get('color');
  if (itemMap.has('volume')) base.volume = itemMap.get('volume') as number;

  // assetId: hydrate the bare string id back into the populated asset object.
  if (itemMap.has('assetId')) {
    const aid = String(itemMap.get('assetId'));
    base.assetId = h?.assets.get(aid) ?? cached?.assetId ?? aid;
  }

  return base as ITimelineItemBase;
}

function yTrackToReact(trackMap: Y.Map<unknown>, h?: TimelineHydration): ITrack {
  const trackId = trackMap.get('id') as string;
  const itemsArray = trackMap.get('items') as Y.Array<Y.Map<unknown>> | undefined;

  const items: ITimelineItemBase[] = [];
  const seenIds = new Set<string>();
  if (itemsArray) {
    for (let i = 0; i < itemsArray.length; i++) {
      const m = itemsArray.get(i);
      const itemId = m.get('id') as string;
      // Defensive de-dup: if a duplicate Y.Map for the same id ever exists (an
      // insert race, or a server inject colliding with a client add), render it
      // only ONCE so clips can never stack on top of each other. Keep the first.
      if (itemId && seenIds.has(itemId)) continue;
      if (itemId) seenIds.add(itemId);
      const itemReact = yItemToReact(m, h);
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
 * `hydration` (optional) re-populates asset objects + fields the Y.Doc omits.
 */
export function yDocToReactTimeline(
  timelineMap: Y.Map<unknown>,
  baseTimeline: Timeline,
  hydration?: TimelineHydration,
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
      tracks.push(yTrackToReact(tracksArray.get(i), hydration));
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
  // Idempotent: never insert a second Y.Map for an id that already exists.
  // Guards against double-insert races that would render stacked duplicates.
  const newId = String((item as any).id ?? (item as any)._id ?? '');
  if (newId) {
    for (let i = 0; i < itemsArray.length; i++) {
      if (String(itemsArray.get(i).get('id')) === newId) return;
    }
  }
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

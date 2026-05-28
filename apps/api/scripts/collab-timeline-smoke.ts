/**
 * collab-timeline-smoke.ts
 *
 * Phase-3 gate test: 6 assertions proving the full Y.Doc timeline binding.
 *
 * Usage:
 *   npx tsx scripts/collab-timeline-smoke.ts
 *
 * Fixed IDs (matching existing Atlas data):
 *   owner userId: 6a176450c847e74ccebd9745
 *   projectId:    6a176455c847e74ccebd974b
 *   JWT secret:   REDACTED
 */

import dotenv from 'dotenv';
import path from 'path';
// __dirname may not be defined in tsx ESM mode — fall back to process.cwd()
const envPath = path.resolve(typeof __dirname !== 'undefined' ? __dirname : process.cwd(), '../.env');
dotenv.config({ path: envPath });

import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import Timeline from '../src/model/timeline.model';
import Track from '../src/model/track.model';
import TimelineItem from '../src/model/timelineitem.model';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env['SMOKE_API_URL'] ?? 'http://localhost:3100';
const PROJECT_ID = '6a176455c847e74ccebd974b';
const OWNER_ID = '6a176450c847e74ccebd9745';
const JWT_SECRET = 'REDACTED';
const SYNC_TIMEOUT_MS = 10_000;
const DEBOUNCE_WAIT_MS = 3_500; // > 1.5s materialize debounce

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

function fail(label: string, reason?: string): void {
  console.log(`FAIL  ${label}${reason ? ` — ${reason}` : ''}`);
}

async function waitFor(predicate: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(50);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeProvider(
  projectId: string,
  token: string,
  doc?: Y.Doc,
): { doc: Y.Doc; provider: SocketIOProvider } {
  const d = doc ?? new Y.Doc();
  const provider = new SocketIOProvider(API_URL, projectId, d, {
    autoConnect: true,
    auth: { token },
    disableBc: true,
  });
  return { doc: d, provider };
}

async function cleanup(...pairs: Array<{ provider: SocketIOProvider; doc: Y.Doc }>): Promise<void> {
  for (const { provider, doc } of pairs) {
    provider.destroy();
    doc.destroy();
  }
  await sleep(500);
}

/** Get the 'tracks' Y.Array from a doc's timeline map. */
function getTracks(doc: Y.Doc): Y.Array<Y.Map<unknown>> | undefined {
  return doc.getMap<unknown>('timeline').get('tracks') as Y.Array<Y.Map<unknown>> | undefined;
}

/** Find a track Y.Map by id. */
function findTrack(tracksArray: Y.Array<Y.Map<unknown>>, id: string): Y.Map<unknown> | null {
  for (let i = 0; i < tracksArray.length; i++) {
    const t = tracksArray.get(i);
    if ((t.get('id') as string) === id) return t;
  }
  return null;
}

/** Find an item Y.Map within a track by id. */
function findItem(
  tracksArray: Y.Array<Y.Map<unknown>>,
  trackId: string,
  itemId: string,
): Y.Map<unknown> | null {
  const track = findTrack(tracksArray, trackId);
  if (!track) return null;
  const items = track.get('items') as Y.Array<Y.Map<unknown>> | undefined;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items.get(i);
    if ((it.get('id') as string) === itemId) return it;
  }
  return null;
}

/** Generate a 24-hex ObjectId-format id. */
function newId(): string {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return ts + rand;
}

// ─── Wait for Y.Doc to have the tracks structure seeded ──────────────────────

async function waitForSeed(doc: Y.Doc, ms = SYNC_TIMEOUT_MS): Promise<boolean> {
  return waitFor(() => {
    const tracks = getTracks(doc);
    return tracks != null && tracks.length > 0;
  }, ms);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function test1_addItemAtoB(): Promise<{ pass: boolean; trackId: string; itemId: string }> {
  const label = 'Gate 1: A adds item → B sees it';
  const token = makeToken(OWNER_ID);
  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);

  try {
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) { fail(label, 'connect timeout'); return { pass: false, trackId: '', itemId: '' }; }

    await waitForSeed(docA);
    await waitForSeed(docB);
    await sleep(500);

    const tracksA = getTracks(docA);
    if (!tracksA || tracksA.length === 0) {
      fail(label, 'no tracks in doc after seed');
      return { pass: false, trackId: '', itemId: '' };
    }

    // Use first available track
    const trackMap = tracksA.get(0);
    const trackId = trackMap.get('id') as string;
    const itemId = newId();

    docA.transact(() => {
      const itemMap = new Y.Map<unknown>();
      itemMap.set('id', itemId);
      itemMap.set('type', 'text');
      itemMap.set('startTime', 1.0);
      itemMap.set('endTime', 4.0);
      itemMap.set('content', 'Smoke test item');
      itemMap.set('fontFamily', 'Arial');
      itemMap.set('fontSize', 24);
      itemMap.set('color', '#ff0000');
      (trackMap.get('items') as Y.Array<Y.Map<unknown>>).push([itemMap]);
    });

    const tracksB = getTracks(docB);
    const received = await waitFor(() => {
      if (!tracksB) return false;
      return findItem(tracksB, trackId, itemId) != null;
    }, SYNC_TIMEOUT_MS);

    if (received) {
      pass(label);
      return { pass: true, trackId, itemId };
    } else {
      fail(label, 'B did not see the new item');
      return { pass: false, trackId, itemId };
    }
  } finally {
    await cleanup({ provider: provA, doc: docA }, { provider: provB, doc: provB as unknown as Y.Doc });
    // cleanup docB separately
    provB.destroy(); docB.destroy();
  }
}

// Rerun gate 1 cleanly and keep clients alive for gates 2-5
async function setupSharedClients(): Promise<{
  docA: Y.Doc; provA: SocketIOProvider;
  docB: Y.Doc; provB: SocketIOProvider;
  trackId: string; itemId1: string; itemId2: string;
} | null> {
  const token = makeToken(OWNER_ID);
  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);

  const connected = await waitFor(
    () => provA.socket.connected && provB.socket.connected,
    SYNC_TIMEOUT_MS,
  );
  if (!connected) return null;

  await waitForSeed(docA);
  await waitForSeed(docB);
  await sleep(600);

  const tracksA = getTracks(docA);
  if (!tracksA || tracksA.length === 0) return null;

  const trackMap = tracksA.get(0);
  const trackId = trackMap.get('id') as string;

  const itemId1 = newId();
  const itemId2 = newId();

  // Add two items A will control item1, B will control item2
  docA.transact(() => {
    const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
    const m1 = new Y.Map<unknown>();
    m1.set('id', itemId1); m1.set('type', 'text'); m1.set('startTime', 1.0); m1.set('endTime', 3.0);
    m1.set('content', 'Item One'); m1.set('fontFamily', 'Arial'); m1.set('fontSize', 20); m1.set('color', '#ffffff');
    items.push([m1]);

    const m2 = new Y.Map<unknown>();
    m2.set('id', itemId2); m2.set('type', 'text'); m2.set('startTime', 5.0); m2.set('endTime', 8.0);
    m2.set('content', 'Item Two'); m2.set('fontFamily', 'Arial'); m2.set('fontSize', 20); m2.set('color', '#ffffff');
    items.push([m2]);
  });

  // Wait for B to see both items
  const tracksB = getTracks(docB);
  const seenBoth = await waitFor(
    () => !!(tracksB && findItem(tracksB, trackId, itemId1) && findItem(tracksB, trackId, itemId2)),
    SYNC_TIMEOUT_MS,
  );
  if (!seenBoth) return null;

  return { docA, provA, docB, provB, trackId, itemId1, itemId2 };
}

async function runGates(): Promise<void> {
  console.log(`\n=== Stitcher collab-timeline smoke (API: ${API_URL}) ===\n`);

  // ── Gate 1 ──────────────────────────────────────────────────────────────
  {
    const label = 'Gate 1: A adds item → B sees it';
    const token = makeToken(OWNER_ID);
    const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
    const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);

    try {
      const connected = await waitFor(
        () => provA.socket.connected && provB.socket.connected,
        SYNC_TIMEOUT_MS,
      );
      if (!connected) { fail(label, 'connect timeout'); }
      else {
        await waitForSeed(docA); await waitForSeed(docB); await sleep(600);
        const tracksA = getTracks(docA);
        if (!tracksA || tracksA.length === 0) { fail(label, 'no tracks after seed'); }
        else {
          const trackMap = tracksA.get(0);
          const trackId = trackMap.get('id') as string;
          const itemId = newId();
          docA.transact(() => {
            const m = new Y.Map<unknown>();
            m.set('id', itemId); m.set('type', 'text'); m.set('startTime', 2.0); m.set('endTime', 5.0);
            m.set('content', 'Gate1'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#fff');
            (trackMap.get('items') as Y.Array<Y.Map<unknown>>).push([m]);
          });
          const tracksB = getTracks(docB);
          const ok = await waitFor(() => !!(tracksB && findItem(tracksB, trackId, itemId)), SYNC_TIMEOUT_MS);
          ok ? pass(label) : fail(label, 'B did not see item within timeout');
        }
      }
    } finally {
      await cleanup({ provider: provA, doc: docA }, { provider: provB, doc: docB });
    }
  }

  // ── Gates 2-5 share clients to reduce connection overhead ───────────────
  const shared = await setupSharedClients();
  if (!shared) {
    for (const n of [2, 3, 4, 5]) fail(`Gate ${n}`, 'shared client setup failed');
    // Still run gate 6 (Mongo)
  } else {
    const { docA, provA, docB, provB, trackId, itemId1, itemId2 } = shared;

    // ── Gate 2: A moves an item → B converges ──────────────────────────────
    {
      const label = 'Gate 2: A moves item → B converges to same values';
      const tracksA = getTracks(docA);
      const tracksB = getTracks(docB);
      const itemA = tracksA ? findItem(tracksA, trackId, itemId1) : null;
      if (!itemA) { fail(label, 'item not found in A'); }
      else {
        docA.transact(() => { itemA.set('startTime', 10.0); itemA.set('endTime', 13.0); });
        const ok = await waitFor(() => {
          const itemB = tracksB ? findItem(tracksB, trackId, itemId1) : null;
          return itemB?.get('startTime') === 10.0 && itemB?.get('endTime') === 13.0;
        }, SYNC_TIMEOUT_MS);
        ok ? pass(label) : fail(label, `B has startTime=${tracksB ? findItem(tracksB, trackId, itemId1)?.get('startTime') : '?'}`);
      }
    }

    // ── Gate 3: A edits text content → B sees new text ─────────────────────
    {
      const label = 'Gate 3: A edits text content → B sees it';
      const tracksA = getTracks(docA);
      const tracksB = getTracks(docB);
      const itemA = tracksA ? findItem(tracksA, trackId, itemId1) : null;
      if (!itemA) { fail(label, 'item not found in A'); }
      else {
        const newContent = `edited-${Date.now()}`;
        docA.transact(() => { itemA.set('content', newContent); });
        const ok = await waitFor(() => {
          const itemB = tracksB ? findItem(tracksB, trackId, itemId1) : null;
          return itemB?.get('content') === newContent;
        }, SYNC_TIMEOUT_MS);
        ok ? pass(label) : fail(label, `B content=${tracksB ? findItem(tracksB, trackId, itemId1)?.get('content') : '?'}`);
      }
    }

    // ── Gate 4: A deletes item → B's array no longer has it ────────────────
    {
      const label = 'Gate 4: A deletes item → B sees removal';
      const tracksA = getTracks(docA);
      const tracksB = getTracks(docB);
      const trackMapA = tracksA ? findTrack(tracksA, trackId) : null;
      if (!trackMapA) { fail(label, 'track not found in A'); }
      else {
        const itemsA = trackMapA.get('items') as Y.Array<Y.Map<unknown>>;
        let idx = -1;
        for (let i = 0; i < itemsA.length; i++) {
          if ((itemsA.get(i).get('id') as string) === itemId1) { idx = i; break; }
        }
        if (idx === -1) { fail(label, 'item1 not found in itemsA'); }
        else {
          docA.transact(() => { itemsA.delete(idx, 1); });
          const ok = await waitFor(() => {
            return tracksB ? findItem(tracksB, trackId, itemId1) === null : false;
          }, SYNC_TIMEOUT_MS);
          ok ? pass(label) : fail(label, 'item still visible in B');
        }
      }
    }

    // ── Gate 5: concurrent moves of DIFFERENT items → same final state ──────
    {
      const label = 'Gate 5: concurrent moves of different items → both converge';
      const tracksA = getTracks(docA);
      const tracksB = getTracks(docB);
      const item2A = tracksA ? findItem(tracksA, trackId, itemId2) : null;
      const item2B = tracksB ? findItem(tracksB, trackId, itemId2) : null;

      if (!item2A || !item2B) { fail(label, 'item2 not found in A or B'); }
      else {
        // Add a third item so each client moves a different one
        const itemId3 = newId();
        docA.transact(() => {
          const trackMapA = findTrack(tracksA!, trackId)!;
          const m = new Y.Map<unknown>();
          m.set('id', itemId3); m.set('type', 'text'); m.set('startTime', 20.0); m.set('endTime', 23.0);
          m.set('content', 'Item Three'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#fff');
          (trackMapA.get('items') as Y.Array<Y.Map<unknown>>).push([m]);
        });
        await waitFor(() => !!(tracksB && findItem(tracksB, trackId, itemId3)), SYNC_TIMEOUT_MS);

        const item3B = tracksB ? findItem(tracksB, trackId, itemId3) : null;

        // Concurrent: A moves item2, B moves item3 simultaneously
        docA.transact(() => { item2A.set('startTime', 30.0); item2A.set('endTime', 33.0); });
        docB.transact(() => { item3B?.set('startTime', 35.0); item3B?.set('endTime', 38.0); });

        const converged = await waitFor(() => {
          const i2a = tracksA ? findItem(tracksA, trackId, itemId2) : null;
          const i2b = tracksB ? findItem(tracksB, trackId, itemId2) : null;
          const i3a = tracksA ? findItem(tracksA, trackId, itemId3) : null;
          const i3b = tracksB ? findItem(tracksB, trackId, itemId3) : null;
          return (
            i2a?.get('startTime') === 30.0 && i2b?.get('startTime') === 30.0 &&
            i3a?.get('startTime') === 35.0 && i3b?.get('startTime') === 35.0
          );
        }, SYNC_TIMEOUT_MS);

        if (converged) {
          pass(label);
        } else {
          const i2a = tracksA ? findItem(tracksA, trackId, itemId2)?.get('startTime') : '?';
          const i2b = tracksB ? findItem(tracksB, trackId, itemId2)?.get('startTime') : '?';
          const i3a = tracksA ? findItem(tracksA, trackId, itemId3)?.get('startTime') : '?';
          const i3b = tracksB ? findItem(tracksB, trackId, itemId3)?.get('startTime') : '?';
          fail(label, `item2: A=${i2a} B=${i2b}; item3: A=${i3a} B=${i3b}`);
        }
      }
    }

    await cleanup({ provider: provA, doc: docA }, { provider: provB, doc: docB });
  }

  // ── Gate 6: Mongoose materialization ────────────────────────────────────
  {
    const label = 'Gate 6: Mongo materialization matches final Y.Doc state';

    // Connect a fresh client that triggers materialization (last-disconnect flush)
    const token = makeToken(OWNER_ID);
    const { doc, provider } = makeProvider(PROJECT_ID, token);

    try {
      const connected = await waitFor(() => provider.socket.connected, SYNC_TIMEOUT_MS);
      if (!connected) { fail(label, 'connect timeout'); return; }

      await waitForSeed(doc); await sleep(600);

      // Capture the current Y.Doc state
      const tracksArr = getTracks(doc);
      if (!tracksArr) { fail(label, 'no tracks'); return; }

      // Count total items in Y.Doc
      let yjsItemCount = 0;
      const yjsTrackIds: string[] = [];
      const sampleItem = { trackId: '', itemId: '', startTime: -1, content: '' };

      for (let i = 0; i < tracksArr.length; i++) {
        const t = tracksArr.get(i);
        const tid = t.get('id') as string;
        yjsTrackIds.push(tid);
        const items = t.get('items') as Y.Array<Y.Map<unknown>>;
        for (let j = 0; j < items.length; j++) {
          const it = items.get(j);
          yjsItemCount++;
          // Capture first item with content for content-check
          if (!sampleItem.content && it.get('content')) {
            sampleItem.trackId = tid;
            sampleItem.itemId = it.get('id') as string;
            sampleItem.startTime = it.get('startTime') as number;
            sampleItem.content = it.get('content') as string;
          }
        }
      }

      // Disconnect so last-client-leaves triggers immediate flush
      provider.destroy(); doc.destroy();

      // Wait for debounce materialization
      await sleep(DEBOUNCE_WAIT_MS);

      // Now connect to Mongo directly and read
      const mongoUri = process.env['MONGODB_URL'] ?? process.env['MONGODB_URI'] ?? process.env['MONGO_URI'] ?? '';
      if (!mongoUri) { fail(label, 'MONGODB_URL not set in env'); return; }

      await mongoose.connect(mongoUri);

      const mongoTimeline = await Timeline.findOne({
        projectId: new Types.ObjectId(PROJECT_ID),
      }).lean();
      if (!mongoTimeline) { fail(label, 'timeline not found in Mongo'); return; }

      const mongoTracks = await Track.find({ timelineId: mongoTimeline._id }).lean();
      const mongoItems = await TimelineItem.find({
        trackId: { $in: mongoTracks.map((t) => t._id) },
      }).lean();

      // Assert track count matches
      if (mongoTracks.length !== yjsTrackIds.length) {
        fail(label, `track count: Mongo=${mongoTracks.length} Yjs=${yjsTrackIds.length}`);
        return;
      }

      // Assert item count matches
      if (mongoItems.length !== yjsItemCount) {
        fail(label, `item count: Mongo=${mongoItems.length} Yjs=${yjsItemCount}`);
        return;
      }

      // Assert sample item exists in Mongo with matching startTime
      if (sampleItem.itemId) {
        const mongoItem = mongoItems.find((it) => it._id.toString() === sampleItem.itemId);
        if (!mongoItem) {
          fail(label, `sample item ${sampleItem.itemId} not found in Mongo`);
          return;
        }
        if (mongoItem.startTime !== sampleItem.startTime) {
          fail(label, `startTime mismatch: Mongo=${mongoItem.startTime} Yjs=${sampleItem.startTime}`);
          return;
        }
        if (sampleItem.content && mongoItem.content !== sampleItem.content) {
          fail(label, `content mismatch: Mongo="${mongoItem.content}" Yjs="${sampleItem.content}"`);
          return;
        }
      }

      pass(label);
      console.log(`       tracks=${mongoTracks.length} items=${mongoItems.length} sampleStartTime=${sampleItem.startTime}`);
    } finally {
      if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    }
  }

  console.log('\n=== Done ===\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

runGates().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

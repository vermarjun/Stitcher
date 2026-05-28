/**
 * collab-hardening-smoke.ts
 *
 * Phase-5 gate: reliability hardening.
 * All checks PASS or FAIL with a single-line result.
 *
 * Usage:
 *   npx tsx scripts/collab-hardening-smoke.ts
 *
 * Checks:
 *   A1. add-asset live propagation — REST POST /track/:id/asset → collaborator B sees item in Y.Doc
 *   A2. no-duplicate Mongo item — the same add-asset call must NOT create a second Mongo doc
 *   B1. reconnect resync — client disconnects then reconnects → same Y.Doc state
 *   B2. late-join full state — 3rd client joins mid-session → receives current Y.Doc state
 *   B3. 3-client concurrent-burst convergence
 *   C1. revocation blocks reconnect — collaborator removed → re-connect attempt is rejected
 *   D1. durability across restart — last client leaves → state persisted; reconnect restores it
 *
 * Fixed IDs (matching existing Atlas data):
 *   owner userId:        6a176450c847e74ccebd9745
 *   collaborator userId: 68a89b21cbadb4fe13132d57
 *   non-member userId:   6a163917473af01b6ceb71bb
 *   projectId:           6a176455c847e74ccebd974b
 *   video trackId:       6a176455c847e74ccebd9750
 *   video assetId:       6a1766d88f964c3e55951018
 *   JWT secret:          REDACTED
 */

import dotenv from 'dotenv';
import path from 'path';
const envPath = path.resolve(typeof __dirname !== 'undefined' ? __dirname : process.cwd(), '../.env');
dotenv.config({ path: envPath });

import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import jwt from 'jsonwebtoken';
import mongoose, { Types } from 'mongoose';
import fetch from 'node-fetch';

import TimelineItem from '../src/model/timelineitem.model';
import { YDocModel } from '../src/model/ydoc.model';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env['SMOKE_API_URL'] ?? 'http://localhost:3100';
const API_BASE = `${API_URL}/api`;
const PROJECT_ID = '6a176455c847e74ccebd974b';
const OWNER_ID = '6a176450c847e74ccebd9745';
const COLLAB_ID = '68a89b21cbadb4fe13132d57';
const NON_MEMBER_ID = '6a163917473af01b6ceb71bb';
const VIDEO_TRACK_ID = '6a176455c847e74ccebd9750';
const VIDEO_ASSET_ID = '6a1766d88f964c3e55951018';
const JWT_SECRET = 'REDACTED';

const SYNC_TIMEOUT_MS = 12_000;
const DEBOUNCE_WAIT_MS = 4_000; // > 1.5s materialize debounce + buffer

let passCount = 0;
let failCount = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

function pass(label: string, note?: string): void {
  passCount++;
  console.log(`PASS  ${label}${note ? `  (${note})` : ''}`);
}

function fail(label: string, reason?: string): void {
  failCount++;
  console.log(`FAIL  ${label}${reason ? ` — ${reason}` : ''}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(pred: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(50);
  }
  return false;
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

async function destroyProvider(provider: SocketIOProvider, doc: Y.Doc): Promise<void> {
  provider.destroy();
  doc.destroy();
  await sleep(300);
}

function getTracks(doc: Y.Doc): Y.Array<Y.Map<unknown>> | undefined {
  return doc.getMap<unknown>('timeline').get('tracks') as Y.Array<Y.Map<unknown>> | undefined;
}

function findTrack(arr: Y.Array<Y.Map<unknown>>, id: string): Y.Map<unknown> | null {
  for (let i = 0; i < arr.length; i++) {
    const t = arr.get(i);
    if ((t.get('id') as string) === id) return t;
  }
  return null;
}

function findItemInTrack(trackMap: Y.Map<unknown>, itemId: string): Y.Map<unknown> | null {
  const items = trackMap.get('items') as Y.Array<Y.Map<unknown>> | undefined;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const it = items.get(i);
    if ((it.get('id') as string) === itemId) return it;
  }
  return null;
}

async function waitForSeed(doc: Y.Doc, ms = SYNC_TIMEOUT_MS): Promise<boolean> {
  return waitFor(() => {
    const tracks = getTracks(doc);
    return tracks != null && tracks.length > 0;
  }, ms);
}

function newId(): string {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return ts + rand;
}

/** POST /api/track/:trackId/asset using owner JWT, returns { success, data } */
async function apiAddAsset(trackId: string, assetId: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/track/${trackId}/asset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      assetId,
      sourceStartTime: 0,
      sourceEndTime: 5,
      speed: 1,
      volume: 1,
    }),
  });
  return res.json();
}

/** DELETE /api/project/:projectId/collaborators/:collabUserId using owner JWT */
async function apiRemoveCollaborator(projectId: string, collabUserId: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/project/${projectId}/collaborators/${collabUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

/** POST /api/project/:projectId/invite + accept, returns inviteId */
async function apiInviteAndAcceptCollaborator(
  projectId: string,
  ownerToken: string,
  collabEmail: string,
  collabToken: string,
): Promise<void> {
  // invite
  const invRes = await fetch(`${API_BASE}/project/${projectId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
    body: JSON.stringify({ email: collabEmail, role: 'editor' }),
  });
  const invData = await invRes.json() as any;
  if (!invData.success) {
    // May already be invited (409) — that's ok, just list invites
  }

  // list invites as collaborator and accept
  const listRes = await fetch(`${API_BASE}/collab/invites`, {
    headers: { 'Authorization': `Bearer ${collabToken}` },
  });
  const listData = await listRes.json() as any;
  const invite = (listData?.data?.invites ?? []).find((i: any) => i.projectId?.toString() === projectId);
  if (invite) {
    await fetch(`${API_BASE}/collab/invites/${invite._id}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${collabToken}` },
    });
  }
}

// ─── Check A1 + A2: add-asset live propagation + no duplicate ─────────────────

async function checkAddAssetPropagation(): Promise<void> {
  const labelA1 = 'A1: REST add-asset → B sees item in Y.Doc live';
  const labelA2 = 'A2: no duplicate Mongo item after add-asset';

  const ownerToken = makeToken(OWNER_ID);
  const collabToken = makeToken(COLLAB_ID);

  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, ownerToken);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, collabToken);

  try {
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) { fail(labelA1, 'clients failed to connect'); fail(labelA2, 'clients failed to connect'); return; }

    await waitForSeed(docA); await waitForSeed(docB); await sleep(600);

    // Snapshot current item count in the video track before adding
    const tracksB = getTracks(docB);
    const videoTrackB = tracksB ? findTrack(tracksB, VIDEO_TRACK_ID) : null;
    const itemsBefore = videoTrackB
      ? (videoTrackB.get('items') as Y.Array<Y.Map<unknown>>).length
      : 0;

    // Also get Mongo item count before
    const mongoUri = process.env['MONGODB_URL'] ?? process.env['MONGODB_URI'] ?? '';
    let mongoConnected = false;
    let mongoItemIdsBefore: string[] = [];
    if (mongoUri) {
      if (mongoose.connection.readyState !== 1) await mongoose.connect(mongoUri);
      mongoConnected = true;
      const existing = await TimelineItem.find({ trackId: new Types.ObjectId(VIDEO_TRACK_ID) }).select('_id').lean();
      mongoItemIdsBefore = existing.map((i) => i._id.toString());
    }

    // Call REST API as owner
    const resp = await apiAddAsset(VIDEO_TRACK_ID, VIDEO_ASSET_ID, ownerToken);
    if (!resp.success) {
      fail(labelA1, `API call failed: ${JSON.stringify(resp)}`);
      fail(labelA2, 'API call failed');
      return;
    }

    const newItemId = resp.data?.timelineItem?._id?.toString() ?? '';

    // A1: B should see the new item in Y.Doc within timeout
    const propagated = await waitFor(() => {
      const tB = getTracks(docB);
      const vt = tB ? findTrack(tB, VIDEO_TRACK_ID) : null;
      if (!vt) return false;
      const items = vt.get('items') as Y.Array<Y.Map<unknown>>;
      return items.length > itemsBefore;
    }, SYNC_TIMEOUT_MS);

    if (propagated) {
      // Also verify the item ID matches
      const tB = getTracks(docB);
      const vt = tB ? findTrack(tB, VIDEO_TRACK_ID) : null;
      const foundById = newItemId && vt ? findItemInTrack(vt, newItemId) != null : false;
      pass(labelA1, `itemId=${newItemId} visible=${foundById}`);
    } else {
      const tB = getTracks(docB);
      const vt = tB ? findTrack(tB, VIDEO_TRACK_ID) : null;
      const currentLen = vt ? (vt.get('items') as Y.Array<Y.Map<unknown>>).length : -1;
      fail(labelA1, `B track items: before=${itemsBefore} after=${currentLen}, newItemId=${newItemId}`);
    }

    // A2: no duplicate Mongo items
    // Wait past the 1.5s materializer debounce to let it settle before checking.
    // The materializer upserts by ID, so the REST item survives if it's in Y.Doc.
    if (mongoConnected && newItemId) {
      await sleep(DEBOUNCE_WAIT_MS); // wait for materializer to complete
      const allItems = await TimelineItem.find({ trackId: new Types.ObjectId(VIDEO_TRACK_ID) }).select('_id').lean();
      const allIds = allItems.map((i) => i._id.toString());
      const newIds = allIds.filter((id) => !mongoItemIdsBefore.includes(id));
      const itemPresent = allIds.includes(newItemId);
      if (itemPresent && newIds.length === 1 && newIds[0] === newItemId) {
        pass(labelA2, `exactly 1 new Mongo item (${newItemId})`);
      } else if (itemPresent && newIds.length > 1) {
        fail(labelA2, `${newIds.length} new Mongo items created (expected 1): ${newIds.join(', ')}`);
      } else if (!itemPresent) {
        // Check if item exists at all (materializer may have re-created with same ID via upsert)
        const byId = await TimelineItem.findById(newItemId).lean();
        if (byId) {
          // Item exists but wasn't "new" relative to before — means it was in mongoItemIdsBefore?
          fail(labelA2, `item ${newItemId} exists but was already in "before" snapshot (impossible — duplicate ID?)`);
        } else {
          fail(labelA2, `Mongo item ${newItemId} missing after materializer settle (was deleted by materializer race); beforeCount=${mongoItemIdsBefore.length} afterCount=${allIds.length}`);
        }
      } else {
        fail(labelA2, `unexpected: newIds=[${newIds.join(', ')}] expected=[${newItemId}]`);
      }
    } else if (!mongoConnected) {
      fail(labelA2, 'could not connect to Mongo');
    } else {
      fail(labelA2, 'API did not return timelineItem._id');
    }
  } finally {
    await destroyProvider(provA, docA);
    await destroyProvider(provB, docB);
  }
}

// ─── Check B1: reconnect resync ──────────────────────────────────────────────

async function checkReconnectResync(): Promise<void> {
  const label = 'B1: reconnect resync — disconnected client resyncs to current state';
  const ownerToken = makeToken(OWNER_ID);

  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, ownerToken);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, ownerToken);

  try {
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) { fail(label, 'initial connect timeout'); return; }

    await waitForSeed(docA); await waitForSeed(docB); await sleep(500);

    // A adds an item
    const tracksA = getTracks(docA);
    if (!tracksA || tracksA.length === 0) { fail(label, 'no tracks'); return; }
    const trackMap = tracksA.get(0);
    const trackId = trackMap.get('id') as string;
    const itemId1 = newId();

    docA.transact(() => {
      const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>();
      m.set('id', itemId1); m.set('type', 'text'); m.set('startTime', 1.0); m.set('endTime', 3.0);
      m.set('content', 'Before-disconnect'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#fff');
      items.push([m]);
    });

    // B sees the item
    const seenBefore = await waitFor(() => {
      const tB = getTracks(docB);
      return !!(tB && findTrack(tB, trackId) && findItemInTrack(findTrack(tB, trackId)!, itemId1));
    }, SYNC_TIMEOUT_MS);
    if (!seenBefore) { fail(label, 'B did not see pre-disconnect item'); return; }

    // Disconnect B (simulate drop)
    provB.socket.disconnect();
    await sleep(500);

    // A makes another change while B is offline
    const itemId2 = newId();
    docA.transact(() => {
      const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>();
      m.set('id', itemId2); m.set('type', 'text'); m.set('startTime', 10.0); m.set('endTime', 13.0);
      m.set('content', 'Added-while-disconnected'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#0f0');
      items.push([m]);
    });
    await sleep(300);

    // Reconnect B
    provB.socket.connect();
    const reconnected = await waitFor(() => provB.socket.connected, SYNC_TIMEOUT_MS);
    if (!reconnected) { fail(label, 'B failed to reconnect'); return; }

    // B should now see the item added while it was offline
    const resynced = await waitFor(() => {
      const tB = getTracks(docB);
      return !!(tB && findTrack(tB, trackId) && findItemInTrack(findTrack(tB, trackId)!, itemId2));
    }, SYNC_TIMEOUT_MS);

    resynced ? pass(label) : fail(label, `B did not see item ${itemId2} added while disconnected`);
  } finally {
    await destroyProvider(provA, docA);
    await destroyProvider(provB, docB);
  }
}

// ─── Check B2: late-join ──────────────────────────────────────────────────────

async function checkLateJoin(): Promise<void> {
  const label = 'B2: late-join — 3rd client receives full current state';
  const token = makeToken(OWNER_ID);

  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);

  try {
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) { fail(label, 'initial connect timeout'); return; }

    await waitForSeed(docA); await sleep(500);

    // A adds a unique item
    const tracksA = getTracks(docA);
    if (!tracksA || tracksA.length === 0) { fail(label, 'no tracks'); return; }
    const trackMap = tracksA.get(0);
    const trackId = trackMap.get('id') as string;
    const itemId = newId();
    const uniqueContent = `late-join-${Date.now()}`;

    docA.transact(() => {
      const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>();
      m.set('id', itemId); m.set('type', 'text'); m.set('startTime', 50.0); m.set('endTime', 53.0);
      m.set('content', uniqueContent); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#ff0');
      items.push([m]);
    });

    await sleep(500);

    // Now C joins as a 3rd client (late)
    const { doc: docC, provider: provC } = makeProvider(PROJECT_ID, token);

    try {
      const connectedC = await waitFor(() => provC.socket.connected, SYNC_TIMEOUT_MS);
      if (!connectedC) { fail(label, 'C failed to connect'); return; }

      // C should receive the item A added (full state sync)
      const seenByC = await waitFor(() => {
        const tC = getTracks(docC);
        const vt = tC ? findTrack(tC, trackId) : null;
        return !!(vt && findItemInTrack(vt, itemId));
      }, SYNC_TIMEOUT_MS);

      seenByC ? pass(label, `C received item content="${uniqueContent}"`) : fail(label, `C did not see item ${itemId}`);
    } finally {
      await destroyProvider(provC, docC);
    }
  } finally {
    await destroyProvider(provA, docA);
    await destroyProvider(provB, docB);
  }
}

// ─── Check B3: 3-client concurrent burst ─────────────────────────────────────

async function checkConcurrentBurst(): Promise<void> {
  const label = 'B3: 3-client concurrent burst — all converge to identical state';
  const token = makeToken(OWNER_ID);

  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);
  const { doc: docC, provider: provC } = makeProvider(PROJECT_ID, token);

  try {
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected && provC.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) { fail(label, 'not all clients connected'); return; }

    await waitForSeed(docA); await waitForSeed(docB); await waitForSeed(docC); await sleep(600);

    const tracksA = getTracks(docA);
    if (!tracksA || tracksA.length === 0) { fail(label, 'no tracks'); return; }
    const trackMap = tracksA.get(0);
    const trackId = trackMap.get('id') as string;
    const tracksB = getTracks(docB)!;
    const tracksC = getTracks(docC)!;

    // Add base item from A that all will see
    const baseId = newId();
    docA.transact(() => {
      const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>();
      m.set('id', baseId); m.set('type', 'text'); m.set('startTime', 100.0); m.set('endTime', 103.0);
      m.set('content', 'base'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#fff');
      items.push([m]);
    });
    // wait for all to see it
    const allSeeBase = await waitFor(() => {
      return !!(
        findTrack(tracksB, trackId) && findItemInTrack(findTrack(tracksB, trackId)!, baseId) &&
        findTrack(tracksC, trackId) && findItemInTrack(findTrack(tracksC, trackId)!, baseId)
      );
    }, SYNC_TIMEOUT_MS);
    if (!allSeeBase) { fail(label, 'base item not visible in B or C before burst'); return; }

    // Concurrent burst: each client modifies the base item simultaneously
    const itemA = findItemInTrack(findTrack(tracksA, trackId)!, baseId)!;
    const itemB = findItemInTrack(findTrack(tracksB, trackId)!, baseId)!;
    const itemC = findItemInTrack(findTrack(tracksC, trackId)!, baseId)!;

    // Burst — all three simultaneously
    docA.transact(() => { itemA.set('startTime', 200.0); });
    docB.transact(() => { itemB.set('color', '#abc'); });
    docC.transact(() => { itemC.set('content', 'burst-merged'); });

    await sleep(200);

    // All add unique items to create divergent history
    const idA = newId(); const idB = newId(); const idC = newId();
    docA.transact(() => {
      const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>(); m.set('id', idA); m.set('type', 'text'); m.set('startTime', 201.0); m.set('endTime', 204.0); m.set('content', 'fromA'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#f00');
      items.push([m]);
    });
    docB.transact(() => {
      const vt = findTrack(tracksB, trackId)!;
      const items = vt.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>(); m.set('id', idB); m.set('type', 'text'); m.set('startTime', 205.0); m.set('endTime', 208.0); m.set('content', 'fromB'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#0f0');
      items.push([m]);
    });
    docC.transact(() => {
      const vt = findTrack(tracksC, trackId)!;
      const items = vt.get('items') as Y.Array<Y.Map<unknown>>;
      const m = new Y.Map<unknown>(); m.set('id', idC); m.set('type', 'text'); m.set('startTime', 210.0); m.set('endTime', 213.0); m.set('content', 'fromC'); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#00f');
      items.push([m]);
    });

    // All three docs must converge — each sees all three items
    const converged = await waitFor(() => {
      for (const tr of [tracksA, tracksB, tracksC]) {
        const vt = findTrack(tr, trackId);
        if (!vt) return false;
        if (!findItemInTrack(vt, idA)) return false;
        if (!findItemInTrack(vt, idB)) return false;
        if (!findItemInTrack(vt, idC)) return false;
      }
      return true;
    }, SYNC_TIMEOUT_MS);

    if (!converged) {
      const dbg = [tracksA, tracksB, tracksC].map((tr, i) => {
        const vt = findTrack(tr, trackId);
        const hasA = !!(vt && findItemInTrack(vt, idA));
        const hasB = !!(vt && findItemInTrack(vt, idB));
        const hasC = !!(vt && findItemInTrack(vt, idC));
        return `client${i + 1}(A=${hasA},B=${hasB},C=${hasC})`;
      }).join(' ');
      fail(label, dbg);
    } else {
      pass(label);
    }
  } finally {
    await destroyProvider(provA, docA);
    await destroyProvider(provB, docB);
    await destroyProvider(provC, docC);
  }
}

// ─── Check C1: revocation ─────────────────────────────────────────────────────

async function checkRevocation(): Promise<void> {
  const label = 'C1: revocation — removed collaborator cannot reconnect to Y.Doc';
  const ownerToken = makeToken(OWNER_ID);
  const collabToken = makeToken(COLLAB_ID);

  // Step 1: ensure COLLAB is an accepted collaborator (re-invite if needed)
  await apiInviteAndAcceptCollaborator(
    PROJECT_ID, ownerToken, 'vermarjun26@gmail.com', collabToken,
  ).catch(() => { /* ignore if already accepted */ });

  // Step 2: Collab connects successfully
  const { doc: docC, provider: provC } = makeProvider(PROJECT_ID, collabToken);
  const collabConnected = await waitFor(() => provC.socket.connected, SYNC_TIMEOUT_MS);
  if (!collabConnected) {
    // If collab can't connect at all even before removal, it's a test-data problem
    // Skip this check rather than false-fail
    await destroyProvider(provC, docC);
    fail(label, 'collab could not connect BEFORE revocation — check test data');
    return;
  }

  // Step 3: Owner removes the collaborator via REST
  const removeResp = await apiRemoveCollaborator(PROJECT_ID, COLLAB_ID, ownerToken);
  if (!removeResp.success) {
    await destroyProvider(provC, docC);
    fail(label, `removeCollaborator API failed: ${JSON.stringify(removeResp)}`);
    return;
  }

  // Step 4: wait briefly for active socket to be kicked
  await sleep(1_500);

  // Step 5: try to make a fresh connection as the removed collaborator
  const { doc: docC2, provider: provC2 } = makeProvider(PROJECT_ID, collabToken);
  const reconnected = await waitFor(() => provC2.socket.connected, 5_000);

  // Clean up
  await destroyProvider(provC, docC);
  await destroyProvider(provC2, docC2);

  if (reconnected) {
    fail(label, 'revoked collaborator was able to reconnect after removal');
  } else {
    pass(label, 'new connection rejected after collaborator removed');
  }

  // Restore the collaborator so other tests still work
  await apiInviteAndAcceptCollaborator(
    PROJECT_ID, ownerToken, 'vermarjun26@gmail.com', collabToken,
  ).catch(() => {});
}

// ─── Check D1: durability ─────────────────────────────────────────────────────

async function checkDurability(): Promise<void> {
  const label = 'D1: durability — state survives last-client-leaves + reconnect';
  const token = makeToken(OWNER_ID);

  // Connect, add a unique item, disconnect (last client → flush)
  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const connected = await waitFor(() => provA.socket.connected, SYNC_TIMEOUT_MS);
  if (!connected) { fail(label, 'initial connect timeout'); return; }

  await waitForSeed(docA); await sleep(500);

  const tracksA = getTracks(docA);
  if (!tracksA || tracksA.length === 0) { fail(label, 'no tracks'); return; }
  const trackMap = tracksA.get(0);
  const trackId = trackMap.get('id') as string;
  const uniqueTs = Date.now();
  const durableContent = `durable-${uniqueTs}`;
  const durableId = newId();

  docA.transact(() => {
    const items = trackMap.get('items') as Y.Array<Y.Map<unknown>>;
    const m = new Y.Map<unknown>();
    m.set('id', durableId); m.set('type', 'text'); m.set('startTime', 300.0); m.set('endTime', 303.0);
    m.set('content', durableContent); m.set('fontFamily', 'Arial'); m.set('fontSize', 20); m.set('color', '#fff');
    items.push([m]);
  });

  await sleep(500);
  // Disconnect — last client, so server flushes immediately
  await destroyProvider(provA, docA);

  // Wait for materialisation / persist flush
  await sleep(DEBOUNCE_WAIT_MS);

  // Verify binary persistence in Mongo
  const mongoUri = process.env['MONGODB_URL'] ?? process.env['MONGODB_URI'] ?? '';
  if (mongoUri && mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }
  const ydocRecord = await YDocModel.findOne({ projectId: PROJECT_ID }).lean();
  if (!ydocRecord?.state) {
    fail(label, 'no binary ydoc state in Mongo after disconnect');
    return;
  }

  // Simulate restart: fresh Y.Doc, reconnect — should restore from binary
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);
  const reconnected = await waitFor(() => provB.socket.connected, SYNC_TIMEOUT_MS);
  if (!reconnected) { await destroyProvider(provB, docB); fail(label, 'reconnect timeout'); return; }

  const restoredItem = await waitFor(() => {
    const tB = getTracks(docB);
    const vt = tB ? findTrack(tB, trackId) : null;
    return !!(vt && findItemInTrack(vt, durableId));
  }, SYNC_TIMEOUT_MS);

  await destroyProvider(provB, docB);

  restoredItem
    ? pass(label, `item "${durableContent}" present after reconnect`)
    : fail(label, `item ${durableId} not found after reconnect`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n=== Stitcher collab-hardening-smoke (API: ${API_URL}) ===\n`);

  console.log('--- A: Mutation completeness (add-asset) ---');
  await checkAddAssetPropagation();

  console.log('\n--- B: Resilience ---');
  await checkReconnectResync();
  await checkLateJoin();
  await checkConcurrentBurst();

  console.log('\n--- C: Revocation ---');
  await checkRevocation();

  console.log('\n--- D: Durability ---');
  await checkDurability();

  console.log(`\n=== Summary: ${passCount} PASS, ${failCount} FAIL ===\n`);

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

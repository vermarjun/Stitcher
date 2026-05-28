/**
 * collab-presence-smoke.ts
 *
 * Phase-4 gate test: verifies y-protocols Awareness-based presence.
 *
 * Two y-socket.io clients connect to the same project doc.
 * Client A sets user / cursor / selection awareness fields.
 * Client B should observe A's full state via the awareness 'change' event.
 * When A disconnects, B should see A removed from awareness states.
 *
 * Usage:
 *   npx tsx scripts/collab-presence-smoke.ts
 *
 * Fixed IDs (matching existing Atlas data):
 *   owner userId: 6a176450c847e74ccebd9745
 *   projectId:    6a176455c847e74ccebd974b
 *   JWT secret:   REDACTED
 */

import dotenv from 'dotenv';
import path from 'path';
const envPath = path.resolve(
  typeof __dirname !== 'undefined' ? __dirname : process.cwd(),
  '../.env',
);
dotenv.config({ path: envPath });

import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import jwt from 'jsonwebtoken';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env['SMOKE_API_URL'] ?? 'http://localhost:3100';
const PROJECT_ID = '6a176455c847e74ccebd974b';
const OWNER_ID = '6a176450c847e74ccebd9745';
const JWT_SECRET = 'REDACTED';
const TIMEOUT_MS = 10_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

function pass(label: string, detail?: string): void {
  console.log(`PASS  ${label}${detail ? `  (${detail})` : ''}`);
}

function fail(label: string, reason?: string): void {
  console.log(`FAIL  ${label}${reason ? ` — ${reason}` : ''}`);
}

async function waitFor(predicate: () => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeProvider(
  projectId: string,
  token: string,
): { doc: Y.Doc; provider: SocketIOProvider } {
  const doc = new Y.Doc();
  const provider = new SocketIOProvider(API_URL, projectId, doc, {
    autoConnect: true,
    auth: { token },
    disableBc: true,
  });
  return { doc, provider };
}

// ─── Stable per-user colour (mirrors useCollabDoc.ts logic) ──────────────────

function userIdToColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runPresenceSmoke(): Promise<void> {
  console.log(`\n=== Stitcher collab-presence smoke (API: ${API_URL}) ===\n`);

  const token = makeToken(OWNER_ID);
  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, token);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, token);

  try {
    // ── Step 0: wait for both sockets to connect ─────────────────────────────
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      TIMEOUT_MS,
    );
    if (!connected) {
      fail('Setup', 'sockets did not connect within timeout');
      return;
    }
    // Give awareness a moment to be exchanged after connect
    await sleep(600);

    const awarenessA = provA.awareness;
    const awarenessB = provB.awareness;

    // ── Gate 1: A sets user field → B observes it ────────────────────────────
    {
      const label = 'Gate 1: A sets user field → B observes user.name and user.color';
      let bSawChange = false;

      awarenessB.on('change', () => { bSawChange = true; });

      const userPayload = {
        id: OWNER_ID,
        name: 'TestUser',
        color: userIdToColor(OWNER_ID),
      };
      awarenessA.setLocalStateField('user', userPayload);

      const ok = await waitFor(() => {
        const states = awarenessB.getStates();
        for (const [clientId, state] of states) {
          if (clientId === awarenessB.clientID) continue;
          const u = state['user'] as typeof userPayload | undefined;
          if (u?.name === 'TestUser' && u?.color === userIdToColor(OWNER_ID)) {
            return true;
          }
        }
        return false;
      }, TIMEOUT_MS);

      if (ok) {
        pass(label, `changeEventFired=${bSawChange}`);
      } else {
        // Dump what B actually sees for debugging
        const dump = JSON.stringify(Object.fromEntries(awarenessB.getStates()));
        fail(label, `B states: ${dump}`);
      }
    }

    // ── Gate 2: A sets cursor field → B observes it ──────────────────────────
    {
      const label = 'Gate 2: A sets cursor field → B observes cursor.xPx and cursor.ts';
      const cursorPayload = { xPx: 320, ts: 8.5 };
      awarenessA.setLocalStateField('cursor', cursorPayload);

      const ok = await waitFor(() => {
        const states = awarenessB.getStates();
        for (const [clientId, state] of states) {
          if (clientId === awarenessB.clientID) continue;
          const c = state['cursor'] as typeof cursorPayload | undefined;
          if (c?.xPx === 320 && c?.ts === 8.5) return true;
        }
        return false;
      }, TIMEOUT_MS);

      if (ok) {
        pass(label, 'xPx=320 ts=8.5 seen by B');
      } else {
        fail(label, 'B did not see A\'s cursor within timeout');
      }
    }

    // ── Gate 3: A sets selection field → B observes it ──────────────────────
    {
      const label = 'Gate 3: A sets selection.itemId → B observes it';
      const selectionPayload = { itemId: 'abc123testitem' };
      awarenessA.setLocalStateField('selection', selectionPayload);

      const ok = await waitFor(() => {
        const states = awarenessB.getStates();
        for (const [clientId, state] of states) {
          if (clientId === awarenessB.clientID) continue;
          const s = state['selection'] as typeof selectionPayload | undefined;
          if (s?.itemId === 'abc123testitem') return true;
        }
        return false;
      }, TIMEOUT_MS);

      if (ok) {
        pass(label, 'itemId=abc123testitem seen by B');
      } else {
        fail(label, 'B did not see A\'s selection within timeout');
      }
    }

    // ── Gate 4: A disconnects → B sees A removed from awareness ─────────────
    {
      const label = 'Gate 4: A disconnects → B no longer sees A in awareness states';

      // Remember A's clientId so we can check it's gone
      const aClientId = awarenessA.clientID;

      // Gracefully clear A's local state before destroying (mirrors useCollabDoc cleanup)
      awarenessA.setLocalState(null);
      provA.destroy();
      docA.destroy();

      const ok = await waitFor(() => {
        const states = awarenessB.getStates();
        return !states.has(aClientId);
      }, TIMEOUT_MS);

      if (ok) {
        pass(label, `clientId ${aClientId} removed from B's awareness`);
      } else {
        const remaining = [...awarenessB.getStates().keys()].join(',');
        fail(label, `A's clientId ${aClientId} still in B's states: [${remaining}]`);
      }
    }

  } finally {
    // Cleanup B (A may already be destroyed)
    try {
      provA.awareness.setLocalState(null);
      provA.destroy();
      docA.destroy();
    } catch { /* already destroyed */ }
    try {
      provB.awareness.setLocalState(null);
      provB.destroy();
      docB.destroy();
    } catch { /* ignore */ }

    console.log('\n=== Done ===\n');
    // Allow socket close to complete before process exits
    await sleep(500);
  }
}

runPresenceSmoke().catch((err) => {
  console.error('Presence smoke test crashed:', err);
  process.exit(1);
});

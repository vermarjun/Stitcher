/**
 * collab-slice-smoke.ts
 *
 * Headless reliability proof for the Yjs real-time sync vertical slice.
 *
 * Usage:
 *   npx tsx scripts/collab-slice-smoke.ts
 *
 * Tests:
 *   1. A→B sync:    clientA sets a value, clientB sees it within timeout.
 *   2. Auth denied: a non-member JWT gets rejected.
 *   3. Persistence: value survives a full disconnect/reconnect cycle.
 *
 * Fixed IDs (matching existing Atlas data):
 *   owner userId:      6a176450c847e74ccebd9745
 *   projectId:         6a176455c847e74ccebd974b
 *   non-member userId: 6a163917473af01b6ceb71bb
 *   JWT secret:        REDACTED
 */

import dotenv from 'dotenv';
dotenv.config();

import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import jwt from 'jsonwebtoken';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env['SMOKE_API_URL'] ?? 'http://localhost:3100';
const PROJECT_ID = '6a176455c847e74ccebd974b';
const OWNER_ID = '6a176450c847e74ccebd9745';
const NON_MEMBER_ID = '6a163917473af01b6ceb71bb';
const JWT_SECRET = 'REDACTED';
const SYNC_TIMEOUT_MS = 8_000;
const MAP_KEY = 'smoke_startTime';
const MAP_VALUE = 42;

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

/** Wait up to `ms` milliseconds for `predicate` to return true. */
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

/** Create a SocketIOProvider for the given projectId and token. */
function makeProvider(
  projectId: string,
  token: string,
  doc?: Y.Doc,
): { doc: Y.Doc; provider: SocketIOProvider } {
  const d = doc ?? new Y.Doc();
  const provider = new SocketIOProvider(
    API_URL,
    projectId,
    d,
    {
      autoConnect: true,
      auth: { token },
      disableBc: true,
    },
  );
  return { doc: d, provider };
}

/** Destroy provider + doc and wait briefly for sockets to close. */
async function cleanup(provider: SocketIOProvider, doc: Y.Doc): Promise<void> {
  provider.destroy();
  doc.destroy();
  await sleep(300);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testAtoB(): Promise<boolean> {
  const label = 'A→B live sync';
  const ownerToken = makeToken(OWNER_ID);

  const { doc: docA, provider: provA } = makeProvider(PROJECT_ID, ownerToken);
  const { doc: docB, provider: provB } = makeProvider(PROJECT_ID, ownerToken);

  try {
    // Wait for both to connect
    const connected = await waitFor(
      () => provA.socket.connected && provB.socket.connected,
      SYNC_TIMEOUT_MS,
    );
    if (!connected) {
      fail(label, 'clients failed to connect within timeout');
      return false;
    }

    // Give sync-step-1 handshake time to complete
    await sleep(800);

    // clientA writes
    const mapA = docA.getMap<number>('timeline');
    mapA.set(MAP_KEY, MAP_VALUE);

    // Wait for clientB to see the value
    const mapB = docB.getMap<number>('timeline');
    const received = await waitFor(
      () => mapB.get(MAP_KEY) === MAP_VALUE,
      SYNC_TIMEOUT_MS,
    );

    if (received) {
      pass(label);
      return true;
    } else {
      fail(label, `clientB map value is ${mapB.get(MAP_KEY)} — expected ${MAP_VALUE}`);
      return false;
    }
  } finally {
    await cleanup(provA, docA);
    await cleanup(provB, docB);
  }
}

async function testNonMemberDenied(): Promise<boolean> {
  const label = 'non-member denied';
  const nonMemberToken = makeToken(NON_MEMBER_ID);

  const { doc, provider } = makeProvider(PROJECT_ID, nonMemberToken);

  try {
    let connectError: Error | null = null;

    provider.socket.on('connect_error', (err: Error) => {
      connectError = err;
    });

    // Wait a bit to see if connection is refused
    const denied = await waitFor(
      () => connectError !== null,
      SYNC_TIMEOUT_MS,
    );

    // Also check that socket is NOT connected
    const isConnected = provider.socket.connected;

    if (denied && !isConnected) {
      pass(label);
      return true;
    } else if (isConnected) {
      fail(label, 'non-member socket connected — expected rejection');
      return false;
    } else {
      fail(label, 'no connect_error received within timeout (inconclusive)');
      return false;
    }
  } finally {
    await cleanup(provider, doc);
  }
}

async function testPersistence(): Promise<boolean> {
  const label = 'persistence survives reconnect';
  const ownerToken = makeToken(OWNER_ID);
  const persistKey = `persist_smoke_${Date.now()}`;
  const persistValue = 99;

  // Phase 1: write a unique value
  {
    const { doc, provider } = makeProvider(PROJECT_ID, ownerToken);
    const connected = await waitFor(() => provider.socket.connected, SYNC_TIMEOUT_MS);
    if (!connected) {
      fail(label, 'phase-1 client failed to connect');
      return false;
    }
    await sleep(800);

    const map = doc.getMap<number>('timeline');
    map.set(persistKey, persistValue);

    // Wait for debounce + Mongo write (1s debounce + overhead)
    await sleep(2_500);
    await cleanup(provider, doc);
  }

  // Phase 2: fresh client — assert value is restored
  {
    const { doc, provider } = makeProvider(PROJECT_ID, ownerToken);
    const connected = await waitFor(() => provider.socket.connected, SYNC_TIMEOUT_MS);
    if (!connected) {
      fail(label, 'phase-2 client failed to connect');
      return false;
    }

    // Wait for sync handshake to apply persisted state
    const restored = await waitFor(() => {
      const map = doc.getMap<number>('timeline');
      return map.get(persistKey) === persistValue;
    }, SYNC_TIMEOUT_MS);

    await cleanup(provider, doc);

    if (restored) {
      pass(label);
      return true;
    } else {
      fail(label, `value not restored from Mongo — key ${persistKey} missing`);
      return false;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n=== Yjs collab-slice smoke test (API: ${API_URL}) ===\n`);

  let allPassed = true;

  // Run tests sequentially so logs are clear
  allPassed = (await testAtoB()) && allPassed;
  allPassed = (await testNonMemberDenied()) && allPassed;
  allPassed = (await testPersistence()) && allPassed;

  console.log(`\n=== Result: ${allPassed ? 'ALL PASS' : 'SOME FAILED'} ===\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

/**
 * yjs.server.ts
 *
 * Attaches a YSocketIO instance to the existing Socket.IO server.
 * Namespace pattern: /yjs|<projectId>
 *
 * Auth: the built-in `authenticate` callback only receives `handshake` (no
 * namespace context), so we skip it and add our own nsp.use() middleware after
 * `initialize()` when ysocketio.nsp is populated. That middleware has access to
 * the full socket (including socket.nsp.name) and can extract the projectId.
 *
 * Persistence: debounce-saves the Yjs binary state to the `ydocs` Mongo
 *              collection on every document update; restores it on first load.
 */

import * as Y from 'yjs';
import { YSocketIO } from 'y-socket.io/dist/server';
import type { Server, Namespace, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

import { JWT_CONFIG } from '../config';
import { canAccessProject } from '../util/projectAccess.util';
import { YDocModel } from '../model/ydoc.model';
import logger from '../util/logger.util';

// Debounce window for Mongo writes (ms)
const PERSIST_DEBOUNCE_MS = 1_000;

/** Map<projectId, NodeJS.Timeout> — pending persist timers */
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Persist the document state to Mongo (debounced).
 * We store a single upserted document per projectId containing the full
 * binary Yjs update so a fresh client can replay the whole state.
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

/**
 * Restore a document's state from Mongo if a snapshot exists.
 * Must be called BEFORE any client connects to the doc.
 */
async function restoreFromMongo(projectId: string, doc: Y.Doc): Promise<void> {
  try {
    const record = await YDocModel.findOne({ projectId }).lean();
    if (record?.state) {
      Y.applyUpdate(doc, record.state as unknown as Uint8Array);
      logger.debug({ message: 'Yjs state restored from Mongo', projectId });
    }
  } catch (err) {
    logger.error({ message: 'Yjs restore error', projectId, error: String(err) });
  }
}

/**
 * Our auth middleware — added to the Yjs namespace AFTER initialize() so that
 * we can access socket.nsp.name to derive the projectId.
 *
 * y-socket.io's own authenticate callback is NOT used (we pass no `authenticate`
 * option) so that it always allows in; our middleware runs first and blocks
 * unauthorized sockets before the y-socket.io connection handler fires.
 */
async function yjsAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    // Extract token from auth
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    if (!token) {
      logger.warn({ message: 'Yjs auth: missing token', socketId: socket.id });
      return next(new Error('Unauthorized'));
    }

    // Verify JWT
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

    // Derive projectId from namespace name: /yjs|<projectId>
    const nspName: string = socket.nsp.name;
    const projectId = nspName.replace(/^\/yjs\|/, '');

    if (!projectId || projectId === nspName) {
      logger.warn({ message: 'Yjs auth: bad namespace', nspName });
      return next(new Error('Unauthorized'));
    }

    // Access check
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

/**
 * initYjsServer — call once after the Socket.IO server is created.
 * Attaches the YSocketIO namespace handler to the existing `io` instance.
 */
export function initYjsServer(io: Server): void {
  // No `authenticate` option — we add our own middleware below.
  const ysocketio = new YSocketIO(io, {
    gcEnabled: true,
  });

  // Wire up document lifecycle hooks for Mongo persistence.
  // Note: lib0/observable's emit(name, args) spreads args, so listeners
  // receive individual arguments, NOT the array.
  ysocketio.on('document-loaded', async (doc: Y.Doc & { name: string }) => {
    // Restore persisted state when the doc first loads
    await restoreFromMongo(doc.name, doc);
  });

  // document-update emits (doc, update)
  ysocketio.on('document-update', (doc: Y.Doc & { name: string }, _update: Uint8Array) => {
    schedulePersist(doc.name, doc);
  });

  // `initialize()` creates ysocketio.nsp (the dynamic namespace matching /^\/yjs\|.*$/)
  // and adds y-socket.io's internal connection handler. We then add OUR auth
  // middleware to the same namespace — socket.io runs `use()` middlewares in
  // registration order, so this runs before any connection event handler.
  ysocketio.initialize();

  const nsp = ysocketio.nsp as Namespace | null;
  if (nsp) {
    nsp.use(yjsAuthMiddleware);
  } else {
    logger.error({ message: 'Yjs nsp is null after initialize — auth NOT applied' });
  }

  logger.info({ message: 'YSocketIO initialized — namespace /yjs|<projectId>' });
}

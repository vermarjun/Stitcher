/**
 * useCollabDoc.ts
 *
 * Hook that creates a Y.Doc and attaches a SocketIOProvider pointed
 * at the API Yjs namespace (/yjs|<projectId>).
 *
 * Returns null until the socket connects (or if token is absent).
 * Gate collab features behind `synced` to avoid flash of stale state.
 *
 * Y.Doc schema (Phase 3):
 *   doc.getMap('timeline'):
 *     'meta'   → Y.Map { resolution:{width,height}, duration, fps }
 *     'tracks' → Y.Array<Y.Map>
 *          track Y.Map: { id, type, locked, muted, items: Y.Array<Y.Map> }
 *            item Y.Map: { id, type, startTime, endTime, assetId?, sourceStartTime?,
 *                          sourceEndTime?, x?, y?, content?, fontFamily?, fontSize?,
 *                          color?, volume? }
 *
 * Phase 4 additions:
 *   awareness — y-protocols Awareness instance (presence, cursors, selections)
 *   setAwarenessCursor(xPx, ts) — write cursor position to awareness
 *   setAwarenessSelection(itemId | null) — write selection to awareness
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';
import type { Awareness } from 'y-protocols/awareness';

const API_BASE = import.meta.env.VITE_BACKEND_URL
  ? (import.meta.env.VITE_BACKEND_URL as string).replace('/api', '')
  : 'http://localhost:3100';

// ─── Per-user stable color ─────────────────────────────────────────────────────
/**
 * Derive a stable HSL hue from a userId string.
 * Two separate users always get the same colour; it looks distinct in the UI.
 */
export function userIdToColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

export interface CollabDoc {
  doc: Y.Doc;
  timelineMap: Y.Map<unknown>;
  synced: boolean;
  awareness: Awareness;
  setAwarenessCursor: (xPx: number, ts: number) => void;
  setAwarenessSelection: (itemId: string | null) => void;
  destroy: () => void;
}

export function useCollabDoc(
  projectId: string | null | undefined,
  token: string | null | undefined,
): CollabDoc | null {
  const [synced, setSynced] = useState(false);
  const ref = useRef<{ doc: Y.Doc; provider: SocketIOProvider } | null>(null);

  useEffect(() => {
    if (!projectId || !token) return;

    const doc = new Y.Doc();

    const provider = new SocketIOProvider(
      API_BASE,
      projectId,
      doc,
      {
        autoConnect: true,
        auth: { token },
        disableBc: true,
      },
    );

    provider.on('sync', (isSynced: boolean) => {
      setSynced(isSynced);

      if (isSynced) {
        // Set local user info in awareness on connect
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const u = JSON.parse(stored) as { _id?: string; username?: string; profilePhoto?: string };
            const id = u._id ?? 'unknown';
            provider.awareness.setLocalStateField('user', {
              id,
              name: u.username ?? 'Anonymous',
              color: userIdToColor(id),
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    });

    ref.current = { doc, provider };

    return () => {
      // Clear local awareness state before disconnecting
      try { provider.awareness.setLocalState(null); } catch { /* ignore */ }
      provider.destroy();
      doc.destroy();
      ref.current = null;
      setSynced(false);
    };
  }, [projectId, token]);

  if (!ref.current) return null;

  const { doc, provider } = ref.current;
  const timelineMap = doc.getMap<unknown>('timeline');
  const { awareness } = provider;

  return {
    doc,
    timelineMap,
    synced,
    awareness,
    setAwarenessCursor: (xPx: number, ts: number) => {
      awareness.setLocalStateField('cursor', { xPx, ts });
    },
    setAwarenessSelection: (itemId: string | null) => {
      if (itemId) {
        awareness.setLocalStateField('selection', { itemId });
      } else {
        awareness.setLocalStateField('selection', null);
      }
    },
    destroy: () => {
      try { awareness.setLocalState(null); } catch { /* ignore */ }
      ref.current?.provider.destroy();
      ref.current?.doc.destroy();
      ref.current = null;
      setSynced(false);
    },
  };
}

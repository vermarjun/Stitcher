/**
 * useCollabDoc.ts
 *
 * Minimal hook that creates a Y.Doc and attaches a SocketIOProvider pointed
 * at the API Yjs namespace (/yjs|<projectId>).
 *
 * Usage:
 *   const { doc, synced, destroy } = useCollabDoc(projectId, token);
 *
 * Returns null values until the socket connects (or if token is absent).
 * Gate collab features behind `synced` to avoid flash of stale state.
 *
 * This is a VERTICAL SLICE — only one Y.Map named "timeline" is used.
 * Phase 3 will expand coverage to the full timeline model.
 */

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { SocketIOProvider } from 'y-socket.io';

const API_BASE = import.meta.env.VITE_BACKEND_URL
  ? (import.meta.env.VITE_BACKEND_URL as string).replace('/api', '')
  : 'http://localhost:3100';

export interface CollabDoc {
  doc: Y.Doc;
  timelineMap: Y.Map<unknown>;
  synced: boolean;
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
    });

    ref.current = { doc, provider };

    return () => {
      provider.destroy();
      doc.destroy();
      ref.current = null;
      setSynced(false);
    };
  }, [projectId, token]);

  if (!ref.current) return null;

  const { doc } = ref.current;
  const timelineMap = doc.getMap<unknown>('timeline');

  return {
    doc,
    timelineMap,
    synced,
    destroy: () => {
      ref.current?.provider.destroy();
      ref.current?.doc.destroy();
      ref.current = null;
      setSynced(false);
    },
  };
}

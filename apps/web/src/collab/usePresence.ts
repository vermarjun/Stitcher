/**
 * usePresence.ts
 *
 * Subscribes to an y-protocols Awareness instance and returns a compact map
 * of all OTHER users' presence state. Updates via the awareness 'change' event
 * so there is never a setState call on every mousemove — only when the
 * awareness diff actually arrives.
 *
 * Shape of each entry:
 *   {
 *     clientId: number,
 *     user: { id: string; name: string; color: string } | null,
 *     cursor: { xPx: number; ts: number } | null,
 *     selection: { itemId: string } | null,
 *   }
 */

import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

export interface PresenceUser {
  clientId: number;
  user: { id: string; name: string; color: string } | null;
  cursor: { xPx: number; ts: number } | null;
  selection: { itemId: string } | null;
}

/** Returns other (not local) users' presence. */
export function usePresence(awareness: Awareness | undefined | null): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const buildOthers = () => {
      const localClientId = awareness.clientID;
      const result: PresenceUser[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === localClientId) return;
        result.push({
          clientId,
          user: (state['user'] as PresenceUser['user']) ?? null,
          cursor: (state['cursor'] as PresenceUser['cursor']) ?? null,
          selection: (state['selection'] as PresenceUser['selection']) ?? null,
        });
      });
      return result;
    };

    // Seed immediately
    setOthers(buildOthers());

    const handler = () => {
      setOthers(buildOthers());
    };

    awareness.on('change', handler);
    return () => {
      awareness.off('change', handler);
    };
  }, [awareness]);

  return others;
}

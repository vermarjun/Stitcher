/**
 * PresenceAvatars.tsx
 *
 * Renders a stacked row of avatar chips — one per OTHER connected user.
 * Shows up to MAX_VISIBLE avatars and a "+N" overflow badge.
 * Each avatar has a coloured ring matching the user's presence colour and
 * a tooltip with their name.
 */

import React from 'react';
import type { PresenceUser } from '@/collab/usePresence';

const MAX_VISIBLE = 4;

interface Props {
  others: PresenceUser[];
}

const PresenceAvatars: React.FC<Props> = ({ others }) => {
  if (others.length === 0) return null;

  // Deduplicate by user.id (same user, multiple tabs)
  const seen = new Set<string>();
  const unique: PresenceUser[] = [];
  for (const p of others) {
    const key = p.user?.id ?? String(p.clientId);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  const visible = unique.slice(0, MAX_VISIBLE);
  const overflow = unique.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1" aria-label="Active collaborators">
      {visible.map((p) => {
        const color = p.user?.color ?? '#888';
        const name = p.user?.name ?? 'Unknown';
        const initials = name.slice(0, 2).toUpperCase();

        return (
          <div
            key={p.user?.id ?? p.clientId}
            className="relative group"
            title={name}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white select-none cursor-default"
              style={{
                background: color,
                boxShadow: `0 0 0 2px ${color}, 0 0 0 3px #09090b`,
              }}
            >
              {initials}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-[200] pointer-events-none">
              <div className="bg-zinc-800 text-zinc-100 text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg border border-zinc-700">
                {name}
              </div>
            </div>
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-[10px] font-bold text-zinc-300 select-none cursor-default"
          title={`${overflow} more collaborator${overflow > 1 ? 's' : ''}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;

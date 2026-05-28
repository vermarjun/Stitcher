/**
 * TimelineCursors.tsx
 *
 * Renders other users' live cursor carets over the timeline area.
 * Positioned absolutely; the parent must have `position: relative`.
 *
 * Props:
 *   others        — presence state from usePresence
 *   timelineWidth — current pixel width of the scrollable timeline
 *   duration      — timeline duration in seconds (for ts→px conversion)
 *   pixelsPerSecond — px/s scale used by the timeline
 */

import React from 'react';
import type { PresenceUser } from '@/collab/usePresence';

interface Props {
  others: PresenceUser[];
  pixelsPerSecond: number;
}

const TimelineCursors: React.FC<Props> = ({ others, pixelsPerSecond: _pps }) => {
  const cursors = others.filter((p) => p.cursor != null);
  if (cursors.length === 0) return null;

  return (
    <>
      {cursors.map((p) => {
        const xPx = p.cursor!.xPx;
        const color = p.user?.color ?? '#888';
        const name = p.user?.name ?? '?';

        return (
          <div
            key={p.user?.id ?? p.clientId}
            className="absolute top-0 bottom-0 pointer-events-none z-40"
            style={{ left: `${xPx}px` }}
          >
            {/* Vertical caret line */}
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{ background: color, opacity: 0.85 }}
            />
            {/* Name label */}
            <div
              className="absolute top-0 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-br-md rounded-tr-md whitespace-nowrap"
              style={{ background: color, left: '2px' }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default TimelineCursors;

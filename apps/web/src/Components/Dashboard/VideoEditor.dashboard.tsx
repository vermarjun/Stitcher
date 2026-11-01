import TimelineEditor from "./TimeLine/main.timeline";
import VideoPlayer from "./VideoPlayer/main.videoplayer";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import VideoPlayerLoading from "@/Components/LoadingScreens/VideoPlayer.loader";
import TimelineEditorLoading from "@/Components/LoadingScreens/Timeline.loader";
import api from "@/api";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/Components/ui/resizable";
import type { Project, Timeline, ITrack, ITimelineItemBase } from "@/State/Types";
import { toast } from "sonner";

import { useRefreshTimeline } from "./RefreshContextProvider";

interface Props {
  currentProject?: Project;
}

/** Edits are saved this long after the last change. */
const SAVE_DEBOUNCE_MS = 500;

/**
 * The API stores asset references as ids. The timeline we hold has the asset
 * documents populated, so collapse them back to ids before saving.
 */
function toSavePayload(tl: Timeline): Timeline {
  return {
    ...tl,
    tracks: (tl.tracks as ITrack[]).map((track) => ({
      ...track,
      items: track.items.map((it) => {
        const asset = (it as ITimelineItemBase).assetId as unknown;
        return {
          ...it,
          assetId:
            asset && typeof asset === "object" ? (asset as { _id: string })._id : asset,
        };
      }),
    })),
  } as Timeline;
}

const VideoEditor = ({ currentProject }: Props) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  // Latest timeline for the debounced saver, plus its save bookkeeping.
  const timelineRef = useRef<Timeline | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const loadedOnceRef = useRef(false);

  const { refreshKey: timelineRefreshKey } = useRefreshTimeline();

  /** Replace the timeline in state and in the ref the saver reads. */
  const applyTimeline = useCallback((next: Timeline | null) => {
    timelineRef.current = next;
    setTimeline(next);
  }, []);

  // ─── Persistence: PUT /timeline/:id, debounced ───────────────────────────
  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const tl = timelineRef.current;
    if (!dirtyRef.current || !tl?._id) return;
    dirtyRef.current = false;
    try {
      await api.put(`/timeline/${tl._id}`, toSavePayload(tl));
    } catch (err) {
      dirtyRef.current = true;
      console.error("Error saving timeline:", err);
      toast.error("Could not save timeline changes");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveNow();
    }, SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  // Save pending edits when leaving the editor or closing the tab.
  useEffect(() => {
    const onUnload = () => {
      void saveNow();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void saveNow();
    };
  }, [saveNow]);

  // ─── Load: GET /timeline/project/:projectId ──────────────────────────────
  const fetchTimeline = async () => {
    const projectId = currentProject?._id;
    if (!projectId) return;
    // Only show the full-screen loader on the VERY FIRST load. A refetch (e.g.
    // after an asset drop or a finished generation) must not blank the editor.
    const firstLoad = !loadedOnceRef.current;
    try {
      if (firstLoad) setLoading(true);
      // Never overwrite edits that have not reached the server yet.
      await saveNow();
      const response = await api.get<Timeline>(`/timeline/project/${projectId}`);
      applyTimeline(response.data);
      loadedOnceRef.current = true;
    } catch (err) {
      console.error("Error fetching timeline:", err);
      toast.error("Error fetching timeline");
    } finally {
      if (firstLoad) setLoading(false);
    }
  };

  // Runs on mount and whenever something else (a finished generation or edit,
  // an asset drop) bumps the refresh key.
  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineRefreshKey]);

  // Effective duration = the stored duration OR the furthest clip end, whichever
  // is larger. Local edits move/extend clips without updating timeline.duration
  // (only the server materialize does), so playback must clamp to this — not the
  // stale stored value — or it stops early before reaching a far-placed clip.
  const effectiveDuration = useMemo(() => {
    if (!timeline) return 0;
    let max = Number(timeline.duration) || 0;
    for (const t of ((timeline.tracks as ITrack[]) ?? [])) {
      for (const it of (t.items ?? [])) {
        const end = (it as ITimelineItemBase).endTime;
        if (typeof end === "number" && end > max) max = end;
      }
    }
    return max;
  }, [timeline]);

  // ─── Playback loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline) return;
    if (isPlaying) {
      lastTimeRef.current = 0;

      const animate = (ts: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = ts;
        } else {
          const delta = (ts - lastTimeRef.current) / 1000;
          lastTimeRef.current = ts;

          setCurrentTime((prev) => {
            const nt = prev + delta;
            if (nt < prev) return prev;
            if (nt >= effectiveDuration) {
              setIsPlaying(false);
              return effectiveDuration;
            }
            return nt;
          });
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      lastTimeRef.current = 0;
    }
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, effectiveDuration]);

  const handlePlayPause = () => setIsPlaying((p) => !p);
  const handleTimeUpdate = (t: number) => setCurrentTime(t);

  // ─── Text item update (video player inline edit) ──────────────────────────
  const handleUpdateTextItem = (
    itemId: string,
    updates: Partial<ITimelineItemBase>
  ) => {
    const current = timelineRef.current;
    if (!current) return;
    applyTimeline({
      ...current,
      tracks: (current.tracks as ITrack[]).map((track: ITrack) =>
        track.type === "text"
          ? {
              ...track,
              items: track.items.map((it: ITimelineItemBase) =>
                it._id === itemId ? { ...it, ...updates } : it
              ),
            }
          : track
      ),
    });
    scheduleSave();
  };

  // ─── onTimelineUpdate: called by TimelineEditor on every drag/resize/toggle ──
  const handleTimelineUpdate = useCallback(
    (updated: Timeline) => {
      applyTimeline(updated);
      scheduleSave();
    },
    [applyTimeline, scheduleSave]
  );

  // ─── Explicit "Sync" button: save right now ────────────────────────────────
  const syncToBackend = useCallback(
    async (tl: Timeline) => {
      applyTimeline(tl);
      dirtyRef.current = true;
      await saveNow();
      if (dirtyRef.current) throw new Error("Failed to sync");
    },
    [applyTimeline, saveNow]
  );

  // ─── Add asset item: optimistic local update ──────────────────────────────
  // The API has already stored the item (POST /track/:trackId/asset), so this
  // only updates what we show and must not trigger a save.
  const handleAddAssetItem = useCallback(
    (trackId: string, item: ITimelineItemBase & Record<string, unknown>) => {
      const current = timelineRef.current;
      if (!current) return;
      applyTimeline({
        ...current,
        tracks: (current.tracks as ITrack[]).map((t) =>
          t._id === trackId ? { ...t, items: [...t.items, item] } : t
        ),
      } as Timeline);
    },
    [applyTimeline]
  );

  const [defaultLayout] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return { video: 62, timeline: 38 };
    }
    return { video: 58, timeline: 42 };
  });

  const sharedPlayerProps = {
    timeline: timeline!,
    currentTime,
    isPlaying,
    onTimeUpdate: handleTimeUpdate,
    onPlayPause: handlePlayPause,
    onUpdateTextItem: handleUpdateTextItem,
    editingTextId,
    setEditingTextId,
  };

  const sharedTimelineProps = {
    timeline: timeline!,
    currentTime,
    onTimeUpdate: handleTimeUpdate,
    onTimelineUpdate: handleTimelineUpdate,
    onSync: syncToBackend,
    onAddAssetItem: handleAddAssetItem,
  };

  return (
    <>
      {/* ── Mobile layout: fixed-height stacked panels (no resizable handle on touch) ── */}
      <div className="md:hidden flex flex-col h-full">
        {/* Video player: ~45vh */}
        <div className="h-[45vh] flex-shrink-0">
          {isLoading || !timeline ? (
            <VideoPlayerLoading />
          ) : (
            <VideoPlayer {...sharedPlayerProps} />
          )}
        </div>
        {/* Timeline: fills remaining space, scrolls internally */}
        <div data-tour="timeline" className="flex-1 min-h-0">
          {isLoading || !timeline ? (
            <TimelineEditorLoading />
          ) : (
            <TimelineEditor {...sharedTimelineProps} />
          )}
        </div>
      </div>

      {/* ── Desktop layout: resizable panels ── */}
      <ResizablePanelGroup direction="vertical" className="hidden md:flex h-full w-full">
        <ResizablePanel defaultSize={defaultLayout.video}>
          {isLoading || !timeline ? (
            <VideoPlayerLoading />
          ) : (
            <VideoPlayer {...sharedPlayerProps} />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout.timeline}>
          <div data-tour="timeline" className="h-full w-full">
            {isLoading || !timeline ? (
              <TimelineEditorLoading />
            ) : (
              <TimelineEditor {...sharedTimelineProps} />
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
};

export default VideoEditor;

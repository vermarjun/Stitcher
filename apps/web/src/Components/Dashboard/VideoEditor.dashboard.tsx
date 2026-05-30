import TimelineEditor from "./TimeLine/main.timeline";
import VideoPlayer from "./VideoPlayer/main.videoplayer";
import { useState, useEffect, useRef, useCallback } from "react";
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
import * as Y from "yjs";

import { useRefreshTimeline } from "./RefreshContextProvider";
import { useCollabDoc } from "@/collab/useCollabDoc";
import {
  yDocToReactTimeline,
  applyItemUpdate,
  deleteYItem,
  addYItem,
  createHydration,
  harvestHydration,
  hasUnresolvedAssets,
} from "@/collab/yjsTimeline";
import { useCollabAwareness } from "./context";

interface Props {
  currentProject?: Project;
}

/** Unique local-origin tag so observeDeep can skip our own writes. */
const LOCAL_ORIGIN = "local-edit";

const VideoEditor = ({ currentProject }: Props) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  // Snapshot of the timeline as fetched from HTTP (used as base for Y.Doc hydration)
  const baseTimelineRef = useRef<Timeline | null>(null);
  // Cache of fully-populated items/assets so re-deriving from the Y.Doc never
  // strips asset objects (the cause of remote-collaborator timeline corruption).
  const hydrationRef = useRef(createHydration());
  const rehydratingRef = useRef(false);

  // Viewers are read-only: default permissive when role is unknown (older payloads).
  const canEdit = (currentProject?.myRole ?? "owner") !== "viewer";

  const { refreshKey: timelineRefreshKey } = useRefreshTimeline();

  // ─── Auth token ─────────────────────────────────────────────────────────
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // ─── Collab doc ──────────────────────────────────────────────────────────
  const collabDoc = useCollabDoc(currentProject?._id ?? null, token);

  // ─── Publish awareness to context so Header can access it ────────────────
  const { setAwareness } = useCollabAwareness();
  useEffect(() => {
    setAwareness(collabDoc?.awareness ?? null);
    return () => { setAwareness(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabDoc?.awareness]);

  // ─── Fetch timeline (used as base; Y.Doc is authoritative once synced) ──
  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const projectId = currentProject?._id;
      if (!projectId) return;
      const response = await api.get<Timeline>(`/timeline/project/${projectId}`);
      const tl = response.data;
      baseTimelineRef.current = tl;
      // Learn every populated asset/item so Y.Doc-derived state can be rehydrated.
      harvestHydration(tl, hydrationRef.current);
      // Only set React timeline from HTTP if Y.Doc isn't synced yet
      if (!collabDoc?.synced) {
        setTimeline(tl);
      }
    } catch (err) {
      console.error("Error fetching timeline:", err);
      toast.error("Error fetching timeline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineRefreshKey]);

  // ─── Re-fetch populated assets when the Y.Doc references one we don't know ──
  // A collaborator can add a brand-new generated/uploaded asset; remote clients
  // first see it as a bare id. Pull the populated timeline once to learn it, then
  // re-derive. Guarded so it can't loop.
  const hydrateFromServer = useCallback(async () => {
    if (rehydratingRef.current) return;
    const projectId = currentProject?._id;
    if (!projectId || !collabDoc) return;
    rehydratingRef.current = true;
    try {
      const response = await api.get<Timeline>(`/timeline/project/${projectId}`);
      harvestHydration(response.data, hydrationRef.current);
      if (baseTimelineRef.current) {
        setTimeline(
          yDocToReactTimeline(
            collabDoc.timelineMap,
            baseTimelineRef.current,
            hydrationRef.current
          )
        );
      }
    } catch {
      /* best-effort */
    } finally {
      rehydratingRef.current = false;
    }
  }, [currentProject?._id, collabDoc]);

  // ─── Seed React state from Y.Doc once synced ─────────────────────────────
  useEffect(() => {
    if (!collabDoc?.synced || !baseTimelineRef.current) return;
    const derived = yDocToReactTimeline(
      collabDoc.timelineMap,
      baseTimelineRef.current,
      hydrationRef.current
    );
    setTimeline(derived);
    if (hasUnresolvedAssets(derived)) void hydrateFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabDoc?.synced]);

  // ─── Observe Y.Doc for remote edits ──────────────────────────────────────
  useEffect(() => {
    if (!collabDoc) return;
    const { timelineMap } = collabDoc;

    const handler = (_events: Y.YEvent<any>[], txn: Y.Transaction) => {
      // Skip echoes from our own local writes
      if (txn.origin === LOCAL_ORIGIN) return;
      // Apply remote changes to React state, rehydrating asset objects so the
      // remote edit doesn't strip thumbnails/playback for this client.
      if (!baseTimelineRef.current) return;
      const derived = yDocToReactTimeline(
        timelineMap,
        baseTimelineRef.current,
        hydrationRef.current
      );
      setTimeline(derived);
      if (hasUnresolvedAssets(derived)) void hydrateFromServer();
    };

    timelineMap.observeDeep(handler);
    return () => {
      timelineMap.unobserveDeep(handler);
    };
  }, [collabDoc, hydrateFromServer]);

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
            if (nt >= Number(timeline.duration)) {
              setIsPlaying(false);
              return Number(timeline.duration);
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
  }, [isPlaying, timeline?.duration]);

  const handlePlayPause = () => setIsPlaying((p) => !p);
  const handleTimeUpdate = (t: number) => setCurrentTime(t);

  // ─── Text item update (video player inline edit) ──────────────────────────
  const handleUpdateTextItem = (
    itemId: string,
    updates: Partial<ITimelineItemBase>
  ) => {
    if (!timeline) return;
    if (!canEdit) return; // viewers are read-only

    // Write to Y.Doc (the observeDeep handler skips LOCAL_ORIGIN echoes)
    if (collabDoc?.synced) {
      const tracksArray = collabDoc.timelineMap.get("tracks") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (tracksArray) {
        const tracks = timeline.tracks as ITrack[];
        const track = tracks.find((t: ITrack) =>
          t.items.some((it) => it._id === itemId)
        );
        if (track) {
          collabDoc.doc.transact(() => {
            applyItemUpdate(tracksArray, track._id, itemId, updates as Record<string, unknown>);
          }, LOCAL_ORIGIN);
        }
      }
    }

    // Optimistic React update
    setTimeline((prev) =>
      prev
        ? {
            ...prev,
            tracks: (prev.tracks as ITrack[]).map((track: ITrack) =>
              track.type === "text"
                ? {
                    ...track,
                    items: track.items.map((it: ITimelineItemBase) =>
                      it._id === itemId ? { ...it, ...updates } : it
                    ),
                  }
                : track
            ),
          }
        : prev
    );
  };

  // ─── onTimelineUpdate: called by TimelineEditor on every drag/resize ──────
  /**
   * For collab-aware updates we receive the full updated React timeline from
   * the editor, diff it against the previous state, and write the delta to Y.Doc.
   *
   * This approach is intentionally conservative: only startTime/endTime/
   * sourceStartTime/sourceEndTime changes are diffed (drag/resize). Track-level
   * changes (mute/lock) and item deletion/addition go through dedicated handlers.
   */
  const handleTimelineUpdate = useCallback(
    (updated: Timeline) => {
      setTimeline(updated);

      if (!collabDoc?.synced) return;
      const tracksArray = collabDoc.timelineMap.get("tracks") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!tracksArray) return;

      collabDoc.doc.transact(() => {
        const updatedTracks = updated.tracks as ITrack[];
        for (const track of updatedTracks) {
          for (const item of track.items) {
            applyItemUpdate(tracksArray, track._id, item._id, {
              startTime: item.startTime,
              endTime: item.endTime,
              ...(item.type === "video" || item.type === "audio"
                ? {
                    sourceStartTime: (item as any).sourceStartTime,
                    sourceEndTime: (item as any).sourceEndTime,
                  }
                : {}),
            });
          }
        }
      }, LOCAL_ORIGIN);
    },
    [collabDoc]
  );

  // ─── Sync (force-save) ────────────────────────────────────────────────────
  /**
   * Persistence is now automatic via Y.Doc materialization.
   * The "Sync" button remains as a best-effort HTTP save for safety.
   */
  const syncToBackend = useCallback(
    async (tl: Timeline) => {
      const res = await api.put<{ success: boolean; message: string }>(
        `/timeline/${tl._id}`,
        tl
      );
      if (!res.data.success) throw new Error("Failed to sync");
    },
    []
  );

  // ─── Delete item (called from TimelineEditor) ─────────────────────────────
  const handleDeleteItem = useCallback(
    (itemId: string, trackId: string) => {
      if (!collabDoc?.synced) return;
      const tracksArray = collabDoc.timelineMap.get("tracks") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!tracksArray) return;

      collabDoc.doc.transact(() => {
        deleteYItem(tracksArray, trackId, itemId);
      }, LOCAL_ORIGIN);
    },
    [collabDoc]
  );

  // ─── Add text item (called from TimelineEditor) ───────────────────────────
  const handleAddTextItem = useCallback(
    (trackId: string, item: ITimelineItemBase & Record<string, unknown>) => {
      if (!collabDoc?.synced) return;
      const tracksArray = collabDoc.timelineMap.get("tracks") as
        | Y.Array<Y.Map<unknown>>
        | undefined;
      if (!tracksArray) return;

      collabDoc.doc.transact(() => {
        addYItem(tracksArray, trackId, item);
      }, LOCAL_ORIGIN);
    },
    [collabDoc]
  );

  const [defaultLayout] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return { video: 62, timeline: 38 };
    }
    return { video: 58, timeline: 42 };
  });

  return (
    <ResizablePanelGroup direction="vertical" className="h-full w-full">
      <ResizablePanel defaultSize={defaultLayout.video}>
        {isLoading || !timeline ? (
          <VideoPlayerLoading />
        ) : (
          <VideoPlayer
            timeline={timeline}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeUpdate}
            onPlayPause={handlePlayPause}
            onUpdateTextItem={handleUpdateTextItem}
            editingTextId={editingTextId}
            setEditingTextId={setEditingTextId}
          />
        )}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultLayout.timeline}>
        <div data-tour="timeline" className="h-full w-full">
        {isLoading || !timeline ? (
          <TimelineEditorLoading />
        ) : (
          <TimelineEditor
            timeline={timeline}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onTimelineUpdate={handleTimelineUpdate}
            onSync={syncToBackend}
            onDeleteItem={handleDeleteItem}
            onAddTextItem={handleAddTextItem}
            canEdit={canEdit}
            collabDoc={collabDoc}
            localOrigin={LOCAL_ORIGIN}
            awareness={collabDoc?.awareness ?? null}
            setAwarenessCursor={collabDoc?.setAwarenessCursor ?? null}
            setAwarenessSelection={collabDoc?.setAwarenessSelection ?? null}
            key={timelineRefreshKey}
          />
        )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default VideoEditor;

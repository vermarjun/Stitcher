import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Scissors,
  Move,
  Type,
  Plus,
  Save,
  Play,
  Music,
  Trash2,
  X,
  Download,
  Share2,
  Link as LinkIcon,
  Copy,
  Eye
} from "lucide-react";
import { Button } from "@/Components/ui/button";
import type {
  Timeline,
  ITrack,
  ITimelineItemBase,
  IVideoTimelineItem,
  IAudioTimelineItem,
  ITextTimelineItem,
} from "@/State/Types";
import api from "@/api";
import { toast } from "sonner";
import type { CollabDoc } from "@/collab/useCollabDoc";
import { newObjectIdHex } from "@/collab/yjsTimeline";
import type { Awareness } from "y-protocols/awareness";
import { usePresence } from "@/collab/usePresence";
import TimelineCursors from "@/Components/Dashboard/Presence/TimelineCursors";

import { useRefreshTracks, useRefreshTimeline } from "../RefreshContextProvider";
import { useDragAsset } from "@/Components/Dashboard/DragAssetContext";
import type { Asset } from "@/State/Types";

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

// Waveform visualization component for audio items
const AudioWaveform = ({
  width,
  waveformPeaks,
}: {
  audioUrl: string;
  width: number;
  duration?: number;
  waveformPeaks?: number[] | null;
}) => {
  // If backend provided peaks, normalise to bar heights (max 40px)
  if (waveformPeaks && waveformPeaks.length > 0) {
    const max = Math.max(...waveformPeaks, 0.001);
    const normalized = waveformPeaks.map((v) => (v / max) * 40 + 5);

    return (
      <div className="absolute inset-0 flex items-center justify-center px-2">
        <svg
          width={width - 16}
          height="100%"
          viewBox={`0 0 ${normalized.length} 50`}
          preserveAspectRatio="none"
          className="opacity-80"
        >
          {normalized.map((amplitude, index) => (
            <rect
              key={index}
              x={index}
              y={25 - amplitude / 2}
              width="1"
              height={amplitude}
              fill="currentColor"
              className="text-emerald-400"
            />
          ))}
        </svg>
      </div>
    );
  }

  // No peaks available — show a shimmer placeholder (not random bars)
  return (
    <div className="absolute inset-0 flex items-center px-2 gap-px overflow-hidden">
      {Array.from({ length: Math.floor((width - 16) / 4) }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-px bg-emerald-600/40 animate-pulse rounded-full"
          style={{ height: `${30 + (i % 5) * 8}%` }}
        />
      ))}
    </div>
  );
};

// Component to render video frames background
const VideoFramesBackground = ({ 
  videoUrl, 
  sourceStartTime,
  sourceEndTime,
  width 
}: { 
  videoUrl: string;
  duration?: number;
  sourceStartTime: number;
  sourceEndTime: number;
  width: number;
}) => {
  const clipDuration = sourceEndTime - sourceStartTime;
  // Calculate how many frames we need based on width (one frame every ~40px)
  const frameCount = Math.max(3, Math.ceil(width / 40));
  
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  
  useEffect(() => {
    // Generate thumbnails based on the source time range
    const thumbs: string[] = [];
    const interval = clipDuration / frameCount;
    
    for (let i = 0; i < frameCount; i++) {
      const timeOffset = Math.floor(sourceStartTime + (i * interval));
      const thumbnailUrl = videoUrl.replace(
        '/upload/',
        `/upload/so_${timeOffset},w_80,h_60,c_fill,q_auto:low/`
      ).replace('.mp4', '.jpg');
      thumbs.push(thumbnailUrl);
    }
    
    setThumbnails(thumbs);
  }, [videoUrl, clipDuration, sourceStartTime, frameCount]);
  
  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-md">
      {thumbnails.map((thumb, idx) => (
        <div
          key={idx}
          className="flex-shrink-0 bg-cover bg-center border-r border-purple-900/30"
          style={{
            width: `${width / frameCount}px`,
            backgroundImage: `url(${thumb})`,
            backgroundSize: 'cover',
          }}
        />
      ))}
      {/* Overlay for better text readability */}
      {/* <div className="absolute inset-0 bg-gradient-to-b from-purple-900/60 to-purple-950/80" /> */}
    </div>
  );
};

const TimelineEditor = ({
  timeline,
  currentTime,
  onTimeUpdate,
  onTimelineUpdate,
  onSync,
  onDeleteItem,
  onAddTextItem,
  onAddAssetItem,
  canEdit = true,
  collabDoc: _collabDoc,
  localOrigin: _localOrigin,
  awareness,
  setAwarenessCursor,
  setAwarenessSelection,
}: {
  timeline: Timeline;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onTimelineUpdate: (timeline: Timeline) => void;
  onSync: (timeline: Timeline) => Promise<void>;
  /** Called after HTTP delete succeeds — writes removal to Y.Doc */
  onDeleteItem?: (itemId: string, trackId: string) => void;
  /** Called after HTTP add-text succeeds — writes new item to Y.Doc */
  onAddTextItem?: (trackId: string, item: ITimelineItemBase & Record<string, unknown>) => void;
  /** Called after HTTP asset-drop succeeds — updates local React state immediately
   *  (server already injects the item into the Y.Doc, so we must NOT write it
   *  to the Y.Doc here or it would create a duplicate clip). */
  onAddAssetItem?: (trackId: string, item: any) => void;
  /** Viewers are read-only — when false, all mutating controls are disabled/hidden. */
  canEdit?: boolean;
  collabDoc?: CollabDoc | null;
  localOrigin?: string;
  /** Phase 4: awareness for presence cursors / selections */
  awareness?: Awareness | null;
  setAwarenessCursor?: ((xPx: number, ts: number) => void) | null;
  setAwarenessSelection?: ((itemId: string | null) => void) | null;
}) => {
  const [selectedItem, setSelectedItem] = useState<ITimelineItemBase | null>(
    null
  );
  const [dragAction, setDragAction] = useState<
    "move" | "resize-left" | "resize-right" | null
  >(null);
  const [dragData, setDragData] = useState<any>(null);
  const [tool, setTool] = useState<"move" | "crop">("move");
  const [isAddingText, setIsAddingText] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond] = useState<number>(38);
  // ── Infinite-ish timeline canvas ────────────────────────────────────────────
  // Real editors give you a long canvas that extends well past your content so
  // you can place clips anywhere (with gaps) and keep scrolling — you never hit
  // a hard "end". We size the canvas to whichever is larger: a 10-minute
  // minimum, or the furthest clip end + 2 minutes of empty runway. It auto-grows
  // as clips are moved/placed further out (no need to pad with dummy audio).
  const TIMELINE_MIN_SECONDS = 600; // 10 minutes of scrollable canvas by default
  const TIMELINE_PAD_SECONDS = 120; // always keep 2 min of empty runway past content
  const contentEndSec = useMemo(() => {
    let max = Number(timeline.duration) || 0;
    for (const t of ((timeline.tracks as ITrack[]) ?? [])) {
      for (const it of (t.items ?? [])) {
        if (it.endTime > max) max = it.endTime;
      }
    }
    return max;
  }, [timeline]);
  const viewDuration = Math.max(
    Math.ceil(contentEndSec) + TIMELINE_PAD_SECONDS,
    TIMELINE_MIN_SECONDS
  );
  // Ruler ticks span the whole canvas so the time labels never get clipped.
  const rulerDuration = viewDuration + 1;
  const [isLoading, setLoading] = useState(false);
  // Share/export dialog state machine.
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePhase, setSharePhase] = useState<"choose" | "working" | "link">("choose");
  const [shareLink, setShareLink] = useState<string>("");
  const [shareBusy, setShareBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Phase 4: Presence ───────────────────────────────────────────────────────
  const others = usePresence(awareness);
  // Throttle cursor awareness writes — keep a ref to the last timeout id
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCursorRef = useRef<{ xPx: number; ts: number } | null>(null);

  const handleTimelineMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!setAwarenessCursor) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const ts = xPx / pixelsPerSecond;
      pendingCursorRef.current = { xPx, ts };

      if (!cursorThrottleRef.current) {
        cursorThrottleRef.current = setTimeout(() => {
          cursorThrottleRef.current = null;
          const pending = pendingCursorRef.current;
          if (pending) {
            setAwarenessCursor(pending.xPx, pending.ts);
            pendingCursorRef.current = null;
          }
        }, 40); // ~25fps throttle
      }
    },
    [setAwarenessCursor, pixelsPerSecond],
  );

  const handleTimelineMouseLeave = useCallback(() => {
    if (!setAwarenessCursor) return;
    // Clear cursor so remote users don't see a stale caret
    if (cursorThrottleRef.current) {
      clearTimeout(cursorThrottleRef.current);
      cursorThrottleRef.current = null;
    }
    pendingCursorRef.current = null;
    // We intentionally don't clear the awareness cursor field here —
    // it expires automatically when the awareness connection drops.
  }, [setAwarenessCursor]);

  // When local selectedItem changes, write to awareness
  useEffect(() => {
    setAwarenessSelection?.(selectedItem?._id ?? null);
  }, [selectedItem, setAwarenessSelection]);

  // Get trigger to refresh Tracks and Timeline
  const { triggerRefresh: triggerTracksRefresh } = useRefreshTracks();
  const { triggerRefresh: triggerTimelineRefresh } = useRefreshTimeline();

  // Drag-and-drop from AssetStash
  const { draggingAsset, setDraggingAsset } = useDragAsset();
  const [isDropping, setIsDropping] = useState(false);

  /** Maps an asset type to the track type it can be dropped on. Returns null for unsupported types. */
  const assetTargetTrackType = (assetType: Asset["type"]): "video" | "audio" | null => {
    if (assetType === "video") return "video";
    if (assetType === "audio") return "audio";
    return null;
  };

  const handleTrackDrop = async (e: React.DragEvent, track: ITrack) => {
    e.preventDefault();
    if (!canEdit || isDropping) return;

    let asset: Asset | null = null;
    try {
      asset = JSON.parse(e.dataTransfer.getData("application/json")) as Asset;
    } catch {
      return;
    }
    if (!asset) return;

    const validType = assetTargetTrackType(asset.type);
    if (!validType || track.type !== validType) return;

    setIsDropping(true);
    try {
      const requestBody = {
        assetId: asset._id,
        sourceStartTime: 0,
        sourceEndTime: asset.duration,
        speed: 1,
        volume: 1,
        opacity: 1,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        fadeIn: 0,
        fadeOut: 0,
      };
      const response = await api.post<{ success: boolean; message?: string; data?: { timelineItem?: any } }>(
        `/track/${track._id}/asset`,
        requestBody
      );
      if (response.data.success) {
        const created = response.data.data?.timelineItem;
        if (created) {
          onAddAssetItem?.(track._id, { ...created, trackId: track._id });
        }
        triggerTracksRefresh();
        // When collab is synced, the new clip arrives via the server's Y.Doc
        // inject + observer (hydrateFromServer then resolves its asset), so a
        // timeline refetch would be redundant and racy. Only refetch the
        // timeline in the non-collab path.
        if (!_collabDoc?.synced) triggerTimelineRefresh();
        toast.success("Successfully added to timeline");
      } else {
        toast.error(response.data.message || "Failed to add asset to timeline");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || error.message || "An unexpected error occurred"
      );
    } finally {
      setIsDropping(false);
      setDraggingAsset(null);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    if (!canEdit) return; // viewers are read-only
    setIsDeleting(true);
    try {
      const response = await api.delete(`/track/items/${selectedItem._id}`);
      if ((response.data as any).success) {
        // Write deletion to Y.Doc (collab-aware)
        onDeleteItem?.(selectedItem._id, selectedItem.trackId);
        // Remove the item from React state
        const updatedTimeline = {
          ...timeline,
          tracks: (timeline.tracks as ITrack[]).map((track) => {
            if (track._id === selectedItem.trackId) {
              return {
                ...track,
                items: track.items.filter(
                  (item) => item._id !== selectedItem._id
                ),
              };
            }
            return track;
          }),
        };
        onTimelineUpdate(updatedTimeline);
        setSelectedItem(null);
        triggerTracksRefresh();
        toast.success("Item deleted successfully");
      } else {
        throw new Error("Failed to delete item");
      }
    } catch (err) {
      toast.error("Failed to delete item");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Keep selectedItem in sync with timeline updates (so the UI reflects the latest object)
  useEffect(() => {
    if (!selectedItem) return;
    // Note: timeline.tracks is 'any' type in your Timeline interface, so we'll need to cast it
    const tracks = timeline.tracks as ITrack[];
    for (const t of tracks) {
      const found = t.items.find((it) => it._id === selectedItem._id);
      if (found) {
        setSelectedItem(found);
        return;
      }
    }
    // if not found, deselect
    setSelectedItem(null);
  }, [timeline, selectedItem]);

  const secondsPerPixel = useCallback(() => {
    // Fixed zoom: the canvas maps exactly `pixelsPerSecond` px to one second,
    // so seconds-per-pixel is simply its inverse — independent of canvas width.
    // (The old `duration / rect.width` made drags slow/wrong on long canvases.)
    return 1 / pixelsPerSecond;
  }, [pixelsPerSecond]);

  const handleItemClick = (item: ITimelineItemBase, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
  };

  const handleItemMouseDown = (
    item: ITimelineItemBase,
    track: ITrack,
    e: React.MouseEvent,
    action: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit) return; // viewers cannot drag / resize
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get asset duration based on item type
    let assetDuration = item.endTime - item.startTime;
    if (item.type === "video" || item.type === "audio") {
      const mediaItem = item as IVideoTimelineItem | IAudioTimelineItem;
      assetDuration = mediaItem.assetId?.duration || assetDuration;
    }

    setDragAction(action);
    setDragData({
      item,
      track,
      startX: e.clientX,
      initialStart: item.startTime,
      initialEnd: item.endTime,
      initialSourceStart:
        item.type === "video" || item.type === "audio"
          ? (item as IVideoTimelineItem | IAudioTimelineItem).sourceStartTime
          : 0,
      initialSourceEnd:
        item.type === "video" || item.type === "audio"
          ? (item as IVideoTimelineItem | IAudioTimelineItem).sourceEndTime
          : item.endTime - item.startTime,
      duration: item.endTime - item.startTime,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragAction || !dragData || !timelineRef.current) return;

      const spp = secondsPerPixel();
      const deltaTime = (e.clientX - dragData.startX) * spp;

      // Helper function to check if two time ranges overlap
      const checkOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
        // Use small epsilon for floating point comparison
        const epsilon = 0.01;
        return (start1 < end2 - epsilon) && (end1 > start2 + epsilon);
      };

      // Helper function to validate no overlap with other items on same track
      const validateNoOverlap = (
        trackId: string, 
        itemId: string, 
        newStart: number, 
        newEnd: number,
        allTracks: ITrack[]
      ): boolean => {
        const track = allTracks.find(t => t._id === trackId);
        if (!track) return true;

        // Check against all other items on the same track
        for (const otherItem of track.items) {
          if (otherItem._id === itemId) continue; // Skip self
          
          if (checkOverlap(newStart, newEnd, otherItem.startTime, otherItem.endTime)) {
            return false; // Overlap detected
          }
        }
        
        return true; // No overlap
      };

      const updatedTimeline = {
        ...timeline,
        tracks: (timeline.tracks as ITrack[]).map((track) => {
          if (track._id !== dragData.track._id) return track;

          return {
            ...track,
            items: track.items.map((it) => {
              if (it._id !== dragData.item._id) return it;

              if (dragAction === "move") {
                // Calculate desired new position
                let newStart = dragData.initialStart + deltaTime;
                
                // Apply basic constraints
                newStart = Math.max(0, newStart); // Can't go before 0
                
                // Don't constrain by timeline duration - allow extending timeline
                // This fixes the issue where items can't be moved when at the end
                const newEnd = newStart + dragData.duration;
                
                // Validate no overlap
                if (!validateNoOverlap(track._id, it._id, newStart, newEnd, timeline.tracks as ITrack[])) {
                  // If overlap detected, don't update position (keep previous valid position)
                  return it;
                }
                
                return {
                  ...it,
                  startTime: newStart,
                  endTime: newEnd,
                };
              }

              if (dragAction === "resize-left") {
                const newStart = Math.max(
                  0,
                  Math.min(
                    dragData.initialEnd - 0.1, // Minimum 0.1s duration
                    dragData.initialStart + deltaTime
                  )
                );
                
                // Validate no overlap
                if (!validateNoOverlap(track._id, it._id, newStart, dragData.initialEnd, timeline.tracks as ITrack[])) {
                  return it;
                }
                
                // for media, shift sourceStartTime; for text, just change startTime
                if (it.type === "text") {
                  return { ...it, startTime: newStart };
                }
                
                const cropDelta = newStart - dragData.initialStart;
                const newSourceStart = Math.max(
                  0,
                  dragData.initialSourceStart + cropDelta
                );

                // Validate source range doesn't exceed asset duration — but ONLY
                // when a real positive duration is known. An unpopulated assetId
                // (bare id string after a collab re-derive) has no .duration; the
                // old `|| 0` made this guard always true and FROZE the drag.
                if (it.type === "video" || it.type === "audio") {
                  const mediaItem = it as IVideoTimelineItem | IAudioTimelineItem;
                  const assetDuration = mediaItem.assetId?.duration;
                  if (typeof assetDuration === "number" && assetDuration > 0 && newSourceStart >= assetDuration) {
                    return it; // Invalid source range
                  }
                }

                // Derive startTime from the CLAMPED source so the on-timeline
                // length and the trimmed source length can never diverge. (Dragging
                // the left edge past the start of available source no longer
                // stretches the clip beyond the media it actually has.)
                const appliedLeftDelta = newSourceStart - dragData.initialSourceStart;
                const clampedStart = dragData.initialStart + appliedLeftDelta;

                return {
                  ...it,
                  startTime: clampedStart,
                  ...(it.type === "video" || it.type === "audio"
                    ? {
                        sourceStartTime: newSourceStart,
                      }
                    : {}),
                } as ITimelineItemBase;
              }

              if (dragAction === "resize-right") {
                const newEnd = Math.max(
                  dragData.initialStart + 0.1, // Minimum 0.1s duration
                  dragData.initialEnd + deltaTime
                );
                
                // Validate no overlap
                if (!validateNoOverlap(track._id, it._id, dragData.initialStart, newEnd, timeline.tracks as ITrack[])) {
                  return it;
                }
                
                if (it.type === "text") {
                  // For text, don't constrain by timeline duration
                  return { ...it, endTime: newEnd };
                }
                
                const cropDelta = newEnd - dragData.initialEnd;
                const newSourceEnd = dragData.initialSourceEnd + cropDelta;

                // Validate source range doesn't exceed asset duration — but ONLY
                // when a real positive duration is known. The old `|| 0` made the
                // clamp fire for ANY clip whose assetId was an unpopulated string,
                // collapsing it to zero/negative width. Skip the clamp when the
                // duration is unknown and let the clip resize normally.
                if (it.type === "video" || it.type === "audio") {
                  const mediaItem = it as IVideoTimelineItem | IAudioTimelineItem;
                  const assetDuration = mediaItem.assetId?.duration;
                  if (typeof assetDuration === "number" && assetDuration > 0 && newSourceEnd > assetDuration) {
                    // Clamp to asset duration
                    const clampedSourceEnd = assetDuration;
                    const clampedEnd = dragData.initialStart + (clampedSourceEnd - dragData.initialSourceStart);
                    return {
                      ...it,
                      endTime: clampedEnd,
                      ...(it.type === "video" || it.type === "audio"
                        ? {
                            sourceEndTime: clampedSourceEnd,
                          }
                        : {}),
                    } as ITimelineItemBase;
                  }
                }
                
                return {
                  ...it,
                  endTime: newEnd,
                  ...(it.type === "video" || it.type === "audio"
                    ? {
                        sourceEndTime: newSourceEnd,
                      }
                    : {}),
                } as ITimelineItemBase;
              }

              return it;
            }),
          };
        }),
      };

      // Use onTimelineUpdate instead of setTimeline
      onTimelineUpdate(updatedTimeline);
    },
    [dragAction, dragData, secondsPerPixel, timeline, onTimelineUpdate]
  );

  const handleMouseUp = useCallback(() => {
    setDragAction(null);
    setDragData(null);
  }, []);

  useEffect(() => {
    if (!dragAction) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragAction, handleMouseMove, handleMouseUp]);

  const handlePlayheadDrag = () => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const onMove = (ev: MouseEvent) => {
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      const time = Math.max(0, Math.min(x / pixelsPerSecond, viewDuration));
      onTimeUpdate(time);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Add new text item (duration default 3s); position is later adjusted in VideoPlayer by dragging
  const handleTextTrackClick = async (e: React.MouseEvent) => {
    if (!canEdit) return; // viewers are read-only
    if (!isAddingText || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = Math.max(0, x / pixelsPerSecond);

    const tracks = timeline.tracks as ITrack[];
    const textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) return;

    // Use a client-generated 24-hex ObjectId so the Y.Doc id and Mongo _id match
    const clientId = newObjectIdHex();

    let newTextItem: ITextTimelineItem = {
      _id: clientId,
      type: "text",
      trackId: textTrack._id,
      startTime: clickTime,
      endTime: clickTime + 3,
      content: "New Text",
      fontFamily: "Arial",
      fontSize: 32,
      color: "#ffffff",
      x: 50,
      y: 50,
      metadata: {},
    };

    try {
      const response = await api.post(
        `/track/${textTrack._id}/text`,
        { ...newTextItem, _id: clientId }
      );
      if (!(response.data as any).success) {
        throw Error(
          "Operation failed, backend responded with",
          (response.data as any).error
        );
      } else {
        newTextItem = (response.data as any).data.timelineItem;
        // Write new item to Y.Doc (collab-aware) using the server-confirmed _id
        onAddTextItem?.(textTrack._id, {
          ...newTextItem,
          id: newTextItem._id,
        } as ITimelineItemBase & Record<string, unknown>);
        const updated: Timeline = {
          ...timeline,
          tracks: tracks.map((t) =>
            t._id === textTrack._id
              ? { ...t, items: [...t.items, newTextItem] }
              : t
          ),
        };
        onTimelineUpdate(updated);
        setIsAddingText(false);
      }
    } catch (err) {
      toast.error(String(err));
      console.error(err);
    } finally {
      toast.success("Text added successfully");
      setLoading(false);
    }
  };

  const handleAddTextClick = () => {
    if (!canEdit) return; // viewers are read-only
    setIsAddingText(true);
    setTool("move");
  };

  const handleSyncClick = async () => {
    setLoading(true);
    try {
      console.log("Syncing timeline:", timeline); // Debug log
      await onSync(timeline); // Now this will have the updated timeline
      toast.success("Project Synced Successfully!");
    } catch (e) {
      toast.error("Project Syncing error!");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Open the Share dialog (choose download vs shareable link).
  const openShareDialog = () => {
    setShareLink("");
    setSharePhase("choose");
    setShareOpen(true);
  };

  // Render the current timeline server-side, then either force a real file
  // download or produce a Stitcher share link — never expose Cloudinary URLs.
  const runExport = async (mode: "download" | "share") => {
    const projectId = String(timeline.projectId);
    if (!projectId) {
      toast.error("Missing project id — cannot export");
      return;
    }
    setShareBusy(true);
    setSharePhase("working");
    const pending = toast.loading(
      mode === "download" ? "Rendering your video…" : "Creating a shareable link…"
    );
    try {
      // Persist current edits first so the server exports what the user sees.
      try { await onSync(timeline); } catch { /* best-effort; export reads DB */ }

      const res = await api.post<{
        success: boolean;
        data?: { mode: string; downloadUrl?: string; shareUrl?: string; warnings?: string[] };
        message?: string;
      }>(`/timeline/project/${projectId}/export`, { mode });

      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || "Export failed");
      }
      (res.data.data.warnings ?? []).forEach((w) => toast.warning(w, { duration: 8000 }));

      if (mode === "download") {
        const dl = res.data.data.downloadUrl!;
        // fl_attachment makes Cloudinary serve Content-Disposition: attachment,
        // so this downloads the file directly rather than opening a tab.
        const a = document.createElement("a");
        a.href = dl;
        a.download = `stitcher-video-${projectId}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Download started", { id: pending });
        setShareOpen(false);
      } else {
        const link = res.data.data.shareUrl!;
        setShareLink(link);
        setSharePhase("link");
        toast.success("Share link ready", { id: pending });
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Export failed", { id: pending });
      console.error("export error", e);
      setSharePhase("choose");
    } finally {
      setShareBusy(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  const handleCancelAddTextOrDelete = () => {
    setIsAddingText(false);
    setIsDeleting(false);
    setSelectedItem(null);
  };

  const tracks = timeline.tracks as ITrack[];

  return (
    <div className="h-full flex flex-col bg-black border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Header with enhanced visual hierarchy */}
      {/* On mobile: single scrollable row so all controls stay reachable */}
      <div className="flex items-center gap-2 p-2 md:p-2.5 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm overflow-x-auto scrollbar-none">
        {/* Tool Selection with bold visual feedback */}
        <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 flex-shrink-0">
          <Button
            className={`p-1.5 rounded-md transition-all duration-200 ${
              tool === "move"
                ? "bg-white text-black shadow-md scale-105"
                : "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
            title="Move tool"
            onClick={() => setTool("move")}
          >
            <Move className="w-3.5 h-3.5" />
          </Button>
          <Button
            className={`p-1.5 rounded-md transition-all duration-200 ${
              tool === "crop"
                ? "bg-white text-black shadow-md scale-105"
                : "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-700"
            }`}
            title="Crop tool"
            onClick={() => setTool("crop")}
          >
            <Scissors className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Add Text Button with modern styling */}
        {canEdit && (
          <Button
            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border flex-shrink-0 ${
              isAddingText
                ? "bg-green-600 text-white border-green-500 shadow-md shadow-green-600/25"
                : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border-zinc-700 hover:border-zinc-600"
            }`}
            title="Add text overlay"
            onClick={handleAddTextClick}
          >
            <Plus className="w-3 h-3" />
            <Type className="w-3 h-3" />
            <span className="hidden sm:inline">Add Text</span>
          </Button>
        )}

        {/* Read-only badge for viewers */}
        {!canEdit && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md flex-shrink-0">
            <Eye className="w-3 h-3 text-zinc-400" />
            <span className="text-zinc-400 text-xs font-medium hidden sm:inline">View only</span>
          </div>
        )}

        {/* Status indicator with better visibility */}
        {isAddingText && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md flex-shrink-0">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-medium hidden sm:inline">
              Click timeline to place text
            </span>
          </div>
        )}

        {/* Spacer pushes right-side controls to the end on desktop; on mobile everything scrolls */}
        <div className="hidden md:flex flex-1" />

        {(selectedItem || isAddingText) && (
          <Button
            onClick={handleCancelAddTextOrDelete}
            className="p-2 rounded-lg transition-all duration-200 shadow-md bg-zinc-700 text-white hover:bg-zinc-600 shadow-zinc-600/25 border border-zinc-600 flex-shrink-0"
            title={isAddingText ? "Cancel adding text" : "Deselect item"}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        )}

        {selectedItem && canEdit && (
          <Button
            onClick={handleDeleteItem}
            disabled={isDeleting}
            className={`p-2 rounded-lg transition-all duration-200 shadow-md flex-shrink-0 ${
              isDeleting
                ? "text-white shadow-red-600/25 animate-pulse cursor-not-allowed"
                : "bg-zinc-600 text-white hover:bg-red-600"
            }`}
            title={isDeleting ? "Deleting..." : "Delete selected item"}
          >
            {isDeleting ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* Sync Icon Button — writes to the project, so editors/owners only */}
        {canEdit && (
          <Button
            onClick={handleSyncClick}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-all duration-200 shadow-md flex-shrink-0 ${
              isLoading
                ? "bg-amber-600 text-white shadow-amber-600/25 animate-pulse cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25"
            } border border-opacity-20 ${
              isLoading ? "border-amber-400" : "border-blue-400"
            }`}
            title={isLoading ? "Syncing..." : "Sync (save) timeline to backend"}
          >
            {isLoading ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isLoading ? "Syncing..." : "Sync"}</span>
          </Button>
        )}

        {/* Share Button — opens a dialog to download or get a shareable link */}
        <Button
          onClick={openShareDialog}
          disabled={shareBusy || isLoading}
          className={`p-2 rounded-lg transition-all duration-200 shadow-md flex items-center gap-1 flex-shrink-0 ${
            shareBusy
              ? "bg-zinc-700 text-white animate-pulse cursor-not-allowed"
              : "bg-zinc-100 text-black hover:bg-white shadow-white/10"
          } border border-zinc-500/40`}
          title="Share or download this video"
        >
          {shareBusy ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{shareBusy ? "Working..." : "Share"}</span>
        </Button>
      </div>

      {/* ── Share dialog ──────────────────────────────────────────────── */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => !shareBusy && setShareOpen(false)}
        >
          <div
            className="w-full max-w-[460px] rounded-xl border border-zinc-700 bg-black p-5 text-zinc-100 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">Share video</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Export video as an MP4 or a public Stitcher link.
                </p>
              </div>
              <button
                onClick={() => !shareBusy && setShareOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                disabled={shareBusy}
                aria-label="Close share dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sharePhase === "choose" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => runExport("download")}
                  className="group rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 text-left transition-colors hover:bg-zinc-800/80"
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-black text-zinc-200 group-hover:text-white">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-white">Download MP4</div>
                  <div className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Save the rendered file locally.
                  </div>
                </button>
                <button
                  onClick={() => runExport("share")}
                  className="group rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 text-left transition-colors hover:bg-zinc-800/80"
                >
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-black text-zinc-200 group-hover:text-white">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-white">Public link</div>
                  <div className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Create a Stitcher watch page.
                  </div>
                </button>
              </div>
            )}

            {sharePhase === "working" && (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 text-zinc-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
                <div>
                  <p className="text-sm font-medium text-white">Rendering video</p>
                  <p className="text-xs text-zinc-400">This can take a minute.</p>
                </div>
              </div>
            )}

            {sharePhase === "link" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-2">
                  <input
                    readOnly
                    value={shareLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={shareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-400 transition-colors hover:text-white"
                  >
                    Open link
                  </a>
                  <button
                    onClick={copyShareLink}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-200"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline content with improved visual depth */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-black to-zinc-950">
        <div className="flex-1 overflow-auto">
          <div
            className="relative min-h-full"
            style={{
              width: `${Math.max(
                viewDuration * pixelsPerSecond,
                window.innerWidth - 32
              )}px`,
            }}
          >
            {/* Minimal Time Ruler with Click-to-Seek */}
            <div 
              className="relative h-6 bg-zinc-950 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900/50 transition-colors"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const clickTime = x / pixelsPerSecond;
                // Clamp to valid range
                const targetTime = Math.max(0, Math.min(clickTime, viewDuration));
                onTimeUpdate(targetTime);
              }}
              title="Click to seek"
            >
              {Array.from({ length: rulerDuration }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex flex-col pointer-events-none"
                  style={{ left: `${i * pixelsPerSecond}px` }}
                >
                  <div className="w-px h-3 bg-zinc-600" />
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5 select-none">
                    {formatTime(i)}
                  </span>
                </div>
              ))}
            </div>

            {/* Enhanced Tracks */}
            <div
              ref={timelineRef}
              className="flex flex-col gap-2 p-2 relative"
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={handleTimelineMouseLeave}
            >
              {/* Phase 4: other users' live cursors */}
              <TimelineCursors others={others} pixelsPerSecond={pixelsPerSecond} />

              {tracks.map((track) => {
                // Compute drag-highlight state for this track
                const validDropType = draggingAsset ? assetTargetTrackType(draggingAsset.type) : null;
                const isValidDropTarget = draggingAsset !== null && validDropType === track.type;
                const isDimmedDropTarget = draggingAsset !== null && !isValidDropTarget;

                const trackClassName = [
                  "relative flex-1 min-h-[60px] max-h-[150px] bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden backdrop-blur-sm shadow-inner",
                  isValidDropTarget ? "ring-2 ring-green-500/70 border-green-500/50 bg-zinc-900" : "",
                  isDimmedDropTarget ? "opacity-40 pointer-events-none" : "",
                ].filter(Boolean).join(" ");

                return (
                <div
                  key={track._id}
                  className={trackClassName}
                  onClick={
                    track.type === "text" ? handleTextTrackClick : () => {}
                  }
                  onDragOver={isValidDropTarget ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  } : undefined}
                  onDrop={isValidDropTarget ? (e) => handleTrackDrop(e, track) : undefined}
                >
                  {/* Track label with better typography */}
                  <div className="absolute left-0 top-0 bg-gradient-to-r from-zinc-800 to-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-200 uppercase tracking-wider z-10 rounded-br-lg border-r border-b border-zinc-600">
                    {track.type}
                  </div>

                  {/* Track items with enhanced visual distinction */}
                  {track.items.map((item) => {
                    const leftPx = item.startTime * pixelsPerSecond;
                    // Floor width at 0 so a momentarily-invalid item (endTime <
                    // startTime) can never render a negative box that visually
                    // collapses/overlaps onto a neighbour.
                    const widthPx = Math.max(
                      0,
                      (item.endTime - item.startTime) * pixelsPerSecond
                    );

                    // Enhanced color scheme for different item types
                    const getItemStyle = () => {
                      const baseClasses =
                        "absolute top-3 bottom-3 rounded-md shadow-lg transition-all duration-200 border overflow-hidden";
                      const isSelected = selectedItem?._id === item._id;
                      const isDragging =
                        dragAction && dragData?.item._id === item._id;

                      let colorClasses = "";
                      if (item.type === "video") {
                        colorClasses = isSelected
                          ? "border-0 shadow-purple-600/30"
                          : "border-0";
                      } else if (item.type === "audio") {
                        colorClasses = isSelected
                          ? "border-0 bg-gradient-to-r from-emerald-600/50 to-emerald-700/50 border-emerald-400/50 shadow-emerald-600/30"
                          : "border-0 bg-gradient-to-r from-emerald-700/50 to-emerald-800/50 border-emerald-600/50 hover:from-emerald-600/50 hover:to-emerald-700/50";
                      } else {
                        colorClasses = isSelected
                          ? "bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400 shadow-amber-600/30"
                          : "bg-gradient-to-r from-amber-700 to-amber-800 border-amber-600 hover:from-amber-600 hover:to-amber-700";
                      }

                      const opacityClass = isDragging ? "opacity-60" : "";
                      const ringClass = isSelected
                        ? "ring-2 ring-white/30"
                        : "";

                      return `${baseClasses} ${colorClasses} ${opacityClass} ${ringClass}`;
                    };

                    // Get item name based on type
                    const getItemName = () => {
                      if (item.type === "text") {
                        return (item as ITextTimelineItem).content;
                      }
                      if (item.type === "video" || item.type === "audio") {
                        return (
                          (item as IVideoTimelineItem | IAudioTimelineItem)
                            .assetId?.name || "Unnamed"
                        );
                      }
                      return "Unknown";
                    };

                    // Phase 4: find remote users who have selected this item
                    const remoteSelectors = others.filter(
                      (p) => p.selection?.itemId === item._id && p.user,
                    );

                    return (
                      <div
                        key={item._id}
                        className={getItemStyle()}
                        style={{
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          cursor: tool === "move" ? "move" : "default",
                          // Layered box-shadow for remote selections
                          boxShadow: remoteSelectors.length > 0
                            ? remoteSelectors
                                .map((p, i) => `0 0 0 ${(i + 2) * 2}px ${p.user!.color}`)
                                .join(', ')
                            : undefined,
                        }}
                        onClick={(e) => handleItemClick(item, e)}
                        onMouseDown={(e) =>
                          handleItemMouseDown(item, track, e, "move")
                        }
                      >
                        {/* Video frames background */}
                        {item.type === "video" && (item as IVideoTimelineItem).assetId?.url && (
                          <VideoFramesBackground
                            videoUrl={(item as IVideoTimelineItem).assetId!.url}
                            duration={(item as IVideoTimelineItem).assetId!.duration}
                            sourceStartTime={(item as IVideoTimelineItem).sourceStartTime}
                            sourceEndTime={(item as IVideoTimelineItem).sourceEndTime}
                            width={widthPx}
                          />
                        )}

                        {/* Audio waveform visualization */}
                        {item.type === "audio" && (item as IAudioTimelineItem).assetId?.url && (
                          <AudioWaveform
                            audioUrl={(item as IAudioTimelineItem).assetId!.url}
                            width={widthPx}
                            duration={(item as IAudioTimelineItem).assetId!.duration}
                            waveformPeaks={(item as IAudioTimelineItem).assetId?.waveformPeaks}
                          />
                        )}

                        {/* Item content with better readability */}
                        <div className="relative px-2 py-1 text-xs font-semibold text-white truncate pointer-events-none flex items-center gap-1.5 z-10">
                          {item.type === "video" && (
                            <Play className="w-2.5 h-2.5 opacity-75" />
                          )}
                          {item.type === "audio" && (
                            <Music className="w-2.5 h-2.5 opacity-75" />
                          )}
                          {item.type === "text" && (
                            <Type className="w-2.5 h-2.5 opacity-75" />
                          )}
                          <span>{getItemName()}</span>
                        </div>

                        {/* Enhanced resize handles */}
                        {tool === "crop" && canEdit && (
                          <>
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 bg-white/80 cursor-ew-resize rounded-l-lg flex items-center justify-center hover:bg-white transition-colors z-20"
                              onMouseDown={(e) =>
                                handleItemMouseDown(
                                  item,
                                  track,
                                  e,
                                  "resize-left"
                                )
                              }
                            >
                              <div className="w-0.5 h-4 bg-black/50 rounded" />
                            </div>
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 bg-white/80 cursor-ew-resize rounded-r-lg flex items-center justify-center hover:bg-white transition-colors z-20"
                              onMouseDown={(e) =>
                                handleItemMouseDown(
                                  item,
                                  track,
                                  e,
                                  "resize-right"
                                )
                              }
                            >
                              <div className="w-0.5 h-4 bg-black/50 rounded" />
                            </div>
                          </>
                        )}

                        {/* Phase 4: remote selection name tags */}
                        {remoteSelectors.length > 0 && (
                          <div className="absolute -top-5 left-0 flex gap-1 pointer-events-none z-30">
                            {remoteSelectors.map((p) => (
                              <span
                                key={p.user!.id}
                                className="text-[9px] font-semibold text-white px-1 py-0.5 rounded whitespace-nowrap"
                                style={{ background: p.user!.color }}
                              >
                                {p.user!.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>

            <div
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-red-400 to-red-600 z-30 pointer-events-none shadow-lg shadow-red-600/50"
              style={{
                left: `${currentTime * pixelsPerSecond}px`,
              }}
            >
              <div
                className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-red-500 rotate-45 cursor-ew-resize pointer-events-auto shadow-lg border-2 border-white hover:scale-110 transition-transform"
                onMouseDown={handlePlayheadDrag}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

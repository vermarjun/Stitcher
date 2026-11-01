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

// Component to render video frames background.
// Repeats the asset's stored thumbnail across the clip; storage backends do not
// expose per-timestamp frames, so there is one image per clip.
const VideoFramesBackground = ({
  thumbnailUrl,
  width
}: {
  thumbnailUrl?: string;
  width: number;
}) => {
  // One tile every ~40px
  const frameCount = Math.max(3, Math.ceil(width / 40));
  if (!thumbnailUrl) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-md">
      {Array.from({ length: frameCount }, (_, idx) => (
        <div
          key={idx}
          className="flex-shrink-0 bg-cover bg-center border-r border-purple-900/30"
          style={{
            width: `${width / frameCount}px`,
            backgroundImage: `url(${thumbnailUrl})`,
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
  onAddAssetItem,
}: {
  timeline: Timeline;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onTimelineUpdate: (timeline: Timeline) => void;
  onSync: (timeline: Timeline) => Promise<void>;
  /** Called after the API stored a dropped asset; shows it locally right away. */
  onAddAssetItem?: (trackId: string, item: any) => void;
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
  const [exportBusy, setExportBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (isDropping) return;

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
        triggerTimelineRefresh();
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
    setIsDeleting(true);
    try {
      const response = await api.delete(`/track/items/${selectedItem._id}`);
      if ((response.data as any).success) {
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
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

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
                // (a bare id string) has no .duration; the old `|| 0` made this
                // guard always true and froze the drag.
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
    if (!isAddingText || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = Math.max(0, x / pixelsPerSecond);

    const tracks = timeline.tracks as ITrack[];
    const textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) return;

    // The API assigns the item id; the created item comes back in the response.
    const newTextBody = {
      type: "text",
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
        newTextBody
      );
      if (!(response.data as any).success) {
        throw Error(
          "Operation failed, backend responded with",
          (response.data as any).error
        );
      } else {
        const newTextItem: ITextTimelineItem = (response.data as any).data.timelineItem;
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
    setIsAddingText(true);
    setTool("move");
  };

  const handleSyncClick = async () => {
    setLoading(true);
    try {
      await onSync(timeline); // Now this will have the updated timeline
      toast.success("Project Synced Successfully!");
    } catch (e) {
      toast.error("Project Syncing error!");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Save current edits, render the timeline server-side, then download the MP4.
  const runExport = async () => {
    const projectId = String(timeline.projectId);
    if (!projectId) {
      toast.error("Missing project id — cannot export");
      return;
    }
    setExportBusy(true);
    const pending = toast.loading("Rendering your video…");
    try {
      // Persist current edits first so the server exports what the user sees.
      try { await onSync(timeline); } catch { /* best-effort; export reads DB */ }

      const res = await api.post<{
        success: boolean;
        data?: { mode: string; downloadUrl?: string; durationSec?: number; warnings?: string[] };
        message?: string;
      }>(`/timeline/project/${projectId}/export`, {});

      const downloadUrl = res.data.data?.downloadUrl;
      if (!res.data.success || !downloadUrl) {
        throw new Error(res.data.message || "Export failed");
      }
      (res.data.data?.warnings ?? []).forEach((w) => toast.warning(w, { duration: 8000 }));

      // The API sends Content-Disposition: attachment for this URL, so a plain
      // link saves the file instead of navigating away.
      const a = document.createElement("a");
      a.href = downloadUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download started", { id: pending });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Export failed", { id: pending });
      console.error("export error", e);
    } finally {
      setExportBusy(false);
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

        {selectedItem && (
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

        {/* Sync Icon Button — saves the timeline right now */}
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

        {/* Export Button — renders the timeline and downloads the MP4 */}
        <Button
          onClick={runExport}
          disabled={exportBusy || isLoading}
          className={`p-2 rounded-lg transition-all duration-200 shadow-md flex items-center gap-1 flex-shrink-0 ${
            exportBusy
              ? "bg-zinc-700 text-white animate-pulse cursor-not-allowed"
              : "bg-zinc-100 text-black hover:bg-white shadow-white/10"
          } border border-zinc-500/40`}
          title="Render and download this video as an MP4"
        >
          {exportBusy ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{exportBusy ? "Rendering..." : "Export"}</span>
        </Button>
      </div>

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
            >
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

                    return (
                      <div
                        key={item._id}
                        className={getItemStyle()}
                        style={{
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          cursor: tool === "move" ? "move" : "default",
                        }}
                        onClick={(e) => handleItemClick(item, e)}
                        onMouseDown={(e) =>
                          handleItemMouseDown(item, track, e, "move")
                        }
                      >
                        {/* Video frames background */}
                        {item.type === "video" && (item as IVideoTimelineItem).assetId?.url && (
                          <VideoFramesBackground
                            thumbnailUrl={(item as IVideoTimelineItem).assetId!.thumbnail}
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
                        {tool === "crop" && (
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

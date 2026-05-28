import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Copy
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

import { useRefreshTracks } from "../RefreshContextProvider";

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
  collabDoc: _collabDoc,
  localOrigin: _localOrigin,
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
  collabDoc?: CollabDoc | null;
  localOrigin?: string;
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
  const [rulerDuration] = useState<number>(
    Math.max(50, Number(timeline.duration) + 1)
  );
  const [isLoading, setLoading] = useState(false);
  // Share/export dialog state machine.
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePhase, setSharePhase] = useState<"choose" | "working" | "link">("choose");
  const [shareLink, setShareLink] = useState<string>("");
  const [shareBusy, setShareBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get trigger to refresh Tracks
  const { triggerRefresh: triggerTracksRefresh } = useRefreshTracks();

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
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
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0.01; // fallback
    return Number(timeline.duration) / rect.width;
  }, [timeline.duration]);

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
                
                // Validate source range doesn't exceed asset duration
                if (it.type === "video" || it.type === "audio") {
                  const mediaItem = it as IVideoTimelineItem | IAudioTimelineItem;
                  const assetDuration = mediaItem.assetId?.duration || 0;
                  if (newSourceStart >= assetDuration) {
                    return it; // Invalid source range
                  }
                }
                
                return {
                  ...it,
                  startTime: newStart,
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
                
                // Validate source range doesn't exceed asset duration
                if (it.type === "video" || it.type === "audio") {
                  const mediaItem = it as IVideoTimelineItem | IAudioTimelineItem;
                  const assetDuration = mediaItem.assetId?.duration || 0;
                  if (newSourceEnd > assetDuration) {
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
      const time = (x / rect.width) * Number(timeline.duration);
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
    const clickTime = (x / rect.width) * Number(timeline.duration);

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
      endTime: Math.min(clickTime + 3, Number(timeline.duration)),
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
      <div className="flex items-center justify-between p-2.5 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {/* Tool Selection with bold visual feedback */}
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
              isAddingText
                ? "bg-green-600 text-white border-green-500 shadow-md shadow-green-600/25"
                : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border-zinc-700 hover:border-zinc-600"
            }`}
            title="Add text overlay"
            onClick={handleAddTextClick}
          >
            <Plus className="w-3 h-3" />
            <Type className="w-3 h-3" />
            <span>Add Text</span>
          </Button>

          {/* Status indicator with better visibility */}
          {isAddingText && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-xs font-medium">
                Click timeline to place text
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(selectedItem || isAddingText) && (
            <Button
              onClick={handleCancelAddTextOrDelete}
              className="p-2 rounded-lg transition-all duration-200 shadow-md bg-zinc-700 text-white hover:bg-zinc-600 shadow-zinc-600/25 border border-zinc-600"
              title={isAddingText ? "Cancel adding text" : "Deselect item"}
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </Button>
          )}

          {selectedItem && (
            <Button
              onClick={handleDeleteItem}
              disabled={isDeleting}
              className={`p-2 rounded-lg transition-all duration-200 shadow-md ${
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

          {/* Sync Icon Button */}
          <Button
            onClick={handleSyncClick}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-all duration-200 shadow-md ${
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
            <span>{isLoading ? "Syncing..." : "Sync"}</span>
          </Button>

          {/* Share Button — opens a dialog to download or get a shareable link */}
          <Button
            onClick={openShareDialog}
            disabled={shareBusy || isLoading}
            className={`p-2 rounded-lg transition-all duration-200 shadow-md flex items-center gap-1 ${
              shareBusy
                ? "bg-emerald-700 text-white shadow-emerald-700/25 animate-pulse cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/25"
            } border border-opacity-20 border-emerald-400`}
            title="Share or download this video"
          >
            {shareBusy ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span>{shareBusy ? "Working..." : "Share"}</span>
          </Button>
        </div>
      </div>

      {/* ── Share dialog ──────────────────────────────────────────────── */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !shareBusy && setShareOpen(false)}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">Share video</h3>
              <button
                onClick={() => !shareBusy && setShareOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                disabled={shareBusy}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sharePhase === "choose" && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400 mb-1">
                  How do you want to share this video?
                </p>
                <button
                  onClick={() => runExport("download")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
                >
                  <Download className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-100">Download</div>
                    <div className="text-xs text-zinc-400">Save the MP4 to your computer</div>
                  </div>
                </button>
                <button
                  onClick={() => runExport("share")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
                >
                  <LinkIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-100">Get a shareable link</div>
                    <div className="text-xs text-zinc-400">A Stitcher link anyone can open</div>
                  </div>
                </button>
              </div>
            )}

            {sharePhase === "working" && (
              <div className="flex flex-col items-center gap-3 py-8 text-zinc-400">
                <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-emerald-400 rounded-full" />
                <span className="text-sm">Rendering your video… this can take a minute.</span>
              </div>
            )}

            {sharePhase === "link" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Your video is ready. Share this link — it opens on Stitcher.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-zinc-200 truncate"
                  />
                  <button
                    onClick={copyShareLink}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-sm"
                  >
                    <Copy className="w-4 h-4" /> Copy
                  </button>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <a
                    href={shareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:underline"
                  >
                    Open link →
                  </a>
                  <button
                    onClick={() => setShareOpen(false)}
                    className="text-sm text-zinc-400 hover:text-zinc-200"
                  >
                    Done
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
                Number(timeline.duration) * pixelsPerSecond,
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
                const targetTime = Math.max(0, Math.min(clickTime, Number(timeline.duration)));
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
            <div ref={timelineRef} className="flex flex-col gap-2 p-2">
              {tracks.map((track) => (
                <div
                  key={track._id}
                  className="relative flex-1 min-h-[60px] max-h-[150px] bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden backdrop-blur-sm shadow-inner"
                  onClick={
                    track.type == "text" ? handleTextTrackClick : () => {}
                  }
                >
                  {/* Track label with better typography */}
                  <div className="absolute left-0 top-0 bg-gradient-to-r from-zinc-800 to-zinc-700 px-2 py-1 text-[10px] font-bold text-zinc-200 uppercase tracking-wider z-10 rounded-br-lg border-r border-b border-zinc-600">
                    {track.type}
                  </div>

                  {/* Track items with enhanced visual distinction */}
                  {track.items.map((item) => {
                    const leftPx = item.startTime * pixelsPerSecond;
                    const widthPx =
                      (item.endTime - item.startTime) * pixelsPerSecond;

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
              ))}
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
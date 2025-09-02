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
  X
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

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const TimelineEditor = ({
  timeline, // Use the prop directly instead of local state
  currentTime,
  onTimeUpdate,
  onTimelineUpdate,
  onSync,
}: {
  timeline: Timeline;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onTimelineUpdate: (timeline: Timeline) => void;
  onSync: (timeline: Timeline) => Promise<void>;
}) => {
  // REMOVED: const [timeline, setTimeline] = useState(initialTimeline);
  
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
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setIsDeleting(true);
    try {
      const response = await api.delete(`/track/items/${selectedItem._id}`);
      if (response.data.success) {
        // Remove the item from the timeline
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
        // Use onTimelineUpdate instead of setTimeline
        onTimelineUpdate(updatedTimeline);
        setSelectedItem(null);
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
      const timelineDuration = Number(timeline.duration);

      const updatedTimeline = {
        ...timeline,
        tracks: (timeline.tracks as ITrack[]).map((track) => {
          if (track._id !== dragData.track._id) return track;

          return {
            ...track,
            items: track.items.map((it) => {
              if (it._id !== dragData.item._id) return it;

              if (dragAction === "move") {
                const newStart = Math.max(
                  0,
                  Math.min(
                    timelineDuration - dragData.duration,
                    dragData.initialStart + deltaTime
                  )
                );
                return {
                  ...it,
                  startTime: newStart,
                  endTime: newStart + dragData.duration,
                };
              }

              if (dragAction === "resize-left") {
                const newStart = Math.max(
                  0,
                  Math.min(
                    dragData.initialEnd - 0.1,
                    dragData.initialStart + deltaTime
                  )
                );
                // for media, shift sourceStartTime; for text, just change startTime
                if (it.type === "text") {
                  return { ...it, startTime: newStart };
                }
                const cropDelta = newStart - dragData.initialStart;
                const newSourceStart = Math.max(
                  0,
                  dragData.initialSourceStart + cropDelta
                );
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
                  dragData.initialStart + 0.1,
                  dragData.initialEnd + deltaTime
                );
                if (it.type === "text") {
                  return { ...it, endTime: Math.min(timelineDuration, newEnd) };
                }
                const cropDelta = newEnd - dragData.initialEnd;
                const newSourceEnd = dragData.initialSourceEnd + cropDelta;
                return {
                  ...it,
                  endTime: Math.min(timelineDuration, newEnd),
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

    let newTextItem: ITextTimelineItem = {
      _id: `text-${Date.now()}`,
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
        newTextItem
      );
      if (!response.data.success) {
        throw Error(
          "Operation failed, backend responded with",
          response.data.error
        );
      } else {
        newTextItem = response.data.data.timelineItem;
        const updated: Timeline = {
          ...timeline,
          tracks: tracks.map((t) =>
            t._id === textTrack._id
              ? { ...t, items: [...t.items, newTextItem] }
              : t
          ),
        };
        // Use onTimelineUpdate instead of setTimeline
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
        </div>
      </div>

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
            {/* Minimal Time Ruler */}
            <div className="relative h-6 bg-zinc-950 border-b border-zinc-800">
              {Array.from({ length: rulerDuration }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex flex-col"
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
                        "absolute top-3 bottom-3 rounded-md shadow-lg transition-all duration-200 border";
                      const isSelected = selectedItem?._id === item._id;
                      const isDragging =
                        dragAction && dragData?.item._id === item._id;

                      let colorClasses = "";
                      if (item.type === "video") {
                        colorClasses = isSelected
                          ? "bg-gradient-to-r from-purple-600 to-purple-700 border-purple-400 shadow-purple-600/30"
                          : "bg-gradient-to-r from-purple-700 to-purple-800 border-purple-600 hover:from-purple-600 hover:to-purple-700";
                      } else if (item.type === "audio") {
                        colorClasses = isSelected
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-700 border-emerald-400 shadow-emerald-600/30"
                          : "bg-gradient-to-r from-emerald-700 to-emerald-800 border-emerald-600 hover:from-emerald-600 hover:to-emerald-700";
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
                        {/* Item content with better readability */}
                        <div className="px-2 py-1 text-xs font-semibold text-white truncate pointer-events-none flex items-center gap-1.5">
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
                              className="absolute left-0 top-0 bottom-0 w-2 bg-white/80 cursor-ew-resize rounded-l-lg flex items-center justify-center hover:bg-white transition-colors"
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
                              className="absolute right-0 top-0 bottom-0 w-2 bg-white/80 cursor-ew-resize rounded-r-lg flex items-center justify-center hover:bg-white transition-colors"
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
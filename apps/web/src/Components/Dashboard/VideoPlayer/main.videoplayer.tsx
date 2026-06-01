import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Check,
  Type,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import type {
  Timeline,
  ITrack,
  IVideoTimelineItem,
  IAudioTimelineItem,
  ITextTimelineItem,
} from "@/State/Types";

// Color palette options
const COLOR_PALETTE = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Lime', value: '#84cc16' }
];

// Font size options
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

// Font family options
const FONT_FAMILIES = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Fira Code', value: 'Fira Code, monospace' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' }
];

interface TextOverlaysProps {
  overlays: ITextTimelineItem[];
  editingTextId: string | null;
  draggingRef: React.MutableRefObject<{
    id: string;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>;
  livePos: { x: number; y: number } | null;
  onTextMouseDown: (e: React.MouseEvent, item: ITextTimelineItem) => void;
  onTextEdit: (item: ITextTimelineItem) => void;
  onTextContentChange: (itemId: string, value: string) => void;
  onUpdateTextItem: (itemId: string, updates: Partial<ITextTimelineItem>) => void;
  setEditingTextId: (id: string | null) => void;
}

const TextOverlays: React.FC<TextOverlaysProps> = ({
  overlays,
  editingTextId,
  draggingRef,
  livePos,
  onTextMouseDown,
  onTextEdit,
  onTextContentChange,
  onUpdateTextItem,
  setEditingTextId,
}) => {
  return (
    <>
      {overlays.map((overlay) => {
        const isEditing = editingTextId === overlay._id;
        const posX =
          draggingRef.current?.id === overlay._id && livePos
            ? livePos.x
            : overlay.x ?? 50;
        const posY =
          draggingRef.current?.id === overlay._id && livePos
            ? livePos.y
            : overlay.y ?? 50;

        // Smart Positioning Logic
        const isTopHalf = posY < 50;

        // When editing:
        // - If in top half: anchor to top-center (translate -50%, 0), grows downwards
        // - If in bottom half: anchor to bottom-center (translate -50%, -100%), grows upwards
        const transform = isEditing
          ? (isTopHalf ? "translate(-50%, 0%)" : "translate(-50%, -100%)")
          : "translate(-50%, -50%)"; // Standard center anchor for display/dragging

        // Add offset to prevent overlapping the exact anchor point too much when editing
        const marginTop = isEditing && isTopHalf ? "16px" : "0px";
        const marginBottom = isEditing && !isTopHalf ? "16px" : "0px";

        const currentColor = overlay.color || "#ffffff";

        return (
          <div
            key={overlay._id}
            className={`absolute transition-all duration-200 ${
              isEditing
                ? "z-50"
                : "cursor-grab hover:scale-105 active:scale-95"
            }`}
            style={{
              left: `${posX}%`,
              top: `${posY}%`,
              transform,
              marginTop,
              marginBottom,
              // While editing, the toolbar must NOT inherit the overlay's font
              // size/family/color (a 72px toolbar looked broken). Only apply the
              // text styling in display mode.
              fontFamily: isEditing ? undefined : overlay.fontFamily || "Inter, sans-serif",
              fontSize: isEditing ? undefined : `${overlay.fontSize || 24}px`,
              color: isEditing ? undefined : overlay.color || "white",
              userSelect: isEditing ? "text" : "none",
              width: isEditing ? "max-content" : "auto",
            }}
            onMouseDown={(e) => onTextMouseDown(e, overlay)}
            onDoubleClick={() => onTextEdit(overlay)}
          >
            {isEditing ? (
              /* === Editing toolbar (shadcn Select + Popover, brand-green) === */
              <div className="w-[320px] rounded-xl border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                {/* Text input + Done */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Type className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={overlay.content || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onTextContentChange(overlay._id, e.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-8 pr-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-[#19E5A1]/50 focus:ring-2 focus:ring-[#19E5A1]/20"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter") setEditingTextId(null);
                      }}
                      placeholder="Type text..."
                    />
                  </div>
                  <button
                    onClick={() => setEditingTextId(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#19E5A1] text-[#00231a] transition-colors hover:bg-[#15c88c]"
                    title="Done"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>

                {/* Controls: Font | Size | Color */}
                <div className="mt-2 flex items-center gap-1.5">
                  {/* Font family */}
                  <Select
                    value={overlay.fontFamily || "Inter, sans-serif"}
                    onValueChange={(v) =>
                      onUpdateTextItem(overlay._id, { fontFamily: v })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-8 flex-1 border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 focus-visible:border-[#19E5A1]/50 focus-visible:ring-[#19E5A1]/20"
                    >
                      <SelectValue placeholder="Font" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem
                          key={font.value}
                          value={font.value}
                          className="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-white"
                          style={{ fontFamily: font.value }}
                        >
                          {font.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Font size */}
                  <Select
                    value={String(overlay.fontSize || 24)}
                    onValueChange={(v) =>
                      onUpdateTextItem(overlay._id, { fontSize: Number(v) })
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-8 w-[74px] border-zinc-800 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 focus-visible:border-[#19E5A1]/50 focus-visible:ring-[#19E5A1]/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-200">
                      {FONT_SIZES.map((size) => (
                        <SelectItem
                          key={size}
                          value={String(size)}
                          className="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-white"
                        >
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Color */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 transition-colors hover:bg-zinc-800"
                        title="Text color"
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: currentColor }}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-auto border-zinc-800 bg-zinc-900 p-3 text-zinc-200"
                    >
                      <div className="grid grid-cols-6 gap-1.5">
                        {COLOR_PALETTE.map((color) => {
                          const active =
                            currentColor.toLowerCase() === color.value.toLowerCase();
                          return (
                            <button
                              key={color.value}
                              onClick={() =>
                                onUpdateTextItem(overlay._id, { color: color.value })
                              }
                              title={color.name}
                              className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 focus:outline-none ${
                                active
                                  ? "border-white ring-2 ring-[#19E5A1] ring-offset-1 ring-offset-zinc-900"
                                  : "border-zinc-700 hover:border-zinc-500"
                              }`}
                              style={{ backgroundColor: color.value }}
                            />
                          );
                        })}
                      </div>

                      {/* Custom color */}
                      <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-zinc-700">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) =>
                              onUpdateTextItem(overlay._id, { color: e.target.value })
                            }
                            className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] cursor-pointer border-0 bg-transparent p-0"
                            title="Pick a custom color"
                          />
                        </div>
                        <input
                          type="text"
                          value={currentColor}
                          onChange={(e) => {
                            const v = e.target.value;
                            onUpdateTextItem(overlay._id, { color: v });
                          }}
                          spellCheck={false}
                          className="h-7 w-[88px] rounded-md border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs uppercase text-zinc-200 outline-none focus:border-[#19E5A1]/50"
                          aria-label="Hex color"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              /* === Display Mode === */
              <div
                className="rounded-lg border border-transparent px-3 py-1.5 transition-all duration-200 hover:border-[#19E5A1]/50 hover:bg-[#19E5A1]/15"
                title="Double click to edit"
              >
                <div
                  className="whitespace-nowrap text-center leading-tight drop-shadow-md"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                >
                  {overlay.content}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const VideoPlayer = ({
  timeline,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onPlayPause,
  onUpdateTextItem,
  editingTextId,
  setEditingTextId,
}: {
  timeline: Timeline;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: () => void;
  onUpdateTextItem: (itemId: string, updates: Partial<ITextTimelineItem>) => void;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // refs to avoid stale closures for doc-level handlers
  const draggingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);
  const livePosRef = useRef<{ x: number; y: number } | null>(null);

  const [volume, setVolume] = useState(1);
  const [, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  } | null>(null);
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);

  const getActiveVideo = useCallback(() => {
    const tracks = timeline.tracks as ITrack[];
    const videoTrack = tracks.find((t) => t.type === "video");
    if (!videoTrack) return null;
    
    const activeItem = videoTrack.items.find(
      (item) => currentTime >= item.startTime && currentTime <= item.endTime
    );
    
    return activeItem as IVideoTimelineItem | null;
  }, [timeline, currentTime]);

  const getActiveAudio = useCallback(() => {
    const tracks = timeline.tracks as ITrack[];
    const audioTrack = tracks.find((t) => t.type === "audio");
    if (!audioTrack) return [] as IAudioTimelineItem[];
    
    return audioTrack.items.filter(
      (item) => currentTime >= item.startTime && currentTime <= item.endTime
    ) as IAudioTimelineItem[];
  }, [timeline, currentTime]);

  const getActiveTextOverlays = useCallback(() => {
    const tracks = timeline.tracks as ITrack[];
    const textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) return [] as ITextTimelineItem[];
    
    return textTrack.items.filter(
      (item) => currentTime >= item.startTime && currentTime <= item.endTime
    ) as ITextTimelineItem[];
  }, [timeline, currentTime]);

  // Track previous active video to detect transitions
  const prevActiveVideoRef = useRef<IVideoTimelineItem | null>(null);

  // Sync video element with timeline time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const activeVideo = getActiveVideo();
    
    if (activeVideo && activeVideo.assetId) {
      const timeInClip = currentTime - activeVideo.startTime;
      const sourceTime = activeVideo.sourceStartTime + timeInClip;

      // Track video transition
      const isNewClip = prevActiveVideoRef.current?._id !== activeVideo._id;
      prevActiveVideoRef.current = activeVideo;

      if (video.src !== activeVideo.assetId.url) {
        video.src = activeVideo.assetId.url;
        video.currentTime = Math.max(0, sourceTime);
      } else if (isNewClip || Math.abs(video.currentTime - sourceTime) > 0.5) {
        // Seek on clip transitions OR when user scrubs (large drift).
        // Normal playback drift is <0.2s; scrubs are typically seconds apart.
        video.currentTime = Math.max(0, sourceTime);
      }

      // If the timeline slot is longer than the actual source video, the
      // playhead can move past the clip's content. Don't seek past the end
      // or re-issue play() — that made the <video> thrash (seek-past-end →
      // play → instant-end → repeat every frame). Just hold the last frame;
      // the rAF loop keeps the marker moving until the next clip begins.
      const dur = isFinite(video.duration) ? video.duration : Infinity;
      const pastEnd = sourceTime >= dur - 0.05;

      if (pastEnd) {
        if (!video.paused) video.pause();
      } else if (isPlaying && video.paused) {
        void video.play().catch(() => {});
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    } else {
      // No active video at current time
      prevActiveVideoRef.current = null;
      
      // If we're playing but no video is active, let the playhead continue
      // This handles the case where video is shorter than audio
      if (!isPlaying) {
        video.pause();
        if (video.src) video.removeAttribute("src");
      }
    }
  }, [currentTime, isPlaying, getActiveVideo]);

  // Track last audio seek time to debounce
  const lastAudioSeekRef = useRef<Map<string, number>>(new Map());

  // Handle audio items
  useEffect(() => {
    const activeAudio = getActiveAudio();

    // remove inactive
    audioRefs.current.forEach((audio, id) => {
      if (!activeAudio.find((i) => i._id === id)) {
        audio.pause();
        audio.remove();
        audioRefs.current.delete(id);
        lastAudioSeekRef.current.delete(id);
      }
    });

    // ensure active
    activeAudio.forEach((item) => {
      if (!item.assetId) return;

      let audio = audioRefs.current.get(item._id);
      if (!audio) {
        audio = new Audio(item.assetId.url);
        audio.volume = (item.volume || 1) * volume;
        audioRefs.current.set(item._id, audio);
      }

      const timeInClip = currentTime - item.startTime;
      const sourceTime = item.sourceStartTime + timeInClip;
      const drift = Math.abs(audio.currentTime - sourceTime);

      // IMPROVED SYNC LOGIC to prevent crackling:
      // 1. Higher tolerance (0.3s instead of 0.1s) for normal drift
      // 2. Only seek if significantly out of sync (>0.5s)
      // 3. Debounce seeks to prevent rapid consecutive updates
      const now = Date.now();
      const lastSeek = lastAudioSeekRef.current.get(item._id) || 0;
      const timeSinceLastSeek = now - lastSeek;

      // Only seek if drift is significant AND enough time has passed since last seek
      if (drift > 0.5 && timeSinceLastSeek > 200) {
        // 200ms debounce
        audio.currentTime = sourceTime;
        lastAudioSeekRef.current.set(item._id, now);
      }

      if (isPlaying) {
        if (audio.paused) void audio.play().catch(() => {});
      } else {
        if (!audio.paused) audio.pause();
      }
    });

    if (!isPlaying) audioRefs.current.forEach((a) => a.pause());
  }, [currentTime, isPlaying, getActiveAudio, volume]);

  useEffect(() => {
    audioRefs.current.forEach((a) => (a.volume = volume));
  }, [volume]);

  const handleSkip = (seconds: number) => {
    const newTime = Math.max(
      0,
      Math.min(Number(timeline.duration), currentTime + seconds)
    );
    onTimeUpdate(newTime);
  };

  const onTextMouseDown = (e: React.MouseEvent, item: ITextTimelineItem) => {
    if (editingTextId === item._id) return; // don't drag while editing text

    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // initial positions
    const initX = item.x ?? 50;
    const initY = item.y ?? 50;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    // set both state and refs so UI updates and doc handlers can read latest
    const dragObj = {
      id: item._id,
      startX: startClientX,
      startY: startClientY,
      initX,
      initY,
    };
    setDragging(dragObj);
    draggingRef.current = dragObj;

    const initPos = { x: initX, y: initY };
    setLivePos(initPos);
    livePosRef.current = initPos;

    // disable text selection while dragging
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      // compute delta relative to the startClientX/startClientY captured above
      const deltaX = ((ev.clientX - startClientX) / rect.width) * 100;
      const deltaY = ((ev.clientY - startClientY) / rect.height) * 100;

      const nx = Math.max(0, Math.min(100, initX + deltaX));
      const ny = Math.max(0, Math.min(100, initY + deltaY));

      const newPos = { x: nx, y: ny };
      setLivePos(newPos);
      livePosRef.current = newPos;
    };

    const handleUp = () => {
      // read final pos from ref (reliable)
      const finalPos = livePosRef.current ?? { x: initX, y: initY };

      // persist final position to parent
      onUpdateTextItem(item._id, { x: finalPos.x, y: finalPos.y });

      // cleanup
      setDragging(null);
      draggingRef.current = null;
      setLivePos(null);
      livePosRef.current = null;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);

      // restore user-select
      document.body.style.userSelect = prevUserSelect;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  };

  const handleTextEdit = (item: ITextTimelineItem) => setEditingTextId(item._id);
  
  const handleTextContentChange = (itemId: string, value: string) =>
    onUpdateTextItem(itemId, { content: value });

  const overlays = getActiveTextOverlays();

  return (
    <div className="bg-black p-3 h-full flex flex-col">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden mb-3 flex-1"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          // Note: we deliberately do NOT drive the timeline playhead from the
          // video element's timeupdate. The requestAnimationFrame loop in
          // VideoEditor is the single source of truth for `currentTime`; the
          // <video> is a slave that seeks to match. Driving time from both
          // produced a tug-of-war that made the marker stutter/stick,
          // especially when a clip's source was shorter than its timeline slot.
          onEnded={() => {
            // Intentionally a no-op. The requestAnimationFrame playback loop in
            // VideoEditor is the single source of truth for the playhead and
            // advances time continuously. Previously this handler snapped the
            // playhead to activeVideo.endTime + 0.016 when the *source file*
            // ended — but if a clip's source is shorter than its timeline span
            // (e.g. duration metadata drift), that produced a visible "jump"
            // that skipped a few seconds. Letting the rAF loop drive avoids it;
            // the last frame simply holds until the loop reaches the next clip.
          }}
        />

        {/* Text overlays */}
        <TextOverlays
          overlays={overlays}
          editingTextId={editingTextId}
          draggingRef={draggingRef}
          livePos={livePos}
          onTextMouseDown={onTextMouseDown}
          onTextEdit={handleTextEdit}
          onTextContentChange={handleTextContentChange}
          onUpdateTextItem={onUpdateTextItem}
          setEditingTextId={setEditingTextId}
        />
      </div>

      {/* Player Controls */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSkip(-5)}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
          >
            <SkipBack className="w-4 h-4 text-zinc-300" />
          </button>
          <button
            onClick={onPlayPause}
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={() => handleSkip(5)}
            className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
          >
            <SkipForward className="w-4 h-4 text-zinc-300" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-zinc-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 bg-zinc-700 rounded-full h-1 appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />
        </div>

        <div className="text-zinc-300 text-xs">
          {formatTime(currentTime)} / {formatTime(Number(timeline.duration))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
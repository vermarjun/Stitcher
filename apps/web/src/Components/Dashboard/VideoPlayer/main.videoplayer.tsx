import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Check,
  ChevronDown
} from "lucide-react";
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

interface DropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

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
  dropdownStates: {
    [key: string]: {
      colorOpen: boolean;
      fontSizeOpen: boolean;
      fontFamilyOpen: boolean;
    };
  };
  onTextMouseDown: (e: React.MouseEvent, item: ITextTimelineItem) => void;
  onTextEdit: (item: ITextTimelineItem) => void;
  onTextContentChange: (itemId: string, value: string) => void;
  onUpdateTextItem: (itemId: string, updates: Partial<ITextTimelineItem>) => void;
  onToggleDropdown: (overlayId: string, dropdownType: 'color' | 'fontSize' | 'fontFamily') => void;
  setEditingTextId: (id: string | null) => void;
}

const TextOverlays: React.FC<TextOverlaysProps> = ({
  overlays,
  editingTextId,
  draggingRef,
  livePos,
  dropdownStates,
  onTextMouseDown,
  onTextEdit,
  onTextContentChange,
  onUpdateTextItem,
  onToggleDropdown,
  setEditingTextId,
}) => {
  const handleColorSelect = (itemId: string, color: string) => {
    onUpdateTextItem(itemId, { color });
    onToggleDropdown(itemId, 'color');
  };

  const handleFontSizeSelect = (itemId: string, fontSize: number) => {
    onUpdateTextItem(itemId, { fontSize });
    onToggleDropdown(itemId, 'fontSize');
  };

  const handleFontFamilySelect = (itemId: string, fontFamily: string) => {
    onUpdateTextItem(itemId, { fontFamily });
    onToggleDropdown(itemId, 'fontFamily');
  };

  const getCurrentColorName = (color: string) => {
    const colorItem = COLOR_PALETTE.find(c => c.value === color);
    return colorItem ? colorItem.name : 'Custom';
  };

  const getCurrentFontName = (fontFamily: string) => {
    const fontItem = FONT_FAMILIES.find(f => f.value === fontFamily);
    return fontItem ? fontItem.name : 'Custom';
  };

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

        const dropdownState = dropdownStates[overlay._id] || {
          colorOpen: false,
          fontSizeOpen: false,
          fontFamilyOpen: false
        };

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
              fontFamily: overlay.fontFamily || "Inter, sans-serif",
              fontSize: `${overlay.fontSize || 24}px`,
              color: overlay.color || "white",
              userSelect: isEditing ? "text" : "none",
              maxWidth: isEditing ? "360px" : "none",
              width: isEditing ? "max-content" : "auto",
            }}
            onMouseDown={(e) => onTextMouseDown(e, overlay)}
            onDoubleClick={() => onTextEdit(overlay)}
          >
            {isEditing ? (
              /* === Editing UI (Premium Look) === */
              <div className="bg-zinc-950/95 backdrop-blur-md rounded-xl border border-zinc-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 p-1">
                <div className="flex flex-col gap-2 p-3 min-w-[300px]">
                  {/* Input Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={overlay.content || ""}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onTextContentChange(overlay._id, e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:bg-zinc-900 outline-none text-white text-sm transition-all placeholder:text-zinc-600"
                        autoFocus
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === "Enter") setEditingTextId(null);
                        }}
                        placeholder="Type text..."
                      />
                    </div>
                    <button
                      onClick={() => setEditingTextId(null)}
                      className="p-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                      title="Done"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent my-1" />

                  {/* Controls Row */}
                  <div className="flex flex-col gap-2.5">
                    {/* Font Family */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Font</span>
                      <Dropdown
                        isOpen={dropdownState.fontFamilyOpen}
                        onToggle={() => onToggleDropdown(overlay._id, 'fontFamily')}
                        className="flex-1 max-w-[200px]"
                      >
                        <button
                          data-dropdown-toggle
                          onClick={() => onToggleDropdown(overlay._id, 'fontFamily')}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-200 text-xs transition-colors group"
                        >
                          <span className="truncate font-medium">{getCurrentFontName(overlay.fontFamily || 'Inter, sans-serif')}</span>
                          <ChevronDown className={`w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform ${dropdownState.fontFamilyOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {dropdownState.fontFamilyOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                            {FONT_FAMILIES.map((font) => (
                              <button
                                key={font.value}
                                onClick={() => handleFontFamilySelect(overlay._id, font.value)}
                                className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors border-b border-zinc-800/50 last:border-0"
                                style={{ fontFamily: font.value }}
                              >
                                {font.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </Dropdown>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Font Size */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 w-8">Size</span>
                        <Dropdown
                          isOpen={dropdownState.fontSizeOpen}
                          onToggle={() => onToggleDropdown(overlay._id, 'fontSize')}
                          className="flex-1"
                        >
                          <button
                            data-dropdown-toggle
                            onClick={() => onToggleDropdown(overlay._id, 'fontSize')}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-200 text-xs transition-colors group"
                          >
                            <span className="font-medium">{overlay.fontSize || 24}px</span>
                            <ChevronDown className={`w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform ${dropdownState.fontSizeOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {dropdownState.fontSizeOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-xl z-40 max-h-48 overflow-y-auto custom-scrollbar">
                              {FONT_SIZES.map((size) => (
                                <button
                                  key={size}
                                  onClick={() => handleFontSizeSelect(overlay._id, size)}
                                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors border-b border-zinc-800/50 last:border-0"
                                >
                                  {size}px
                                </button>
                              ))}
                            </div>
                          )}
                        </Dropdown>
                      </div>

                      {/* Color */}
                      <div className="flex-1 flex items-center gap-2 pl-2 border-l border-zinc-800">
                         <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 w-8">Color</span>
                        <Dropdown
                          isOpen={dropdownState.colorOpen}
                          onToggle={() => onToggleDropdown(overlay._id, 'color')}
                          className="flex-1"
                        >
                          <button
                            data-dropdown-toggle
                            onClick={() => onToggleDropdown(overlay._id, 'color')}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-zinc-200 text-xs transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border border-zinc-700 shadow-sm"
                                style={{ backgroundColor: overlay.color }}
                              />
                              <span className="truncate font-medium">{getCurrentColorName(overlay.color || '#ffffff')}</span>
                            </div>
                            <ChevronDown className={`w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform ${dropdownState.colorOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {dropdownState.colorOpen && (
                            <div className="absolute top-full right-0 mt-1 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-lg shadow-xl z-30 p-2.5 min-w-[160px]">
                              <div className="grid grid-cols-5 gap-1.5">
                                {COLOR_PALETTE.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={() => handleColorSelect(overlay._id, color.value)}
                                    title={color.name}
                                    className={`w-6 h-6 rounded-full border transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      overlay.color === color.value
                                        ? "border-white shadow-md ring-1 ring-white/20"
                                        : "border-zinc-700 hover:border-zinc-500"
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </Dropdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* === Display Mode === */
              <div 
                className="px-3 py-1.5 rounded-lg border border-transparent hover:border-blue-500/50 hover:bg-blue-500/20 transition-all duration-200"
                title="Double click to edit"
              >
                <div 
                  className="drop-shadow-md text-center leading-tight whitespace-nowrap"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
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

const Dropdown: React.FC<DropdownProps> = ({ isOpen, onToggle, children, className = '' }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown-toggle]')) {
          onToggle();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {children}
    </div>
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

  // Dropdown states for each overlay
  const [dropdownStates, setDropdownStates] = useState<{
    [key: string]: {
      colorOpen: boolean;
      fontSizeOpen: boolean;
      fontFamilyOpen: boolean;
    };
  }>({});

  const toggleDropdown = (overlayId: string, dropdownType: 'color' | 'fontSize' | 'fontFamily') => {
    setDropdownStates(prev => ({
      ...prev,
      [overlayId]: {
        ...prev[overlayId],
        colorOpen: dropdownType === 'color' ? !prev[overlayId]?.colorOpen : false,
        fontSizeOpen: dropdownType === 'fontSize' ? !prev[overlayId]?.fontSizeOpen : false,
        fontFamilyOpen: dropdownType === 'fontFamily' ? !prev[overlayId]?.fontFamilyOpen : false,
      }
    }));
  };

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
      prevActiveVideoRef.current = activeVideo;

      if (video.src !== activeVideo.assetId.url) {
        video.src = activeVideo.assetId.url;
        video.currentTime = sourceTime;
      } else if (Math.abs(video.currentTime - sourceTime) > 0.1) {
        video.currentTime = sourceTime;
      }

      if (isPlaying && video.paused) {
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
          onTimeUpdate={(e) => {
            if (isPlaying) {
              const activeVideo = getActiveVideo();
              if (activeVideo) {
                const sourceTime = e.currentTarget.currentTime;
                const timelineTime =
                  activeVideo.startTime +
                  (sourceTime - activeVideo.sourceStartTime);
                
                // CRITICAL FIX: Only update if we're within bounds AND not going backwards
                // This prevents looping back to the start when the video ends
                if (timelineTime <= activeVideo.endTime && timelineTime >= activeVideo.startTime) {
                  // Additional check: don't let video element updates move timeline backwards
                  if (timelineTime >= currentTime - 0.5) { // Allow small backward tolerance for seek operations
                    onTimeUpdate(timelineTime);
                  }
                }
              }
            }
          }}
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
          dropdownStates={dropdownStates}
          onTextMouseDown={onTextMouseDown}
          onTextEdit={handleTextEdit}
          onTextContentChange={handleTextContentChange}
          onUpdateTextItem={onUpdateTextItem}
          onToggleDropdown={toggleDropdown}
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
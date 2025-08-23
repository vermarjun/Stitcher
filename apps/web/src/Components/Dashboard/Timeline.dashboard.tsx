import { useState, useRef } from "react";
import { Button } from "@/Components/ui/button";
import { Slider } from "@/Components/ui/slider";
import { ScrollArea } from "@/Components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Scissors,
  Copy,
  Trash2,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Plus,
  Layers,
  Music,
  Type,
  Image,
  Video,
  Wand2,
} from "lucide-react";
import type { Project, User } from "@/State/Types";

interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text' | 'image' | 'effect';
  visible: boolean;
  locked: boolean;
  muted?: boolean;
  clips: TimelineClip[];
  height: number;
}

interface TimelineClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  color: string;
  thumbnail?: string;
  waveform?: number[];
  selected: boolean;
}

interface Props {
  currentProject? : Project,
  user? : User
}

// @ts-ignore
function Timeline({currentProject, user}:Props) {
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120); // 2 minutes default
  const [zoom, setZoom] = useState(1);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [dragMode, setDragMode] = useState<'select' | 'resize' | 'move'>('select');

  // Sample timeline data
  const [tracks, setTracks] = useState<TimelineTrack[]>([
    {
      id: 'video-1',
      name: 'Video Track 1',
      type: 'video',
      visible: true,
      locked: false,
      height: 80,
      clips: [
        {
          id: 'clip-1',
          name: 'Main Video',
          startTime: 0,
          duration: 60,
          color: 'bg-purple-600',
          selected: false
        },
        {
          id: 'clip-2',
          name: 'Secondary Video',
          startTime: 65,
          duration: 45,
          color: 'bg-purple-500',
          selected: false
        }
      ]
    },
    {
      id: 'audio-1',
      name: 'Audio Track 1',
      type: 'audio',
      visible: true,
      locked: false,
      muted: false,
      height: 60,
      clips: [
        {
          id: 'audio-clip-1',
          name: 'Background Music',
          startTime: 0,
          duration: 120,
          color: 'bg-green-600',
          selected: false,
          waveform: Array.from({ length: 120 }, () => Math.random() * 40 + 10)
        }
      ]
    },
    {
      id: 'text-1',
      name: 'Text Track 1',
      type: 'text',
      visible: true,
      locked: false,
      height: 50,
      clips: [
        {
          id: 'text-clip-1',
          name: 'Title Text',
          startTime: 5,
          duration: 10,
          color: 'bg-blue-600',
          selected: false
        },
        {
          id: 'text-clip-2',
          name: 'End Credits',
          startTime: 100,
          duration: 15,
          color: 'bg-blue-500',
          selected: false
        }
      ]
    }
  ]);

  // Timeline controls
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTimeChange = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.1, Math.min(5, newZoom));
    });
  };

  // Track management
  const toggleTrackVisibility = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId
        ? { ...track, visible: !track.visible }
        : track
    ));
  };

  const toggleTrackLock = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId
        ? { ...track, locked: !track.locked }
        : track
    ));
  };

  const toggleTrackMute = (trackId: string) => {
    setTracks(prev => prev.map(track =>
      track.id === trackId && 'muted' in track
        ? { ...track, muted: !track.muted }
        : track
    ));
  };

  const addTrack = (type: TimelineTrack['type']) => {
    const newTrack: TimelineTrack = {
      id: `${type}-${Date.now()}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${tracks.filter(t => t.type === type).length + 1}`,
      type,
      visible: true,
      locked: false,
      clips: [],
      height: type === 'video' ? 80 : type === 'audio' ? 60 : 50,
      ...(type === 'audio' && { muted: false })
    };
    setTracks(prev => [...prev, newTrack]);
  };

  // Clip management
  const selectClip = (clipId: string, multiSelect = false) => {
    setSelectedClips(prev => {
      const newSelection = new Set(prev);
      if (multiSelect) {
        if (newSelection.has(clipId)) {
          newSelection.delete(clipId);
        } else {
          newSelection.add(clipId);
        }
      } else {
        newSelection.clear();
        newSelection.add(clipId);
      }
      return newSelection;
    });

    // Update clip selection state
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.map(clip => ({
        ...clip,
        selected: selectedClips.has(clip.id)
      }))
    })));
  };

  const deleteSelectedClips = () => {
    if (selectedClips.size === 0) return;
    
    setTracks(prev => prev.map(track => ({
      ...track,
      clips: track.clips.filter(clip => !selectedClips.has(clip.id))
    })));
    setSelectedClips(new Set());
  };

  const duplicateSelectedClips = () => {
    if (selectedClips.size === 0) return;

    setTracks(prev => prev.map(track => {
      const newClips = [...track.clips];
      track.clips.forEach(clip => {
        if (selectedClips.has(clip.id)) {
          const duplicatedClip = {
            ...clip,
            id: `${clip.id}-copy-${Date.now()}`,
            name: `${clip.name} Copy`,
            startTime: clip.startTime + clip.duration + 1,
            selected: false
          };
          newClips.push(duplicatedClip);
        }
      });
      return { ...track, clips: newClips };
    }));
  };

  // Timeline rendering helpers
  const getTimelineWidth = () => duration * zoom * 10; // 10px per second at 1x zoom
  const timeToPixels = (time: number) => time * zoom * 10;
  const pixelsToTime = (pixels: number) => pixels / (zoom * 10);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const centiseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const getTrackIcon = (type: TimelineTrack['type']) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      case 'text': return <Type className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'effect': return <Wand2 className="h-4 w-4" />;
      default: return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-80 bg-zinc-950/90 border-t border-zinc-800/50 flex flex-col">
      {/* Timeline Header */}
      <div className="h-12 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-300 hover:text-white hover:bg-zinc-800/50"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <div className="text-sm text-zinc-400 font-mono min-w-20">
              {formatTime(currentTime)}
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-700" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              onClick={() => handleZoom('out')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-zinc-500 min-w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              onClick={() => handleZoom('in')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-zinc-700" />

          {/* Edit Tools */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              onClick={() => {/* TODO: Cut selected clips */}}
              disabled={selectedClips.size === 0}
              title="Cut"
            >
              <Scissors className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              onClick={duplicateSelectedClips}
              disabled={selectedClips.size === 0}
              title="Copy"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
              onClick={deleteSelectedClips}
              disabled={selectedClips.size === 0}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Add Track Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 hover:border-zinc-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Track
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
            <DropdownMenuItem onClick={() => addTrack('video')} className="text-zinc-300 hover:bg-zinc-800">
              <Video className="h-4 w-4 mr-2" />
              Video Track
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack('audio')} className="text-zinc-300 hover:bg-zinc-800">
              <Music className="h-4 w-4 mr-2" />
              Audio Track
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack('text')} className="text-zinc-300 hover:bg-zinc-800">
              <Type className="h-4 w-4 mr-2" />
              Text Track
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack('image')} className="text-zinc-300 hover:bg-zinc-800">
              <Image className="h-4 w-4 mr-2" />
              Image Track
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => addTrack('effect')} className="text-zinc-300 hover:bg-zinc-800">
              <Wand2 className="h-4 w-4 mr-2" />
              Effect Track
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 flex">
        {/* Track Headers */}
        <div className="w-60 bg-zinc-900/30 border-r border-zinc-800/50 flex-shrink-0">
          <ScrollArea className="h-full">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors"
                style={{ height: track.height }}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-md",
                    track.type === 'video' ? 'bg-purple-600/20 text-purple-400' :
                    track.type === 'audio' ? 'bg-green-600/20 text-green-400' :
                    track.type === 'text' ? 'bg-blue-600/20 text-blue-400' :
                    track.type === 'image' ? 'bg-orange-600/20 text-orange-400' :
                    'bg-pink-600/20 text-pink-400'
                  )}>
                    {getTrackIcon(track.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-300 truncate">
                      {track.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {track.clips.length} clip{track.clips.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {track.type === 'audio' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                      onClick={() => toggleTrackMute(track.id)}
                    >
                      {track.muted ? (
                        <VolumeX className="h-3 w-3" />
                      ) : (
                        <Volume2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                    onClick={() => toggleTrackVisibility(track.id)}
                  >
                    {track.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 text-zinc-400 hover:text-white"
                    onClick={() => toggleTrackLock(track.id)}
                  >
                    {track.locked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Timeline Tracks */}
        <div className="flex-1 relative">
          <ScrollArea className="h-full" >
            <div
              ref={timelineRef}
              className="relative"
              style={{ width: getTimelineWidth(), minWidth: '100%' }}
            >
              {/* Time Ruler */}
              <div className="h-8 bg-zinc-900/50 border-b border-zinc-800/50 relative">
                {Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => i * 5).map((time) => (
                  <div
                    key={time}
                    className="absolute flex flex-col items-center"
                    style={{ left: timeToPixels(time) }}
                  >
                    <div className="w-px h-2 bg-zinc-600" />
                    <span className="text-xs text-zinc-500 mt-1">
                      {formatTime(time)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tracks */}
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="relative border-b border-zinc-800/30 bg-zinc-950/50"
                  style={{ height: track.height }}
                >
                  {/* Track background with grid */}
                  <div className="absolute inset-0 opacity-20">
                    {Array.from({ length: Math.ceil(duration) }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-zinc-700"
                        style={{ left: timeToPixels(i) }}
                      />
                    ))}
                  </div>

                  {/* Clips */}
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md border-2 cursor-pointer transition-all",
                        "flex items-center px-2 overflow-hidden",
                        clip.color,
                        clip.selected
                          ? "border-white shadow-lg shadow-white/20"
                          : "border-transparent hover:border-zinc-400"
                      )}
                      style={{
                        left: timeToPixels(clip.startTime),
                        width: timeToPixels(clip.duration),
                      }}
                      onClick={(e) => selectClip(clip.id, e.ctrlKey || e.metaKey)}
                    >
                      {/* Clip content */}
                      {track.type === 'audio' && clip.waveform && (
                        <div className="flex items-center justify-center h-full w-full opacity-60">
                          <div className="flex items-end gap-px h-8">
                            {clip.waveform.slice(0, Math.floor(timeToPixels(clip.duration) / 2)).map((height, i) => (
                              <div
                                key={i}
                                className="bg-white/80 w-px"
                                style={{ height: `${height}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-white font-medium truncate pointer-events-none">
                        {clip.name}
                      </div>

                      {/* Resize handles */}
                      {clip.selected && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white cursor-ew-resize" />
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-white cursor-ew-resize" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                style={{ left: timeToPixels(currentTime) }}
              >
                <div className="absolute top-0 -left-1 w-3 h-3 bg-red-500 transform rotate-45" />
              </div>
            </div>
          </ScrollArea>

          {/* Timeline Scrubber */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-zinc-900/80 border-t border-zinc-800/50">
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleTimeChange}
              className="w-full h-full px-4"
            />
          </div>
        </div>
      </div>

      {/* Timeline Footer */}
      <div className="h-8 bg-zinc-900/30 border-t border-zinc-800/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Duration: {formatTime(duration)}</span>
          <span>•</span>
          <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{tracks.reduce((acc, track) => acc + track.clips.length, 0)} clips</span>
          {selectedClips.size > 0 && (
            <>
              <span>•</span>
              <span className="text-blue-400">{selectedClips.size} selected</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>30 fps</span>
          <span>•</span>
          <span>1920x1080</span>
        </div>
      </div>
    </div>
  );
}

export default Timeline;
// src/Components/Dashboard/VideoPlayer.dashboard.tsx
import { useRecoilValue, useRecoilState, useSetRecoilState } from "recoil";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/Components/ui/button";
import { Slider } from "@/Components/ui/slider";
import { Badge } from "@/Components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  RotateCcw,
  Settings,
  Download,
  Share2,
  Edit3,
  Layers,
  Zap,
  Clock,
  Eye,
  EyeOff
} from "lucide-react";
import {
  currentProjectState,
  selectedItemState,
  explorerItemsState,
  videoGenerationQueueState,
  activeVideoGenerationsSelector
} from "@/State/Dashboard.state";

interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  playbackRate: number;
  quality: string;
}

 // Helper function to find item by ID
  const findItemById = (items: any[], id: string): any => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };


function VideoPlayer() {
  const currentProject = useRecoilValue(currentProjectState);
  const selectedItem = useRecoilValue(selectedItemState);
  const explorerItems = useRecoilValue(explorerItemsState);
  const videoQueue = useRecoilValue(videoGenerationQueueState);
  const activeGenerations = useRecoilValue(activeVideoGenerationsSelector);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const [playerState, setPlayerState] = useState<VideoPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    isFullscreen: false,
    playbackRate: 1,
    quality: "1080p"
  });

  // Get current video source
  const getCurrentVideo = () => {
    if (selectedItem) {
      const item = findItemById(explorerItems, selectedItem);
      if (item?.type === 'video') {
        // TODO: Return actual video URL from backend
        return {
          url: '/demo-video.mp4', // Placeholder
          name: item.name,
          duration: 120, // Placeholder
          thumbnail: '/thumbnail.jpg' // Placeholder
        };
      }
    }
    return null;
  };

  const currentVideo = getCurrentVideo();

  // Video player controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playerState.isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [playerState.isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setPlayerState(prev => ({
      ...prev,
      currentTime: video.currentTime,
      duration: video.duration || 0
    }));
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = value[0];
    video.currentTime = newTime;
    setPlayerState(prev => ({ ...prev, currentTime: newTime }));
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume / 100;
    setPlayerState(prev => ({ 
      ...prev, 
      volume: newVolume,
      isMuted: newVolume === 0
    }));
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !playerState.isMuted;
    video.muted = newMuted;
    setPlayerState(prev => ({ 
      ...prev, 
      isMuted: newMuted,
      volume: newMuted ? 0 : prev.volume
    }));
  }, [playerState.isMuted]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!playerState.isFullscreen) {
      container.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [playerState.isFullscreen]);

  const skipTime = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlayerState(prev => ({ ...prev, playbackRate: rate }));
  }, []);

  // Controls visibility management
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      if (playerState.isPlaying) {
        setControlsVisible(false);
      }
    }, 3000);
    setControlsTimeout(timeout);
  }, [controlsTimeout, playerState.isPlaying]);

  const hideControls = useCallback(() => {
    if (playerState.isPlaying && !playerState.isFullscreen) {
      setControlsVisible(false);
    }
  }, [playerState.isPlaying, playerState.isFullscreen]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === containerRef.current;
      setPlayerState(prev => ({ ...prev, isFullscreen }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts if video player container is focused or no input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Only handle video shortcuts if we have a video
      if (!currentVideo) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange([Math.min(100, playerState.volume + 10)]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange([Math.max(0, playerState.volume - 10)]);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlay, skipTime, handleVolumeChange, playerState.volume, toggleMute, toggleFullscreen, currentVideo]);

  // Format time helper
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-black flex items-center justify-center",
        "overflow-hidden", // Prevent overflow
        playerState.isFullscreen && "fixed inset-0 z-50" // Only go fullscreen when needed
      )}
      onMouseMove={showControls}
      onMouseLeave={hideControls}
    >
      {currentVideo ? (
        <>
          {/* Video Element */}
          <video
            ref={videoRef}
            src={currentVideo.url}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleTimeUpdate}
            onEnded={() => setPlayerState(prev => ({ ...prev, isPlaying: false }))}
          />

          {/* Video Overlay Info - Only show when controls are visible */}
          <div className={cn(
            "absolute top-4 left-4 z-30 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-black/70 text-white border-zinc-700">
                {currentVideo.name}
              </Badge>
              {currentProject && (
                <Badge variant="outline" className="bg-black/70 text-zinc-300 border-zinc-600">
                  {currentProject.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Video Controls - Properly contained */}
          <div className={cn(
            "absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300",
            "bg-gradient-to-t from-black/90 via-black/50 to-transparent",
            "p-4 pt-8", // Reduced top padding
            controlsVisible ? "opacity-100" : "opacity-0",
            "pointer-events-auto" // Ensure controls are clickable
          )}>
            {/* Progress Bar */}
            <div className="mb-3">
              <Slider
                value={[playerState.currentTime]}
                max={playerState.duration || 0}
                step={0.1}
                onValueChange={handleSeek}
                className="w-full cursor-pointer"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/20 shrink-0"
                  onClick={togglePlay}
                >
                  {playerState.isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 shrink-0"
                  onClick={() => skipTime(-10)}
                >
                  <SkipBack className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 shrink-0"
                  onClick={() => skipTime(10)}
                >
                  <SkipForward className="h-3 w-3" />
                </Button>

                {/* Volume Control */}
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 shrink-0"
                    onClick={toggleMute}
                  >
                    {playerState.isMuted ? (
                      <VolumeX className="h-3 w-3" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </Button>
                  <Slider
                    value={[playerState.volume]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="w-16 shrink-0"
                  />
                </div>

                {/* Time Display */}
                <div className="text-xs text-white font-mono shrink-0 ml-2">
                  {formatTime(playerState.currentTime)} / {formatTime(playerState.duration || 0)}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Playback Speed */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20 h-8 px-2"
                    >
                      <span className="text-xs">{playerState.playbackRate}x</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                      <DropdownMenuItem
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className="text-zinc-300 hover:bg-zinc-800"
                      >
                        {rate}x
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Quality */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20 h-8 px-2"
                    >
                      <span className="text-xs">{playerState.quality}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                    {['480p', '720p', '1080p', '4K'].map(quality => (
                      <DropdownMenuItem
                        key={quality}
                        onClick={() => setPlayerState(prev => ({ ...prev, quality }))}
                        className="text-zinc-300 hover:bg-zinc-800"
                      >
                        {quality}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Actions */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  title="Download"
                >
                  <Download className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  title="Share"
                >
                  <Share2 className="h-3 w-3" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                  title="Fullscreen"
                >
                  {playerState.isFullscreen ? (
                    <Minimize className="h-3 w-3" />
                  ) : (
                    <Maximize className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-full text-center p-6 max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-full bg-zinc-900/50 border border-zinc-800/50 flex items-center justify-center mb-6 shrink-0">
            <Play className="h-10 w-10 text-zinc-600" />
          </div>
          
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            No video selected
          </h3>
          
          <p className="text-sm text-zinc-500 mb-6">
            Select a video from the explorer or generate a new one to start viewing and editing.
          </p>

          {/* Generation Status */}
          {activeGenerations.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
                <Zap className="h-4 w-4 animate-pulse" />
                <span>Generating {activeGenerations.length} video{activeGenerations.length > 1 ? 's' : ''}...</span>
              </div>
              <div className="text-xs text-zinc-500">
                Videos will appear here when generation is complete
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {!currentProject ? (
              <Button variant="outline" className="border-zinc-700 text-zinc-400">
                <Edit3 className="w-4 h-4 mr-2" />
                Create Project First
              </Button>
            ) : (
              <>
                <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
                  <Layers className="w-4 h-4 mr-2" />
                  Browse Templates
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Video
                </Button>
              </>
            )}
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-6 p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-lg max-w-sm">
            <p className="text-xs text-zinc-500 mb-2 font-medium">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-zinc-600">
              <span><kbd className="bg-zinc-800 px-1 rounded text-xs">Space</kbd> Play/Pause</span>
              <span><kbd className="bg-zinc-800 px-1 rounded text-xs">F</kbd> Fullscreen</span>
              <span><kbd className="bg-zinc-800 px-1 rounded text-xs">←/→</kbd> Skip 10s</span>
              <span><kbd className="bg-zinc-800 px-1 rounded text-xs">↑/↓</kbd> Volume</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
// AudioPlayerModal.tsx
import React from "react";
import { X, Play, Pause, Volume2 } from "lucide-react";
import type { AudioPlayerProps } from "./Card.backpack";

const AudioPlayerModal: React.FC<AudioPlayerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  duration,
  fileSize,
  mediaUrl,
  formatDuration,
  formatBytes,
  isPlaying,
  currentTime,
  volume,
  audioRef,
  progressBarRef,
  togglePlayPause,
  handleProgressClick,
  setVolume,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed px-4 left-1/2 transform -translate-x-1/2 w-full bottom-4 flex justify-center items-center z-50">
      <div className="relative bg-zinc-900 w-full max-w-4xl rounded-lg shadow-2xl border border-zinc-800">
        <div className="p-4">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full p-1 backdrop-blur-md transition-all duration-200 hover:scale-105"
            aria-label="Close audio player"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-700 rounded-md flex items-center justify-center mr-3">
              <Volume2 className="h-6 w-6 text-zinc-400" />
            </div>
            <div className="flex-grow overflow-hidden">
              <h3 className="text-sm font-medium text-white truncate">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-zinc-400 truncate">
                  {description}
                </p>
              )}
              <div className="flex items-center text-xs text-zinc-500 mt-1">
                <span className="mr-3">
                  {formatBytes(fileSize)}
                </span>
                {duration && (
                  <span className="flex items-center">
                    <Volume2 className="h-3 w-3 mr-1" />
                    {formatDuration(duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={togglePlayPause}
              className="bg-white hover:bg-zinc-200 text-black rounded-full h-8 w-8 p-0 flex items-center justify-center"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>
            <div className="flex-grow mx-4">
              <div
                ref={progressBarRef}
                className="h-1.5 bg-zinc-800 rounded-full cursor-pointer"
                onClick={handleProgressClick}
              >
                <div
                  className="h-full bg-white rounded-full relative"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>{formatDuration(currentTime)}</span>
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
            <div className="flex items-center">
              <Volume2 className="h-4 w-4 text-zinc-400 mr-2" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-white"
              />
            </div>
          </div>
        </div>
        <audio 
          ref={audioRef} 
          src={mediaUrl} 
          autoPlay={isPlaying}
        />
      </div>
    </div>
  );
};

export default AudioPlayerModal;
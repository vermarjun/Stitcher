// VideoPlayerModal.tsx
import React from "react";
import { X, Clock } from "lucide-react";
import type { VideoPlayerProps } from "./Card.backpack";

const VideoPlayerModal: React.FC<VideoPlayerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  duration,
  fileSize,
  mediaUrl,
  formatDuration,
  formatBytes,
  videoRef,
  videoPlayerRef,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={videoPlayerRef}
        className="relative w-full max-w-4xl mx-auto"
      >
        <div className="bg-zinc-900 rounded-lg overflow-hidden shadow-2xl border border-zinc-800">
          <div className="relative">
            <video
              ref={videoRef}
              src={mediaUrl}
              controls
              autoPlay
              className="w-full object-cover"
              onError={() => console.error("Video failed to load")}
            />
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 bg-zinc-800/80 hover:bg-zinc-700/90 text-white rounded-full p-1.5 backdrop-blur-md transition-all duration-200 hover:scale-105"
            aria-label="Close video player"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="p-4">
            <h3 className="text-sm font-medium text-white mb-2 line-clamp-1">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                {description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-full">
                {formatBytes(fileSize)}
              </span>
              {duration && (
                <span className="flex items-center gap-1 text-zinc-400 bg-zinc-800/60 px-2 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  {formatDuration(duration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerModal;
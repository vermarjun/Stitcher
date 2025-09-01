const VideoPlayerLoading = () => {
  return (
    <div className="bg-black p-3 h-full flex flex-col">
      {/* Video Container - Shimmer Effect */}
      <div className="relative bg-zinc-900 rounded-lg overflow-hidden mb-3 flex-1 animate-pulse">
        <div className="w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-[length:200%_100%] animate-shimmer" />
      </div>

      {/* Player Controls - Shimmer Effect */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {/* Skip Back Button */}
          <div className="p-1.5 bg-zinc-800 rounded w-7 h-7 animate-pulse" />
          
          {/* Play/Pause Button */}
          <div className="p-2 bg-zinc-700 rounded-full w-8 h-8 animate-pulse" />
          
          {/* Skip Forward Button */}
          <div className="p-1.5 bg-zinc-800 rounded w-7 h-7 animate-pulse" />
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Volume Icon */}
          <div className="w-4 h-4 bg-zinc-700 rounded animate-pulse" />
          
          {/* Volume Slider */}
          <div className="w-20 bg-zinc-800 rounded-full h-1 animate-pulse" />
        </div>
        
        {/* Time Display */}
        <div className="flex gap-1">
          <div className="w-8 h-3 bg-zinc-700 rounded animate-pulse" />
          <div className="w-3 h-3 bg-zinc-700 rounded animate-pulse" />
          <div className="w-8 h-3 bg-zinc-700 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerLoading
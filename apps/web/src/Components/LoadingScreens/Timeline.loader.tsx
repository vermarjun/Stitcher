const TimelineEditorLoading = () => {
  return (
    <div className="h-full flex flex-col bg-black border border-zinc-800 overflow-hidden shadow-2xl">
      {/* Header shimmer */}
      <div className="flex items-center justify-between p-2.5 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-2">
          {/* Tool Selection shimmer */}
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
            <div className="p-1.5 rounded-md bg-zinc-800 w-8 h-8 animate-pulse" />
            <div className="p-1.5 rounded-md bg-zinc-800 w-8 h-8 animate-pulse ml-1" />
          </div>
          
          {/* Add Text Button shimmer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 w-24 h-8 animate-pulse" />
          
          {/* Status indicator shimmer */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md w-40 h-6 animate-pulse" />
        </div>
        
        {/* Sync Button shimmer */}
        <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 w-16 h-8 animate-pulse" />
      </div>

      {/* Timeline content shimmer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-black to-zinc-950">
        <div className="flex-1 overflow-auto">
          <div className="relative min-h-full" style={{ width: '1200px' }}>
            {/* Time Ruler shimmer */}
            <div className="relative h-6 bg-zinc-950 border-b border-zinc-800">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
            </div>

            {/* Tracks shimmer */}
            <div className="flex flex-col gap-2 p-2">
              {/* Track 1 */}
              <div className="relative flex-1 min-h-[60px] max-h-[150px] bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="absolute left-0 top-0 bg-zinc-800 px-2 py-1 w-16 h-5 rounded-br-lg border-r border-b border-zinc-600" />
                <div className="absolute top-3 bottom-3 left-4 w-40 rounded-md bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
              </div>
              
              {/* Track 2 */}
              <div className="relative flex-1 min-h-[60px] max-h-[150px] bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="absolute left-0 top-0 bg-zinc-800 px-2 py-1 w-16 h-5 rounded-br-lg border-r border-b border-zinc-600" />
                <div className="absolute top-3 bottom-3 left-8 w-32 rounded-md bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
              </div>
              
              {/* Track 3 */}
              <div className="relative flex-1 min-h-[60px] max-h-[150px] bg-zinc-900/80 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="absolute left-0 top-0 bg-zinc-800 px-2 py-1 w-16 h-5 rounded-br-lg border-r border-b border-zinc-600" />
                <div className="absolute top-3 bottom-3 left-12 w-48 rounded-md bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]" />
              </div>
            </div>

            {/* Playhead shimmer */}
            <div className="absolute top-0 bottom-0 w-1 bg-zinc-700 z-30 pointer-events-none" style={{ left: '200px' }}>
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-zinc-600 rotate-45 border-2 border-zinc-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Inline style tag for the shimmer animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
          .animate-\\[shimmer_1\\.5s_infinite\\] {
            animation: shimmer 1.5s infinite;
          }
        `
      }} />
    </div>
  );
};

export default TimelineEditorLoading;
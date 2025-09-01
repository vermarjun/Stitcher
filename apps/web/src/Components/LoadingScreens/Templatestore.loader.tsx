const TemplateStoreLoader: React.FC = () => {
    return (
      <div className="bg-black border-r border-zinc-800 h-screen flex flex-col animate-pulse">
        {/* Header Loader */}
        <div className="p-3 border-b border-zinc-800">
          <div className="h-5 w-40 bg-zinc-800 rounded mb-3"></div>
          
          {/* Search Loader */}
          <div className="relative mb-2">
            <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-zinc-700 rounded-full"></div>
            <div className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 rounded-lg h-7"></div>
          </div>

          {/* Type Filter Tabs Loader */}
          <div className="flex bg-zinc-900 rounded-lg p-1 mb-2">
            <div className="flex-1 px-2 py-1 rounded-md bg-zinc-700 mx-1 h-6"></div>
            <div className="flex-1 px-2 py-1 rounded-md bg-zinc-700 mx-1 h-6"></div>
            <div className="flex-1 px-2 py-1 rounded-md bg-zinc-700 mx-1 h-6"></div>
          </div>
        </div>

        {/* Templates List Loader */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="relative bg-zinc-900 rounded-lg overflow-hidden group transition-all duration-200">
                <div className="flex items-center p-2.5 gap-2.5">
                  {/* Thumbnail Loader */}
                  <div className="flex-shrink-0 w-12 h-12 bg-zinc-800 rounded-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-700 to-transparent animate-shimmer"></div>
                  </div>
                  
                  {/* Template Info Loader */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                      <div className="w-3 h-3 bg-zinc-800 rounded"></div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
                      <div className="h-3 bg-zinc-800 rounded w-1/5"></div>
                    </div>
                    
                    {/* Likes and Actions Row Loader */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-zinc-800 rounded-full"></div>
                        <div className="h-3 bg-zinc-800 rounded w-10"></div>
                      </div>
                      
                      <div className="w-12 h-5 bg-zinc-800 rounded-md"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer Stats Loader */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950">
          <div className="text-[10px] space-y-1">
            <div className="flex justify-between">
              <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-3 bg-zinc-800 rounded w-1/6"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-3 bg-zinc-800 rounded w-1/6"></div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .animate-shimmer {
            animation: shimmer 1.5s infinite;
          }
        `}</style>
      </div>
    );
  };

  export default TemplateStoreLoader

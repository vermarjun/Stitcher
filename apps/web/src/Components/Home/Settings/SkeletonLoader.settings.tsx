import React from "react";
import { Skeleton } from "@/Components/ui/skeleton";

const SkeletonLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-40 w-full bg-black/50 border-b border-white/5 mb-8 h-16">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
           <Skeleton className="h-8 w-32 bg-zinc-900" />
           <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                 <Skeleton className="h-4 w-24 bg-zinc-900 mb-1" />
                 <Skeleton className="h-3 w-32 bg-zinc-900" />
              </div>
              <Skeleton className="h-9 w-9 rounded-full bg-zinc-900" />
           </div>
        </div>
      </div>

      <div className="px-4 md:px-6 max-w-7xl mx-auto pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-3 hidden lg:block">
            <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 space-y-4">
               <Skeleton className="h-4 w-20 bg-zinc-800" />
               <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl bg-zinc-800/50" />
                  ))}
               </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-9 space-y-8">
             {/* Banner-like skeleton */}
             <div className="rounded-3xl border border-zinc-800 bg-zinc-900 h-64 relative overflow-hidden">
                <Skeleton className="w-full h-48 bg-zinc-800" />
                <div className="absolute bottom-6 left-10 flex items-end gap-6">
                   <Skeleton className="h-32 w-32 rounded-full border-4 border-zinc-900 bg-zinc-700" />
                   <div className="mb-4 space-y-2">
                      <Skeleton className="h-8 w-48 bg-zinc-800" />
                      <Skeleton className="h-4 w-64 bg-zinc-800" />
                   </div>
                </div>
             </div>
             
             {/* Stats Grid Skeleton */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                   <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 h-24 flex flex-col items-center justify-center gap-2">
                      <Skeleton className="h-8 w-12 bg-zinc-800" />
                      <Skeleton className="h-3 w-16 bg-zinc-800" />
                   </div>
                ))}
             </div>
             
             {/* Form Skeleton */}
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                <Skeleton className="h-6 w-40 bg-zinc-800" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Skeleton className="h-10 w-full bg-zinc-800" />
                   <Skeleton className="h-10 w-full bg-zinc-800" />
                </div>
                <Skeleton className="h-32 w-full bg-zinc-800" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;